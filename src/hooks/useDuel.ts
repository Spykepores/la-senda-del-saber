import { useState, useEffect, useCallback } from "react";
import { useChallengeSealsGame, SEALS_TO_BREAK } from "./useChallengeSealsGame";
import {
  saveChallenge, updateChallenge, getChallengeById,
  getChallengeByCode, generateSyncCode, generateId,
  sendGlobalMessage,
  getChallengeChat, sendChallengeMessage,
  setPlayerOnline, setPlayerOffline, getOnlinePlayers,
  useChallenges, useGlobalChatMessages, useOnlinePlayersList, useChallengeChatMessages,
} from "@/lib/sync";

export type GamePhase = "waiting_opponent" | "my_turn" | "opponent_turn" | "finished";

export interface LocalChallenge {
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

function getUser(): { id: number; name: string } {
  try {
    const u = JSON.parse(localStorage.getItem("senda_local_user") || "{}");
    return { id: u.id || 0, name: u.name || `Jugador #${u.id || 0}` };
  } catch { return { id: 0, name: "Jugador" }; }
}

// ==========================================
// GAMEPLAY
// ==========================================
export function useDuel(challengeId: number, userId: number) {
  const game = useChallengeSealsGame(challengeId, userId);
  const myB = game.myState ? Object.values(game.myState.seals).filter(v => v >= SEALS_TO_BREAK).length : 0;
  const oppB = game.oppState ? Object.values(game.oppState.seals).filter(v => v >= SEALS_TO_BREAK).length : 0;

  let phase: GamePhase = "waiting_opponent";
  if (game.isFinished) phase = "finished";
  else if (game.isMyTurn && game.phase === "waiting") phase = "my_turn";
  else if (game.isMyTurn && (game.phase === "question" || game.phase === "roulette" || game.phase === "result")) phase = "my_turn";
  else if (!game.isMyTurn && !game.isFinished) phase = "opponent_turn";

  return {
    state: game.state as any, phase, isLoading: !game.state,
    myBroken: myB, oppBroken: oppB,
    submitAnswer: game.submitAnswer, forfeit: game.forfeit,
    timeLeft: game.timeLeft, timerPct: game.timerPct, timerColor: game.timerColor,
    currentCategory: game.currentCategory,
    startTurn: game.startTurn, onRouletteComplete: game.onRouletteComplete,
    continueAfterCorrect: game.continueAfterCorrect,
    isMyTurn: game.isMyTurn, isFinished: game.isFinished, gamePhase: game.phase,
    diceRolled: game.diceRolled, myDice: game.myDice, oppDice: game.oppDice,
    diceWinnerId: game.diceWinnerId, rollDice: game.rollDice,
  };
}

// ==========================================
// LIST ALL CHALLENGES (localStorage + BroadcastChannel)
// ==========================================
export function useDuelList() {
  const [challenges, reload] = useChallenges();
  const active = challenges.filter((c: any) => c.status === "pending" || c.status === "active");
  return { data: active, isLoading: false, reload };
}

// ==========================================
// PUBLIC CHALLENGES (open rooms)
// ==========================================
export function usePublicChallenges(myId: number) {
  const [challenges] = useChallenges();
  return challenges.filter((c: any) =>
    c.status === "active" &&
    (c.opponentId === 0 || !c.opponentId) &&
    c.challengerId !== myId
  );
}

// ==========================================
// MY CHALLENGES
// ==========================================
export function useMyChallenges(myId: number) {
  const [challenges] = useChallenges();
  return challenges.filter((c: any) =>
    c.challengerId === myId || c.opponentId === myId
  );
}

// ==========================================
// CREATE CHALLENGE
// ==========================================
export function useCreateDuel() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (input: { opponentId?: number; name?: string }) => {
    setIsPending(true);
    const user = getUser();
    const id = generateId();
    const syncCode = generateSyncCode();

    let opponentName = "";
    if (input.opponentId) {
      const players = getOnlinePlayers(user.id);
      const found = players.find((p: any) => p.id === input.opponentId);
      if (found) opponentName = found.name;
    }

    const challenge: LocalChallenge = {
      id,
      challengerId: user.id,
      challengerName: user.name,
      opponentId: input.opponentId || 0,
      opponentName,
      status: input.opponentId ? "pending" : "active",
      createdAt: Date.now(),
      roomName: input.name || `Sala de ${user.name}`,
      syncCode,
    };

    saveChallenge(challenge);
    setIsPending(false);
    return { id, status: challenge.status, syncCode };
  }, []);

  return { mutateAsync, isPending };
}

// ==========================================
// JOIN CHALLENGE
// ==========================================
export function useJoinDuel() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (input: { challengeId: number }) => {
    setIsPending(true);
    const user = getUser();
    updateChallenge(input.challengeId, {
      opponentId: user.id,
      opponentName: user.name,
      status: "active",
    });
    setIsPending(false);
    return { success: true };
  }, []);

  return { mutateAsync, isPending };
}

