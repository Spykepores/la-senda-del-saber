import { useState, useEffect, useCallback } from "react";
import { useChallengeSealsGame, SEALS_TO_BREAK } from "./useChallengeSealsGame";
import { trpc } from "@/providers/trpc";
import { useWebSocketChat } from "./useWebSocketChat";

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
  roomCode?: string | null;
}

export interface DuelState {
  challengeId: number;
  phase: GamePhase;
  currentPlayer: number;
  challengerSeals: number[];
  opponentSeals: number[];
  challengerScore: number;
  opponentScore: number;
  currentCategory: string | null;
  diceValue: number | null;
  round: number;
  timer: number;
  timerActive: boolean;
  winner: number | null;
  forfeitBy: number | null;
}

// LocalStorage helpers
function getLocalChallenges(): LocalChallenge[] {
  try { return JSON.parse(localStorage.getItem("senda_challenges") || "[]"); } catch { return []; }
}
function saveLocalChallenges(list: LocalChallenge[]) {
  localStorage.setItem("senda_challenges", JSON.stringify(list));
}
function getLocalUser() {
  try { return JSON.parse(localStorage.getItem("senda_local_user") || "null"); } catch { return null; }
}

// ==========================================================
// DUEL HOOKS
// ==========================================================
export function useDuel(userId: number) {
  const { data, isLoading, refetch } = trpc.duel.list.useQuery();
  const myId = userId;
  const myChallenges =
    data?.filter(
      (c) =>
        c.challengerId === myId ||
        c.opponentId === myId
    ) || [];

  return {
    challenges: myChallenges,
    isLoading,
    refetch,
    myId,
  };
}

export function useChallenge(challengeId: number) {
  const { data, isLoading } = trpc.duel.get.useQuery(
    { id: challengeId },
    { enabled: challengeId > 0 }
  );
  return { challenge: data, isLoading };
}

export function useCreateDuel() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.create.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { createDuel: mutateAsync, isPending };
}

export function useJoinByCode() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.getByRoomCode.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { joinByCode: mutateAsync, isPending };
}

export function useAcceptDuel() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.accept.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { acceptDuel: mutateAsync, isPending };
}

export function useRejectDuel() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.reject.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { rejectDuel: mutateAsync, isPending };
}

export function useForfeitDuel() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.forfeit.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { forfeitDuel: mutateAsync, isPending };
}

// ==========================================================
// ONLINE PLAYERS
// ==========================================================
export function useOnlinePlayers(userId: number, userName: string) {
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    const heartbeat = () => {
      try {
        const u = JSON.parse(localStorage.getItem("senda_local_user") || "{}");
        if (u.id) {
          const all = JSON.parse(localStorage.getItem("senda_online_players") || "[]");
          const idx = all.findIndex((p: any) => p.id === u.id);
          if (idx >= 0) all[idx] = { id: u.id, name: u.name || "Jugador", lastSeen: Date.now(), online: true };
          else all.push({ id: u.id, name: u.name || "Jugador", lastSeen: Date.now(), online: true });
          localStorage.setItem("senda_online_players", JSON.stringify(all));
        }
      } catch { /* */ }
    };
    heartbeat();
    const interval = setInterval(heartbeat, 5000);

    const loadPlayers = () => {
      try {
        const cutoff = Date.now() - 30000;
        const all = JSON.parse(localStorage.getItem("senda_online_players") || "[]");
        setPlayers(all.filter((p: any) => p.id !== userId && p.online && p.lastSeen > cutoff));
      } catch { setPlayers([]); }
    };
    loadPlayers();
    const poll = setInterval(loadPlayers, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(poll);
      try {
        const all = JSON.parse(localStorage.getItem("senda_online_players") || "[]");
        const idx = all.findIndex((p: any) => p.id === userId);
        if (idx >= 0) { all[idx] = { ...all[idx], online: false, lastSeen: Date.now() }; localStorage.setItem("senda_online_players", JSON.stringify(all)); }
      } catch { /* */ }
    };
  }, [userId, userName]);

  return players;
}

// ==========================================================
// CHAT: WS + tRPC dual system
// ==========================================================
export function useChallengeChat(challengeId?: number) {
  const [messages, setMessages] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!challengeId) return;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: "join-room", roomId: `duel_${challengeId}` }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat-message") {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch { /* */ }
    };

    ws.onclose = () => setWsConnected(false);
    return () => ws.close();
  }, [challengeId]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat-message", roomId: `duel_${challengeId}`, content }));
    }
  }, [challengeId]);

  return { messages, sendMessage, wsConnected };
}

export function useGlobalChat() {
  const { messages, send, connected } = useWebSocketChat("global");
  return { messages, sendMessage: send, wsConnected: connected };
}

// ==========================================================
// EXPORT/IMPORT
// ==========================================================
export function exportChallengeState(challengeId?: number): string {
  return "";
}

export function importChallengeState(_json?: string): { success: boolean; challengeId?: number; error?: string } {
  return { success: false, error: "Usa el sistema online" };
}

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (window.location.hostname === "localhost") return `${protocol}//localhost:3001`;
  return `${protocol}//${window.location.host}`;
}
