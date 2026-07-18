import { useState, useEffect, useRef, useCallback } from "react";

export interface WSChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: number;
}

export interface WSPlayer {
  id: number;
  name: string;
  seals: Record<string, number>;
  brokenCount: number;
  correctCount: number;
  wrongCount: number;
  totalTimeMs: number;
  diceValue?: number;
}

export interface WSGameState {
  roomId: string;
  players: WSPlayer[];
  hostId: number;
  turnId: number;
  phase: string;
  winnerId?: number | null;
  currentCategory?: string;
  questionStartTime: number;
  forfeitBy?: number;
  winReason?: string;
  lastAnswerCorrect?: boolean;
  diceRolled: boolean;
  status: string;
  createdAt: number;
}

export interface WSPresenceUser {
  id: number;
  name: string;
}

function getWsUrl(): string | null {
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!isLocalhost) return null;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//localhost:3001`;
}

export function useWebSocketGame(roomId: string) {
  const [messages, setMessages] = useState<WSChatMessage[]>([]);
  const [users, setUsers] = useState<WSPresenceUser[]>([]);
  const [gameState, setGameState] = useState<WSGameState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef(roomId);
  const userRef = useRef<{ id: number; name: string } | null>(null);

  useEffect(() => { roomRef.current = roomId; }, [roomId]);

  useEffect(() => {
    const wsUrl = getWsUrl();
    if (!wsUrl) { setConnected(false); return; }

    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          if (userRef.current) {
            ws!.send(JSON.stringify({ type: "join", room: roomRef.current, senderId: userRef.current.id, senderName: userRef.current.name }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "chat": {
                if (data.room === roomRef.current) {
                  setMessages((prev) => [...prev, { id: `${data.timestamp}-${Math.random().toString(36).slice(2, 8)}`, senderId: data.senderId, senderName: data.senderName, content: data.content, timestamp: data.timestamp }]);
                }
                break;
              }
              case "history": {
                if (data.room === roomRef.current && data.messages) {
                  setMessages(data.messages.map((m: any) => ({ id: `${m.timestamp}-${Math.random().toString(36).slice(2, 8)}`, senderId: m.senderId, senderName: m.senderName, content: m.content, timestamp: m.timestamp })));
                }
                break;
              }
              case "roomUsers": {
                if (data.room === roomRef.current) setUsers(data.users || []);
                break;
              }
              case "state": {
                if (data.room === roomRef.current && data.state) setGameState(data.state);
                break;
              }
              case "ping": { ws?.send(JSON.stringify({ type: "pong" })); break; }
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false); wsRef.current = null;
          if (!closed && !reconnectTimer.current) {
            reconnectTimer.current = setTimeout(() => { reconnectTimer.current = null; connect(); }, 3000);
          }
        };
        ws.onerror = () => ws?.close();
      } catch { setConnected(false); }
    };

    connect();
    return () => { closed = true; if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; } ws?.close(); };
  }, [roomId]);

  const join = useCallback((userId: number, userName: string) => {
    userRef.current = { id: userId, name: userName };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join", room: roomRef.current, senderId: userId, senderName: userName }));
    }
  }, []);

  const sendChat = useCallback((content: string): boolean => {
    if (!content.trim() || !userRef.current) return false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", room: roomRef.current, content: content.trim() }));
      return true;
    }
    return false;
  }, []);

  const rollDice = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "dice", room: roomRef.current }));
  }, []);

  const spinRoulette = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "roulette", room: roomRef.current }));
  }, []);

  const submitAnswer = useCallback((correct: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "answer", room: roomRef.current, correct }));
  }, []);

  const continueTurn = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "turn", room: roomRef.current }));
  }, []);

  const forfeit = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "forfeit", room: roomRef.current }));
  }, []);

  return { messages, users, gameState, connected, join, sendChat, rollDice, spinRoulette, submitAnswer, continueTurn, forfeit };
}
