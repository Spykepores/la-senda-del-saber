// ==========================================
// Unified sync system - localStorage + BroadcastChannel
// Used for: challenges, chat, online players
// ==========================================

import { useState, useEffect, useCallback } from "react";

const CHALLENGES_KEY = "senda_challenges";
const CHAT_KEY = "senda_chat";
const GLOBAL_CHAT_KEY = "senda_global_chat";
const ONLINE_KEY = "senda_online";

// ---- helpers ----
function get<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function set(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function notify(type: string) {
  try { const bc = new BroadcastChannel("senda_sync"); bc.postMessage({ type, ts: Date.now() }); bc.close(); } catch {}
  window.dispatchEvent(new StorageEvent("storage", { key: CHALLENGES_KEY }));
}

// ---- challenges ----
export interface SyncChallenge {
  id: number;
  challengerId: number;
  challengerName: string;
  opponentId: number;
  opponentName: string;
  status: "pending" | "active" | "completed" | "cancelled";
  winnerId?: number | null;
  createdAt: number;
  roomName?: string;
  syncCode?: string;
}

let _idCounter = Date.now();
export function generateId() { return _idCounter++; }
export function generateSyncCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }

export function getChallenges(): SyncChallenge[] { return get(CHALLENGES_KEY, []); }
export function saveChallenge(c: SyncChallenge) {
  const all = getChallenges();
  const idx = all.findIndex(x => x.id === c.id);
  if (idx >= 0) all[idx] = c; else all.unshift(c);
  set(CHALLENGES_KEY, all);
  notify("challenges");
}
export function updateChallenge(id: number, patch: Partial<SyncChallenge>) {
  const all = getChallenges();
  const idx = all.findIndex(x => x.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], ...patch }; set(CHALLENGES_KEY, all); notify("challenges"); }
}
export function getChallengeById(id: number): SyncChallenge | undefined { return getChallenges().find(c => c.id === id); }
export function getChallengeByCode(code: string): SyncChallenge | undefined { return getChallenges().find(c => c.syncCode === code); }

export function useChallenges() {
  const [list, setList] = useState<SyncChallenge[]>(getChallenges);
  const reload = useCallback(() => setList(getChallenges()), []);
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener("storage", handler);
    const bc = new BroadcastChannel("senda_sync");
    bc.onmessage = (ev) => { if (ev.data?.type === "challenges") reload(); };
    const iv = setInterval(reload, 2000);
    return () => { window.removeEventListener("storage", handler); bc.close(); clearInterval(iv); };
  }, [reload]);
  return [list, reload] as const;
}

// ---- challenge chat ----
export interface ChatMessage {
  id: string;
  challengeId: number;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: number;
}

function chatKey(cid: number) { return `${CHAT_KEY}_${cid}`; }
export function getChallengeChat(cid: number): ChatMessage[] { return get(chatKey(cid), []); }
export function sendChallengeMessage(cid: number, senderId: number, senderName: string, content: string) {
  const msgs = getChallengeChat(cid);
  msgs.push({ id: `${Date.now()}_${Math.random()}`, challengeId: cid, senderId, senderName, content, timestamp: Date.now() });
  set(chatKey(cid), msgs);
  notify("chat");
}
export function useChallengeChatMessages(cid: number) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => getChallengeChat(cid));
  const reload = useCallback(() => setMsgs(getChallengeChat(cid)), [cid]);
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener("storage", handler);
    const bc = new BroadcastChannel("senda_sync");
    bc.onmessage = (ev) => { if (ev.data?.type === "chat") reload(); };
    const iv = setInterval(reload, 1500);
    return () => { window.removeEventListener("storage", handler); bc.close(); clearInterval(iv); };
  }, [reload]);
  return [msgs, reload] as const;
}

// ---- global chat ----
export interface GlobalMessage {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: number;
}

export function getGlobalChat(): GlobalMessage[] { return get(GLOBAL_CHAT_KEY, []); }
export function sendGlobalMessage(senderId: number, senderName: string, content: string) {
  const msgs = getGlobalChat();
  msgs.push({ id: `${Date.now()}_${Math.random()}`, senderId, senderName, content, timestamp: Date.now() });
  if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
  set(GLOBAL_CHAT_KEY, msgs);
  notify("global_chat");
}
export function useGlobalChatMessages() {
  const [msgs, setMsgs] = useState<GlobalMessage[]>(getGlobalChat);
  const reload = useCallback(() => setMsgs(getGlobalChat()), []);
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener("storage", handler);
    const bc = new BroadcastChannel("senda_sync");
    bc.onmessage = (ev) => { if (ev.data?.type === "global_chat") reload(); };
    const iv = setInterval(reload, 2000);
    return () => { window.removeEventListener("storage", handler); bc.close(); clearInterval(iv); };
  }, [reload]);
  return [msgs, reload] as const;
}

// ---- online players ----
export interface OnlinePlayer {
  id: number;
  name: string;
  online: boolean;
  lastSeen: number;
}

export function getOnlinePlayers(myId: number): OnlinePlayer[] {
  const all = get<OnlinePlayer[]>(ONLINE_KEY, []);
  const now = Date.now();
  return all.filter(p => p.id !== myId && now - p.lastSeen < 30000);
}
export function setPlayerOnline(id: number, name: string) {
  const all = get<OnlinePlayer[]>(ONLINE_KEY, []);
  const idx = all.findIndex(p => p.id === id);
  const entry: OnlinePlayer = { id, name, online: true, lastSeen: Date.now() };
  if (idx >= 0) all[idx] = entry; else all.push(entry);
  set(ONLINE_KEY, all);
  notify("online");
}
export function setPlayerOffline(id: number) {
  const all = get<OnlinePlayer[]>(ONLINE_KEY, []);
  const idx = all.findIndex(p => p.id === id);
  if (idx >= 0) { all[idx] = { ...all[idx], online: false, lastSeen: Date.now() }; set(ONLINE_KEY, all); notify("online"); }
}
export function useOnlinePlayersList(myId: number) {
  const [players, setPlayers] = useState<OnlinePlayer[]>(() => getOnlinePlayers(myId));
  const reload = useCallback(() => setPlayers(getOnlinePlayers(myId)), [myId]);
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener("storage", handler);
    const bc = new BroadcastChannel("senda_sync");
    bc.onmessage = (ev) => { if (ev.data?.type === "online") reload(); };
    const iv = setInterval(reload, 5000);
    return () => { window.removeEventListener("storage", handler); bc.close(); clearInterval(iv); };
  }, [reload]);
  return [players, reload] as const;
}
