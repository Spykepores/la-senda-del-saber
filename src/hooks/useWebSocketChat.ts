import { useState, useEffect, useRef, useCallback } from "react";

// Profanity filter - Spanish & English bad words
const BAD_WORDS = [
  "puta", "puto", "mierda", "chinga", "chingar", "pendejo", "pendeja", "cabron", "cabron",
  "joder", "cono", "maricon", "mamon", "culero", "estupido", "estupido", "estupida", "estupida",
  "idiota", "imbecil", "imbecil", "gilipollas", "tonto", "tonta", "maldito", "maldita",
  "verga", "polla", "cojones", "huevon", "pinche", "malparido", "hijueputa", "hp",
  "pirobo", "gonorrea", "chimba", "careverga", "cagada", "mamahuevo", "soplapollas",
  "fuck", "shit", "bitch", "asshole", "bastard", "damn", "hell", "crap", "dick", "cock",
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

export interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: number;
  channel: string;
}

export interface OnlineUser {
  id: number;
  name: string;
}

// localStorage fallback keys
const LS_MESSAGES = "senda_chat_messages";
const MAX_MESSAGES = 200;

function lsLoadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LS_MESSAGES);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return [];
}

function lsSaveMessages(msgs: ChatMessage[]) {
  localStorage.setItem(LS_MESSAGES, JSON.stringify(msgs.slice(-MAX_MESSAGES)));
}

// WebSocket config
// 1) VITE_WS_URL tiene prioridad (produccion, ej: wss://mi-servidor.com)
// 2) Mismo hostname de la pagina en puerto 3001: funciona en localhost Y en red local
//    (si un amigo abre http://192.168.1.10:5173, se conecta a ws://192.168.1.10:3001)
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
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef(channel);
  const userRef = useRef<{ id: number; name: string } | null>(null);

  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  // Registrar el usuario actual para presencia (join inmediato si ya hay conexion)
  useEffect(() => {
    if (!userId) return;
    userRef.current = { id: userId, name: userName || `Jugador #${userId}` };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "join",
        room: channelRef.current,
        senderId: userRef.current.id,
        senderName: userRef.current.name,
      }));
    }
  }, [userId, userName]);

  // localStorage cross-tab sync (fallback offline: solo pestanas del mismo navegador)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_MESSAGES) {
        const all = lsLoadMessages();
        setMessages(all.filter((m) => m.channel === channelRef.current));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // WebSocket connection (con reconexion automatica)
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
              type: "join",
              room: channelRef.current,
              senderId: userRef.current.id,
              senderName: userRef.current.name,
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "chat" && data.room === channelRef.current) {
              const msg: ChatMessage = {
                id: makeId(data.timestamp),
                senderId: data.senderId,
                senderName: data.senderName,
                content: data.content,
                timestamp: data.timestamp,
                channel: data.room,
              };
              // Dedupe: no agregar si ya existe (proteccion contra eco propio)
              setMessages((prev) => {
                if (prev.some((m) => m.senderId === msg.senderId && m.timestamp === msg.timestamp)) return prev;
                return [...prev, msg];
              });
              const all = lsLoadMessages();
              if (!all.some((m) => m.senderId === msg.senderId && m.timestamp === msg.timestamp)) {
                all.push(msg);
                lsSaveMessages(all);
              }
            } else if ((data.type === "welcome" || data.type === "history") && data.room === channelRef.current) {
              // Historial del servidor + lista de usuarios actuales
              const historyMsgs: ChatMessage[] = (data.messages || []).map((m: any) => ({
                id: makeId(m.timestamp),
                senderId: m.senderId,
                senderName: m.senderName,
                content: m.content,
                timestamp: m.timestamp,
                channel: data.room,
              }));
              setMessages(historyMsgs);
              lsSaveMessages([...lsLoadMessages().filter((m) => m.channel !== data.room), ...historyMsgs]);
              if (Array.isArray(data.users)) setOnlineUsers(data.users);
            } else if (data.type === "roster" && data.room === channelRef.current) {
              // Lista actualizada de usuarios en la sala
              setOnlineUsers(Array.isArray(data.users) ? data.users : []);
            } else if (data.type === "ping") {
              ws?.send(JSON.stringify({ type: "pong" }));
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false);
          setOnlineUsers([]);
          wsRef.current = null;
          if (!closed && !reconnectTimer.current) {
            reconnectTimer.current = setTimeout(() => {
              reconnectTimer.current = null;
              connect();
            }, 3000);
          }
        };

        ws.onerror = () => ws?.close();
      } catch {
        setConnected(false);
      }
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      ws?.close();
    };
  }, []);

  // Fallback offline: polling de localStorage SOLO cuando no hay WebSocket
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => {
      const all = lsLoadMessages();
      setMessages(all.filter((m) => m.channel === channelRef.current));
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  // Join al cambiar de canal
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "join",
        room: channel,
        senderId: userRef.current.id,
        senderName: userRef.current.name,
      }));
    }
  }, [channel]);

  const sendMessage = useCallback(
    (senderId: number, senderName: string, content: string): boolean => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      const censored = censorText(trimmed);
      if (!userRef.current && senderId) {
        userRef.current = { id: senderId, name: senderName || "Anonimo" };
      }

      const msg: ChatMessage = {
        id: makeId(Date.now()),
        senderId,
        senderName: senderName || "Anonimo",
        content: censored,
        timestamp: Date.now(),
        channel: channelRef.current,
      };

      const all = lsLoadMessages();
      all.push(msg);
      lsSaveMessages(all);
      setMessages((prev) => [...prev, msg]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "chat",
          room: channelRef.current,
          senderId,
          senderName,
          content: censored,
          timestamp: msg.timestamp,
        }));
      } else {
        try { localStorage.setItem("senda_chat_trigger", Date.now().toString()); } catch { /* */ }
      }
      return true;
    },
    []
  );

  return { messages, send: sendMessage, connected, onlineUsers };
}
