import { useState, useEffect, useCallback } from "react";

// Sistema de sincronizacion unificado - localStorage + BroadcastChannel
// Funciona entre pestañas del mismo navegador (y navegadores en misma PC)

// ==========================================
// CORE - Almacenamiento compartido
// ==========================================
const LS_CHALLENGES = "senda_challenges_v4";
const LS_GLOBAL_CHAT = "senda_global_chat";
const LS_ONLINE_PLAYERS = "senda_online_players";

function getData(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setData(key: string, data: any[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function broadcastChange(type: string): void {
  try {
    const bc = new BroadcastChannel("senda_sync");
    bc.postMessage({ type, timestamp: Date.now() });
    bc.close();
  } catch { /* BroadcastChannel no soportado */ }
}

// ==========================================
// CHALLENGES (Desafios/Salas)
// ==========================================
export function getChallenges(): any[] {
  return getData(LS_CHALLENGES);
}

export function saveChallenge(challenge: any): void {
  const all = getChallenges();
  const idx = all.findIndex((c: any) => c.id === challenge.id);
  if (idx >= 0) all[idx] = challenge;
  else all.push(challenge);
  setData(LS_CHALLENGES, all);
  broadcastChange("challenges");
}

export function updateChallenge(id: number, updates: any): void {
  const all = getChallenges();
  const idx = all.findIndex((c: any) => c.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    setData(LS_CHALLENGES, all);
    broadcastChange("challenges");
  }
}

export function deleteChallenge(id: number): void {
  const all = getChallenges().filter((c: any) => c.id !== id);
  setData(LS_CHALLENGES, all);
  broadcastChange("challenges");
}

export function getChallengeById(id: number): any | undefined {
  return getChallenges().find((c: any) => c.id === id);
}

export function getChallengeByCode(code: string): any | undefined {
  return getChallenges().find((c: any) => c.syncCode === code);
}

export function generateSyncCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// ==========================================
// GLOBAL CHAT
// ==========================================
export function getGlobalChat(): any[] {
  return getData(LS_GLOBAL_CHAT);
}

export function sendGlobalMessage(senderId: number, senderName: string, content: string): void {
  const msgs = getGlobalChat();
  msgs.push({ id: Date.now(), senderId, senderName, content, timestamp: Date.now() });
  if (msgs.length > 100) msgs.splice(0, msgs.length - 100);
  setData(LS_GLOBAL_CHAT, msgs);
  broadcastChange("global-chat");
}

// ==========================================
// CHALLENGE CHAT
// ==========================================
function getChallengeChatKey(challengeId: number): string {
  return `senda_chat_${challengeId}`;
}

export function getChallengeChat(challengeId: number): any[] {
  return getData(getChallengeChatKey(challengeId));
}

export function sendChallengeMessage(challengeId: number, senderId: number, senderName: string, content: string): void {
  const msgs = getChallengeChat(challengeId);
  msgs.push({ id: Date.now(), senderId, senderName, content, timestamp: Date.now() });
  if (msgs.length > 50) msgs.splice(0, msgs.length - 50);
  setData(getChallengeChatKey(challengeId), msgs);
  broadcastChange(`chat-${challengeId}`);
}

// ==========================================
// ONLINE PLAYERS
// ==========================================
export function setPlayerOnline(userId: number, name: string): void {
  const players = getData(LS_ONLINE_PLAYERS);
  const idx = players.findIndex((p: any) => p.id === userId);
  if (idx >= 0) players[idx] = { id: userId, name, lastSeen: Date.now(), online: true };
  else players.push({ id: userId, name, lastSeen: Date.now(), online: true });
  setData(LS_ONLINE_PLAYERS, players);
  broadcastChange("players");
}

export function setPlayerOffline(userId: number): void {
  const players = getData(LS_ONLINE_PLAYERS);
  const idx = players.findIndex((p: any) => p.id === userId);
  if (idx >= 0) {
    players[idx] = { ...players[idx], online: false, lastSeen: Date.now() };
    setData(LS_ONLINE_PLAYERS, players);
    broadcastChange("players");
  }
}

export function getOnlinePlayers(myId: number): any[] {
  const cutoff = Date.now() - 30000;
  return getData(LS_ONLINE_PLAYERS).filter((p: any) => p.id !== myId && p.online && p.lastSeen > cutoff);
}

// ==========================================
// HOOKS - React integration con polling
// ==========================================
export function useSyncList(key: string): [any[], () => void] {
  const [data, setData] = useState<any[]>([]);

  const reload = useCallback(() => {
    setData(getData(key));
  }, [key]);

  useEffect(() => {
    reload();

    // BroadcastChannel listener
    const bc = new BroadcastChannel("senda_sync");
    bc.onmessage = (ev) => {
      if (ev.data?.type === key || ev.data?.type?.startsWith(key)) {
        reload();
      }
    };

    // Polling fallback (para pestañas que no respondan a BC)
    const interval = setInterval(reload, 1000);

    // storage event (para otros navegadores en misma PC)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) reload();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(interval);
      bc.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [key, reload]);

  return [data, reload];
}

export function useChallenges(): [any[], () => void] {
  return useSyncList(LS_CHALLENGES);
}

export function useGlobalChatMessages(): [any[], () => void] {
  return useSyncList(LS_GLOBAL_CHAT);
}

export function useOnlinePlayersList(myId: number): [any[], () => void] {
  const [players, reload] = useSyncList(LS_ONLINE_PLAYERS);

  // Heartbeat
  useEffect(() => {
    const heartbeat = () => {
      try {
        const u = JSON.parse(localStorage.getItem("senda_local_user") || "{}");
        if (u.id) setPlayerOnline(u.id, u.name || "Jugador");
      } catch { /* */ }
    };
    heartbeat();
    const interval = setInterval(heartbeat, 5000);
    return () => clearInterval(interval);
  }, []);

  return [players.filter((p: any) => p.id !== myId && p.online), reload];
}

export function useChallengeChatMessages(challengeId: number): [any[], () => void] {
  return useSyncList(getChallengeChatKey(challengeId));
}
