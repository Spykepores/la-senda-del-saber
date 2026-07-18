import { useState, useEffect, useRef, useCallback } from "react";

export interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: number;
  channel: string;
}

export interface PresenceUser {
  id: number;
  name: string;
}

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

const LS_MESSAGES = "senda_chat_messages";
const LS_USERS = "senda_chat_users";
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

function getWsUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001`;
}

function makeId(ts: number): string {
  return `${ts}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useWebSocketChat(channel: string, userId: number = 0, userName: string = "") {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    lsLoadMessages().filter((m) => m.channel === channel)
  );
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [gameState, setGameState] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef(channel);
  const userRef = useRef<{ id: number; name: string } | null>(null);

  useEffect(() => { channelRef.current = channel; }, [channel]);

  useEffect(() => {
    if (!userId) return;
    userRef.current = { id: userId, name: userName || `Jugador #${userId}` };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "join", room: channelRef.current,
        senderId: userRef.current.id, senderName: userRef.current.name,
      }));
    }
  }, [userId, userName]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_MESSAGES) {
        const all = lsLoadMessages();
        setMessages(all.filter((m) => m.channel === channelRef.current));
      }
      if (e.key === LS_USERS) setUsers(lsLoadUsers());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

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
              type: "join", room: channelRef.current,
              senderId: userRef.current.id, senderName: userRef.current.name,
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "chat": {
                if (data.room === channelRef.current) {
                  const msg: ChatMessage = {
                    id: makeId(data.timestamp),
                    senderId: data.senderId, senderName: data.senderName,
                    content: data.content, timestamp: data.timestamp, channel: data.room,
                  };
                  setMessages((prev) => {
                    if (prev.some((m) => m.senderId === msg.senderId && m.timestamp === msg.timestamp)) return prev;
                    return [...prev, msg];
                  });
                  const all = lsLoadMessages();
                  if (!all.some((m) => m.senderId === msg.senderId && m.timestamp === msg.timestamp)) {
                    all.push(msg); lsSaveMessages(all);
                  }
                }
                break;
              }
              case "welcome":
              case "history": {
                if (data.room === channelRef.current) {
                  const historyMsgs: ChatMessage[] = (data.messages || []).map((m: any) => ({
                    id: makeId(m.timestamp),
                    senderId: m.senderId, senderName: m.senderName,
                    content: m.content, timestamp: m.timestamp, channel: data.room,
                  }));
                  setMessages(historyMsgs);
                  lsSaveMessages([...lsLoadMessages().filter((m) => m.channel !== data.room), ...historyMsgs]);
                  if (Array.isArray(data.users)) { setOnlineUsers(data.users); lsSaveUsers(data.users); }
                }
                break;
              }
              case "roomUsers": {
                if (data.room === channelRef.current) {
                  setOnlineUsers(Array.isArray(data.users) ? data.users : []);
                  lsSaveUsers(Array.isArray(data.users) ? data.users : []);
                }
                break;
              }
              case "state": {
                if (data.room === channelRef.current && data.state) setGameState(data.state);
                break;
              }
              case "ping": { ws?.send(JSON.stringify({ type: "pong" })); break; }
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false); setOnlineUsers([]); wsRef.current = null;
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
  }, []);

  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => {
      const all = lsLoadMessages();
      setMessages(all.filter((m) => m.channel === channelRef.current));
      setOnlineUsers(lsLoadUsers());
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "join", room: channel,
        senderId: userRef.current.id, senderName: userRef.current.name,
      }));
    }
  }, [channel]);

  const sendMessage = useCallback(
    (senderId: number, senderName: string, content: string): boolean => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      const censored = censorText(trimmed);
      if (!userRef.current && senderId) userRef.current = { id: senderId, name: senderName || "Anonimo" };

      const msg: ChatMessage = {
        id: makeId(Date.now()),
        senderId, senderName: senderName || "Anonimo",
        content: censored, timestamp: Date.now(), channel: channelRef.current,
      };

      const all = lsLoadMessages(); all.push(msg); lsSaveMessages(all);
      setMessages((prev) => [...prev, msg]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "chat", room: channelRef.current,
          senderId, senderName, content: censored, timestamp: msg.timestamp,
        }));
      } else {
        try { localStorage.setItem("senda_chat_trigger", Date.now().toString()); } catch { /* */ }
      }
      return true;
    }, []
  );

  return { messages, send: sendMessage, connected, onlineUsers, gameState };
}
