import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TIPOS
// ============================================================
export interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: number;
}

export interface PresenceUser {
  id: number;
  name: string;
  connected: boolean;
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
  players?: any[];
}

// ============================================================
// PROFANITY FILTER
// ============================================================
const BAD_WORDS = [
  "puta", "puto", "mierda", "chinga", "chingar", "pendejo", "pendeja", "cabron",
  "joder", "maricon", "mamon", "culero", "estupido", "estupida", "idiota", "imbecil",
  "gilipollas", "tonto", "tonta", "maldito", "maldita", "verga", "polla", "cojones",
  "huevon", "pinche", "malparido", "hijueputa", "hp", "pirobo", "gonorrea", "chimba",
  "careverga", "cagada", "mamahuevo", "soplapollas",
  "fuck", "shit", "bitch", "asshole", "bastard", "damn", "dick", "cock",
  "pussy", "whore", "slut", "retard", "stupid", "dumb", "moron", "loser",
];

function censorText(text: string): string {
  let censored = text;
  for (const word of BAD_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    censored = censored.replace(regex, "*".repeat(word.length));
  }
  return censored;
}

// ============================================================
// LOCALSTORAGE FALLBACK
// ============================================================
const LS_MESSAGES = "senda_chat_messages_v2";
const LS_USERS = "senda_chat_users_v2";
const MAX_MESSAGES = 200;

function lsLoadMessages(): ChatMessage[] {
  try { const raw = localStorage.getItem(LS_MESSAGES); if (raw) return JSON.parse(raw); } catch { /* */ }
  return [];
}
function lsSaveMessages(msgs: ChatMessage[]) {
  localStorage.setItem(LS_MESSAGES, JSON.stringify(msgs.slice(-MAX_MESSAGES)));
}
function lsLoadUsers(): PresenceUser[] {
  try { const raw = localStorage.getItem(LS_USERS); if (raw) return JSON.parse(raw); } catch { /* */ }
  return [];
}
function lsSaveUsers(users: PresenceUser[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

// ============================================================
// WEBSOCKET URL
// ============================================================
function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001`;
}

function makeId(ts: number): string {
  return `${ts}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// HOOK
// ============================================================
export function useWebSocketChat(channel: string, userId: number = 0, userName: string = "") {
  const [messages, setMessages] = useState<ChatMessage[]>(() => lsLoadMessages());
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>(() => lsLoadUsers());
  const [gameState, setGameState] = useState<WSGameState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef(channel);
  const userRef = useRef<{ id: number; name: string } | null>(null);

  useEffect(() => { channelRef.current = channel; }, [channel]);

  // Actualizar userRef cuando cambian props
  useEffect(() => {
    if (userId) {
      userRef.current = { id: userId, name: userName || `Jugador #${userId}` };
    }
  }, [userId, userName]);

  // localStorage cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_MESSAGES) setMessages(lsLoadMessages());
      if (e.key === LS_USERS) setOnlineUsers(lsLoadUsers());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // WebSocket connection
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
          // Join room
          if (userRef.current) {
            ws!.send(JSON.stringify({
              type: "join-room",
              roomId: channelRef.current,
              senderId: userRef.current.id,
              senderName: userRef.current.name,
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              // ---- CHAT ----
              case "chat-message": {
                if (data.message) {
                  const msg: ChatMessage = data.message;
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === msg.id)) return prev;
                    return [...prev, msg];
                  });
                  // Persist
                  const all = lsLoadMessages();
                  if (!all.some((m) => m.id === msg.id)) { all.push(msg); lsSaveMessages(all); }
                }
                break;
              }

              // ---- HISTORY ----
              case "game-state": {
                if (data.history) {
                  const historyMsgs: ChatMessage[] = data.history.map((m: any) => ({
                    id: m.id || makeId(m.timestamp),
                    senderId: m.senderId,
                    senderName: m.senderName,
                    content: m.content,
                    timestamp: m.timestamp,
                  }));
                  setMessages(historyMsgs);
                  lsSaveMessages(historyMsgs);
                }
                if (data.users) {
                  setOnlineUsers(data.users);
                  lsSaveUsers(data.users);
                }
                if (data.state) {
                  setGameState(data.state);
                }
                break;
              }

              // ---- ROOM USERS ----
              case "room-users": {
                if (data.users) {
                  setOnlineUsers(data.users);
                  lsSaveUsers(data.users);
                }
                break;
              }

              // ---- PRESENCE ----
              case "presence": {
                // Trigger user refresh
                break;
              }

              // ---- GAME EVENTS ----
              case "game-start":
              case "next-turn":
              case "wheel-result":
              case "correct":
              case "wrong":
              case "game-over":
              case "score-update":
              case "timer": {
                if (data.state) setGameState(data.state);
                break;
              }

              // ---- HEARTBEAT ----
              case "ping": {
                ws?.send(JSON.stringify({ type: "pong" }));
                break;
              }
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false);
          setOnlineUsers([]);
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

  // Fallback polling cuando no hay WebSocket
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => {
      setMessages(lsLoadMessages());
      setOnlineUsers(lsLoadUsers());
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  // ---- ACTIONS ----

  const joinRoom = useCallback((uid: number, uname: string) => {
    userRef.current = { id: uid, name: uname };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join-room", roomId: channelRef.current, senderId: uid, senderName: uname }));
    }
  }, []);

  const sendMessage = useCallback((senderId: number, senderName: string, content: string): boolean => {
    const trimmed = content.trim();
    if (!trimmed) return false;
    const censored = censorText(trimmed);
    if (!userRef.current) userRef.current = { id: senderId, name: senderName };

    const msg: ChatMessage = { id: makeId(Date.now()), senderId, senderName: senderName || "Anonimo", content: censored, timestamp: Date.now() };
    const all = lsLoadMessages(); all.push(msg); lsSaveMessages(all);
    setMessages((prev) => [...prev, msg]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat-message", roomId: channelRef.current, content: censored }));
    } else {
      try { localStorage.setItem("senda_chat_trigger", Date.now().toString()); } catch { /* */ }
    }
    return true;
  }, []);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userRef.current) {
      wsRef.current.send(JSON.stringify({ type: "typing", roomId: channelRef.current, senderId: userRef.current.id }));
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userRef.current) {
      wsRef.current.send(JSON.stringify({ type: "leave-room", roomId: channelRef.current, senderId: userRef.current.id }));
    }
  }, []);

  return { messages, send: sendMessage, connected, onlineUsers, gameState, joinRoom, sendTyping, leaveRoom };
}
