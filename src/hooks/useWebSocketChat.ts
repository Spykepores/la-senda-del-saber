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

// WebSocket config - auto-detect if running with backend
function getWsUrl(): string | null {
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!isLocalhost) return null;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//localhost:3001`;
}

export function useWebSocketChat(channel: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    lsLoadMessages().filter((m) => m.channel === channel)
  );
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef(channel);
  const userRef = useRef<{ id: number; name: string } | null>(null);

  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  // localStorage cross-tab sync
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

  // WebSocket connection
  useEffect(() => {
    const wsUrl = getWsUrl();
    if (!wsUrl) {
      setConnected(false);
      const interval = setInterval(() => {
        const all = lsLoadMessages();
        setMessages(all.filter((m) => m.channel === channelRef.current));
      }, 1000);
      return () => clearInterval(interval);
    }

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
                id: `${data.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
                senderId: data.senderId,
                senderName: data.senderName,
                content: data.content,
                timestamp: data.timestamp,
                channel: data.room,
              };
              setMessages((prev) => [...prev, msg]);
              const all = lsLoadMessages();
              all.push(msg);
              lsSaveMessages(all);
            } else if (data.type === "history" && data.room === channelRef.current) {
              const historyMsgs: ChatMessage[] = (data.messages || []).map((m: any) => ({
                id: `${m.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
                senderId: m.senderId,
                senderName: m.senderName,
                content: m.content,
                timestamp: m.timestamp,
                channel: data.room,
              }));
              setMessages(historyMsgs);
              lsSaveMessages([...lsLoadMessages().filter((m) => m.channel !== data.room), ...historyMsgs]);
            } else if (data.type === "ping") {
              ws?.send(JSON.stringify({ type: "pong" }));
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false);
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
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      ws?.close();
    };
  }, []);

  // Join channel when it changes
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
      userRef.current = { id: senderId, name: senderName };

      const msg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  return { messages, send: sendMessage, connected };
}
