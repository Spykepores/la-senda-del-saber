import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TIPOS
// ============================================================
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
  connected: boolean;
  score: number;
  seals: Record<string, number>;
  brokenCount: number;
  correctCount: number;
  wrongCount: number;
  diceValue?: number;
  ready: boolean;
}

export interface WSGameState {
  roomId: string;
  turn: number;
  round: number;
  phase: string;
  currentCategory?: string;
  wheelAngle?: number;
  wheelResult?: string;
  timer: number;
  timerActive: boolean;
  winnerId?: number | null;
  forfeitBy?: number;
  winReason?: string;
  lastAnswerCorrect?: boolean;
  diceRolled: boolean;
  started: boolean;
  players?: WSPlayer[];
}

export interface WSPresenceUser {
  id: number;
  name: string;
  connected: boolean;
}

export interface WheelResult {
  angle: number;
  category: string;
  categoryName: string;
}

// ============================================================
// WEBSOCKET URL
// ============================================================
function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001`;
}

// ============================================================
// HOOK
// ============================================================
export function useWebSocketGame(roomId: string) {
  const [messages, setMessages] = useState<WSChatMessage[]>([]);
  const [users, setUsers] = useState<WSPresenceUser[]>([]);
  const [gameState, setGameState] = useState<WSGameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [wheelResult, setWheelResult] = useState<WheelResult | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef(roomId);
  const userRef = useRef<{ id: number; name: string } | null>(null);

  useEffect(() => { roomRef.current = roomId; }, [roomId]);

  useEffect(() => {
    const wsUrl = getWsUrl();
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
            ws!.send(JSON.stringify({
              type: "join-room",
              roomId: roomRef.current,
              senderId: userRef.current.id,
              senderName: userRef.current.name,
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "chat-message": {
                if (data.message) setMessages((prev) => [...prev, data.message]);
                break;
              }
              case "game-state": {
                if (data.state) setGameState(data.state);
                if (data.history) setMessages(data.history);
                if (data.users) setUsers(data.users);
                break;
              }
              case "room-users": {
                if (data.users) setUsers(data.users);
                break;
              }
              case "wheel-result": {
                if (data.wheelResult) setWheelResult(data.wheelResult);
                if (data.state) setGameState(data.state);
                break;
              }
              case "game-start":
              case "next-turn":
              case "correct":
              case "wrong":
              case "game-over":
              case "score-update": {
                if (data.state) setGameState(data.state);
                break;
              }
              case "timer": {
                if (data.timer) {
                  setGameState((prev) => prev ? { ...prev, timer: data.timer.remaining, timerActive: data.timer.active } : null);
                }
                break;
              }
              case "presence": { break; }
              case "ping": { ws?.send(JSON.stringify({ type: "pong" })); break; }
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false);
          setUsers([]);
          wsRef.current = null;
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

  // ---- ACTIONS ----

  const join = useCallback((userId: number, userName: string) => {
    userRef.current = { id: userId, name: userName };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join-room", roomId: roomRef.current, senderId: userId, senderName: userName }));
    }
  }, []);

  const sendChat = useCallback((content: string): boolean => {
    if (!content.trim() || !userRef.current) return false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat-message", roomId: roomRef.current, content: content.trim() }));
      return true;
    }
    return false;
  }, []);

  const rollDice = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "dice", roomId: roomRef.current }));
    }
  }, []);

  const spinWheel = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "spin-wheel", roomId: roomRef.current }));
    }
  }, []);

  const submitAnswer = useCallback((correct: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "answer", roomId: roomRef.current, correct }));
    }
  }, []);

  const continueTurn = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "next-turn", roomId: roomRef.current }));
    }
  }, []);

  const forfeit = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "game-over", roomId: roomRef.current }));
    }
  }, []);

  const setReady = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userRef.current) {
      wsRef.current.send(JSON.stringify({ type: "player-ready", roomId: roomRef.current, senderId: userRef.current.id }));
    }
  }, []);

  const startGame = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userRef.current) {
      wsRef.current.send(JSON.stringify({ type: "game-start", roomId: roomRef.current, senderId: userRef.current.id }));
    }
  }, []);

  return {
    messages, users, gameState, connected, wheelResult,
    join, sendChat, rollDice, spinWheel, submitAnswer,
    continueTurn, forfeit, setReady, startGame,
  };
}