// ==========================================
// ACCEPT CHALLENGE
// ==========================================
export function useAcceptDuel() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (input: { challengeId: number }) => {
    setIsPending(true);
    const user = getUser();
    updateChallenge(input.challengeId, {
      opponentId: user.id,
      opponentName: user.name,
      status: "active",
    });
    setIsPending(false);
    return { success: true };
  }, []);

  return { mutateAsync, isPending };
}

// ==========================================
// REJECT CHALLENGE
// ==========================================
export function useRejectDuel() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (challengeId: number) => {
    setIsPending(true);
    updateChallenge(challengeId, { status: "cancelled" });
    setIsPending(false);
  }, []);

  return { mutateAsync, isPending };
}

// ==========================================
// GET SINGLE CHALLENGE
// ==========================================
export function useChallenge(id: number) {
  const [challenge, setChallenge] = useState<LocalChallenge | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id <= 0) return;
    setIsLoading(true);

    const load = () => {
      const found = getChallengeById(id);
      if (found) setChallenge(found);
      setIsLoading(false);
    };
    load();

    // Listen for changes
    const bc = new BroadcastChannel("senda_sync");
    bc.onmessage = (ev) => {
      if (ev.data?.type === "challenges") load();
    };

    // Polling
    const interval = setInterval(load, 1000);

    return () => { clearInterval(interval); bc.close(); };
  }, [id]);

  return { data: challenge, isLoading };
}

// ==========================================
// JOIN BY CODE
// ==========================================
export function useJoinByCode() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (code: string) => {
    setIsPending(true);
    setError(null);

    const challenge = getChallengeByCode(code);
    if (!challenge) { setError("Codigo no encontrado"); setIsPending(false); return null; }
    if (challenge.opponentId && challenge.opponentId !== 0) { setError("Sala llena"); setIsPending(false); return null; }

    const user = getUser();
    if (challenge.challengerId === user.id) { setError("No puedes unirte a tu propia sala"); setIsPending(false); return null; }

    updateChallenge(challenge.id, { opponentId: user.id, opponentName: user.name, status: "active" });
    setIsPending(false);
    return { ...challenge, opponentId: user.id, opponentName: user.name, status: "active" };
  }, []);

  return { join, isPending, error };
}

// ==========================================
// CHAT (per challenge)
// ==========================================
export function useChallengeChat(challengeId: number) {
  const [messages] = useChallengeChatMessages(challengeId);

  const send = useCallback((senderId: number, senderName: string, content: string) => {
    sendChallengeMessage(challengeId, senderId, senderName, content);
  }, [challengeId]);

  return { messages, send };
}

// ==========================================
// GLOBAL CHAT
// ==========================================
export function useGlobalChat() {
  const [messages] = useGlobalChatMessages();

  const send = useCallback((senderId: number, senderName: string, content: string) => {
    sendGlobalMessage(senderId, senderName, content);
  }, []);

  return { messages, send };
}

// ==========================================
// ONLINE PLAYERS
// ==========================================
export function useOnlinePlayers(userId: number, userName: string) {
  useEffect(() => {
    setPlayerOnline(userId, userName);
    const heartbeat = setInterval(() => setPlayerOnline(userId, userName), 5000);
    return () => { clearInterval(heartbeat); setPlayerOffline(userId); };
  }, [userId, userName]);

  const [players] = useOnlinePlayersList(userId);
  return players;
}

// ==========================================
// FORFEIT
// ==========================================
export function useForfeitDuel() {
  const mutate = useCallback((challengeId: number) => {
    const user = getUser();
    const challenge = getChallengeById(challengeId);
    if (challenge) {
      const winnerId = challenge.challengerId === user.id ? challenge.opponentId : challenge.challengerId;
      updateChallenge(challengeId, { status: "completed", winnerId });
    }
  }, []);

  return { mutate, isPending: false };
}

// ==========================================
// Export/Import for cross-device
// ==========================================
export function exportChallengeState(challengeId: number): string {
  const challenge = getChallengeById(challengeId);
  if (!challenge) return "";
  const chat = getChallengeChat(challengeId);
  const sealsKey = `senda_seals_${challengeId}`;
  const seals = localStorage.getItem(sealsKey) || "{}";
  return JSON.stringify({ challenge, chat, seals, version: 1 });
}

export function importChallengeState(json: string): { success: boolean; challengeId?: number; error?: string } {
  try {
    const data = JSON.parse(json);
    if (!data.challenge) return { success: false, error: "Datos invalidos" };
    saveChallenge(data.challenge);
    if (data.chat) localStorage.setItem(`senda_chat_${data.challenge.id}`, JSON.stringify(data.chat));
    if (data.seals) localStorage.setItem(`senda_seals_${data.challenge.id}`, data.seals);
    return { success: true, challengeId: data.challenge.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
