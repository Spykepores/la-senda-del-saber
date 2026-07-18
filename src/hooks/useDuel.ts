import { useState, useEffect, useCallback } from "react";
import { useChallengeSealsGame, SEALS_TO_BREAK } from "./useChallengeSealsGame";
import { trpc } from "@/providers/trpc";

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

// ==========================================
// GAMEPLAY (usa WebSocket + tRPC)
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
    question: game.question,
  };
}

// ==========================================
// LIST ALL CHALLENGES (tRPC)
// ==========================================
export function useDuelList() {
  const { data, isLoading, refetch } = trpc.duel.list.useQuery();
  return { data: data || [], isLoading, reload: refetch };
}

// ==========================================
// PUBLIC CHALLENGES (tRPC)
// ==========================================
export function usePublicChallenges(_myId?: number) {
  const { data } = trpc.duel.listPublic.useQuery();
  return data || [];
}

// ==========================================
// MY CHALLENGES (tRPC)
// ==========================================
export function useMyChallenges(_myId?: number) {
  const { data } = trpc.duel.listMine.useQuery();
  return data || [];
}

// ==========================================
// CREATE CHALLENGE (tRPC)
// ==========================================
export function useCreateDuel() {
  const utils = trpc.useUtils();
  const mutation = trpc.duel.create.useMutation({
    onSuccess: () => {
      utils.duel.list.invalidate();
      utils.duel.listPublic.invalidate();
      utils.duel.listMine.invalidate();
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

// ==========================================
// JOIN CHALLENGE (tRPC)
// ==========================================
export function useJoinDuel() {
  const utils = trpc.useUtils();
  const mutation = trpc.duel.join.useMutation({
    onSuccess: () => {
      utils.duel.list.invalidate();
      utils.duel.listMine.invalidate();
      utils.duel.listPublic.invalidate();
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

// ==========================================
// ACCEPT CHALLENGE (tRPC)
// ==========================================
export function useAcceptDuel() {
  const utils = trpc.useUtils();
  const mutation = trpc.duel.accept.useMutation({
    onSuccess: () => {
      utils.duel.list.invalidate();
      utils.duel.listMine.invalidate();
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

// ==========================================
// REJECT CHALLENGE (tRPC)
// ==========================================
export function useRejectDuel() {
  const utils = trpc.useUtils();
  const mutation = trpc.duel.forfeit.useMutation({
    onSuccess: () => {
      utils.duel.list.invalidate();
      utils.duel.listMine.invalidate();
    },
  });

  return {
    mutateAsync: async (challengeId: number) => {
      await mutation.mutateAsync({ challengeId });
    },
    isPending: mutation.isPending,
  };
}

// ==========================================
// GET SINGLE CHALLENGE (tRPC)
// ==========================================
export function useChallenge(id: number) {
  const { data, isLoading } = trpc.duel.get.useQuery(
    { challengeId: id },
    { enabled: id > 0 }
  );

  const challenge: LocalChallenge | undefined = data
    ? {
        id: data.id,
        challengerId: data.challengerId,
        challengerName: data.challengerName || "",
        opponentId: data.opponentId || 0,
        opponentName: data.opponentName || "",
        status: data.status,
        winnerId: data.winnerId,
        createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        roomName: data.currentCategory || undefined,
        syncCode: data.roomCode || undefined,
        roomCode: data.roomCode,
      }
    : undefined;

  return { data: challenge, isLoading };
}

// ==========================================
// JOIN BY CODE (tRPC)
// ==========================================
export function useJoinByCode() {
  const utils = trpc.useUtils();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const joinMut = trpc.duel.join.useMutation({
    onSuccess: () => {
      utils.duel.list.invalidate();
      utils.duel.listMine.invalidate();
    },
  });
  const { data: foundChallenge } = trpc.duel.getByRoomCode.useQuery(
    { roomCode: roomCode.toUpperCase() },
    { enabled: roomCode.length === 6 }
  );

  const join = useCallback(async (code: string) => {
    setIsPending(true);
    setError(null);
    try {
      setRoomCode(code);
      // Wait a tick for the query to potentially resolve
      await new Promise(r => setTimeout(r, 100));
      // Use direct mutation approach
      const challenge = foundChallenge;
      if (!challenge) {
        // Try direct API call as fallback
        try {
          const result = await utils.client.duel.getByRoomCode.query({ roomCode: code.toUpperCase() });
          if (result && (!result.opponentId || result.opponentId === 0)) {
            await joinMut.mutateAsync({ challengeId: result.id });
            setIsPending(false);
            return result;
          }
        } catch { /* */ }
        setError("Codigo no encontrado o sala llena");
        setIsPending(false);
        return null;
      }
      if (challenge.opponentId && challenge.opponentId !== 0) { setError("Sala llena"); setIsPending(false); return null; }
      await joinMut.mutateAsync({ challengeId: challenge.id });
      setIsPending(false);
      return challenge;
    } catch (e: any) {
      setError(e.message || "Error al unirse");
      setIsPending(false);
      return null;
    }
  }, [joinMut, foundChallenge]);

  return { join, isPending, error };
}

// ==========================================
// CHAT (tRPC)
// ==========================================
export function useChallengeChat(challengeId: number) {
  const { data: messages = [] } = trpc.duel.getMessages.useQuery({ challengeId });
  const sendMut = trpc.duel.sendMessage.useMutation({
    onSuccess: () => {
      trpc.useUtils().duel.getMessages.invalidate({ challengeId });
    },
  });

  const send = useCallback((_senderId: number, _senderName: string, content: string) => {
    sendMut.mutate({ challengeId, content });
  }, [sendMut, challengeId]);

  return { messages, send };
}

// ==========================================
// GLOBAL CHAT (WebSocket)
// ==========================================
export function useGlobalChat() {
  const { messages, send, connected } = useWebSocketChat("global");

  const sendGlobal = useCallback((_: number, __: string, content: string) => {
    send(_, __, content);
  }, [send]);

  return { messages, send: sendGlobal, connected };
}

// ==========================================
// ONLINE PLAYERS (localStorage fallback)
// ==========================================
export function useOnlinePlayers(userId: number, userName: string) {
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    // Usar polling de localStorage para compatibilidad
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

// ==========================================
// FORFEIT (tRPC + WebSocket)
// ==========================================
export function useForfeitDuel() {
  const forfeitMut = trpc.duel.forfeit.useMutation();

  const mutate = useCallback((challengeId: number) => {
    forfeitMut.mutate({ challengeId });
  }, [forfeitMut]);

  return { mutate, isPending: forfeitMut.isPending };
}

// ==========================================
// Export/Import (deprecated - keep for compatibility)
// ==========================================
export function exportChallengeState(_challengeId?: number): string {
  return "";
}

export function importChallengeState(_json?: string): { success: boolean; challengeId?: number; error?: string } {
  return { success: false, error: "Usa el sistema online" };
}

// Lazy import to avoid circular dependency
function useWebSocketChat(channel: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useWebSocketChat: hook } = require("./useWebSocketChat");
  return hook(channel);
}
