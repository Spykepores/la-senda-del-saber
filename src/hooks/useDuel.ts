import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/providers/trpc";

// ============================================================
// DUEL HOOKS - tRPC + WebSocket Bridge
// ============================================================

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const isDev = window.location.hostname === "localhost";
  if (isDev) return `${protocol}//localhost:3001`;
  return `${protocol}//${window.location.host}`;
}

/* ---- Load single challenge ---- */
export function useDuel(challengeId?: number) {
  const { data, isLoading } = trpc.duel.get.useQuery(
    { id: challengeId || 0 },
    { enabled: !!challengeId, refetchInterval: 2000 }
  );
  return { duel: data, isLoading };
}

/* ---- List all my challenges ---- */
export function useDuelList() {
  const { data, isLoading, refetch } = trpc.duel.list.useQuery();
  return { duels: data || [], isLoading, refetch };
}

/* ---- List public/open challenges (pending) ---- */
export function usePublicChallenges() {
  const { data: allDuels = [] } = useDuelList();
  const publicChallenges = allDuels.filter((c) => c.status === "pending");
  return { publicChallenges, isLoading: false };
}

/* ---- My active challenges ---- */
export function useMyChallenges() {
  const { data: allDuels = [] } = useDuelList();
  const myChallenges = allDuels.filter((c) => c.status !== "completed" && c.status !== "rejected");
  return { myChallenges, isLoading: false };
}

/* ---- Create a challenge ---- */
export function useCreateDuel() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.create.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { createDuel: mutateAsync, isPending };
}

/* ---- Join a challenge by room code ---- */
export function useJoinByCode() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.getByRoomCode.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { joinByCode: mutateAsync, isPending };
}

/* ---- Accept a challenge ---- */
export function useAcceptDuel() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.accept.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { acceptDuel: mutateAsync, isPending };
}

/* ---- Reject a challenge ---- */
export function useRejectDuel() {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.duel.reject.useMutation({
    onSuccess: () => utils.duel.list.invalidate(),
  });
  return { rejectDuel: mutateAsync, isPending };
}

/* ---- Get challenge details ---- */
export function useChallenge(challengeId?: number) {
  return useDuel(challengeId);
}

// ==========================================================
// CHAT: tRPC + WebSocket dual system
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
  return useChallengeChat(0);
}

// ==========================================================
// GLOBAL CHAT (WebSocket)
// ==========================================================
export function useWebSocketChat(channel: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          ws!.send(JSON.stringify({ type: "join-room", roomId: channel }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "chat-message": setMessages((prev) => [...prev, data.message]); break;
              case "room-users": setOnlineCount(data.users?.length || 0); break;
              case "ping": ws?.send(JSON.stringify({ type: "pong" })); break;
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (!closed && !reconnectTimer.current) {
            reconnectTimer.current = setTimeout(() => { reconnectTimer.current = null; connect(); }, 3000);
          }
        };

        ws.onerror = () => ws?.close();
      } catch { setConnected(false); }
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      ws?.close();
    };
  }, [channel]);

  const sendMessage = useCallback((content: string, _senderName?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat-message", roomId: channel, content }));
    }
  }, [channel]);

  return { messages, onlineCount, connected, sendMessage };
}

// ==========================================
// ONLINE PLAYERS (tRPC - real users from database)
// ==========================================
export function useOnlinePlayers(userId: number, userName: string) {
  const { data: allUsers = [] } = trpc.users.list.useQuery();

  // Heartbeat: marcar que este usuario esta activo en localStorage
  useEffect(() => {
    const beat = () => {
      try {
        const u = { id: userId, name: userName, lastSeen: Date.now() };
        localStorage.setItem("senda_online_heartbeat", JSON.stringify(u));
      } catch { /* */ }
    };
    beat();
    const interval = setInterval(beat, 10000);
    return () => clearInterval(interval);
  }, [userId, userName]);

  // Filtrar: excluir al usuario actual y mostrar todos los demas registrados
  const players = allUsers
    .filter((u) => u.id !== userId)
    .map((u) => ({ id: u.id, name: u.name || `Usuario #${u.id}`, online: true }));

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
