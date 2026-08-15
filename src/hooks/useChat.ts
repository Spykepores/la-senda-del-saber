import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/providers/trpc";

export interface ChatMsg {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: Date;
  isPrivate?: boolean;
}

export interface ChatRoom {
  id: number;
  name: string;
  slug: string;
  isPrivate: boolean;
  inviteCode: string | null;
  createdBy: number;
  createdAt: Date;
}

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const isDev = window.location.hostname === "localhost";
  if (isDev) return `${protocol}//localhost:3001`;
  return `${protocol}//${window.location.host}`;
}

let MSG_COUNTER = 0;
function nextId() {
  return --MSG_COUNTER;
}

// ============================================================
// HOOK: Chat funciona CON o SIN WebSocket
// - Si WS conectado: tiempo real
// - Si WS desconectado: polling HTTP cada 2 segundos
// ============================================================
export function useChat(userId: number, userName: string) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ id: number; name: string }[]>([]);
  const [connected, setConnected] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string>("global");
  const [privateRecipient, setPrivateRecipient] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef({ id: userId, name: userName });

  userRef.current = { id: userId, name: userName };

  const utils = trpc.useUtils();

  // tRPC: list public rooms
  const { data: publicRooms = [] } = trpc.chat.listRooms.useQuery();

  // tRPC: get messages for active room (con polling automatico)
  const { data: roomMessages = [] } = trpc.chat.getMessages.useQuery(
    { roomSlug: activeRoom },
    { 
      enabled: activeRoom !== "dm" && activeRoom.length > 0,
      refetchInterval: connected ? false : 2000, // Poll cada 2s si WS desconectado
    }
  );

  // tRPC: get private messages (con polling automatico)
  const { data: privateMessages = [] } = trpc.chat.getPrivateMessages.useQuery(
    { otherUserId: privateRecipient || 0 },
    { 
      enabled: privateRecipient !== null && privateRecipient > 0,
      refetchInterval: connected ? false : 2000,
    }
  );

  // tRPC: send message
  const sendMsgMut = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      if (activeRoom !== "dm") utils.chat.getMessages.invalidate({ roomSlug: activeRoom });
      if (privateRecipient) utils.chat.getPrivateMessages.invalidate({ otherUserId: privateRecipient });
    },
  });

  // tRPC: create room
  const createRoomMut = trpc.chat.createRoom.useMutation({
    onSuccess: () => utils.chat.listRooms.invalidate(),
  });

  // Cargar mensajes de la DB en el estado
  useEffect(() => {
    if (activeRoom === "dm" && privateRecipient) {
      const msgs = privateMessages.map(m => ({ ...m, createdAt: new Date(m.createdAt) }));
      setMessages(msgs);
    } else if (activeRoom !== "dm") {
      const msgs = roomMessages.map(m => ({ ...m, createdAt: new Date(m.createdAt) }));
      setMessages(msgs);
    }
  }, [roomMessages, privateMessages, activeRoom, privateRecipient]);

  // ---- WEBSOCKET (opcional - para tiempo real) ----
  useEffect(() => {
    if (userId <= 0) return;
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
          ws!.send(JSON.stringify({
            type: "join-room",
            roomId: "global",
            senderId: userId,
            senderName: userName,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "chat-message": {
                if (data.message) {
                  const newMsg: ChatMsg = {
                    id: data.message.id || Date.now(),
                    senderId: data.message.senderId,
                    senderName: data.message.senderName,
                    content: data.message.content,
                    createdAt: new Date(data.message.timestamp || Date.now()),
                  };
                  setMessages(prev => {
                    const dup = prev.find(m => 
                      m.senderId === newMsg.senderId && 
                      m.content === newMsg.content &&
                      Math.abs(new Date(m.createdAt).getTime() - newMsg.createdAt.getTime()) < 3000
                    );
                    if (dup) return prev;
                    return [...prev, newMsg];
                  });
                }
                break;
              }
              case "room-users": {
                if (data.users) {
                  setOnlineUsers(data.users.map((u: any) => ({ id: u.id, name: u.name })));
                }
                break;
              }
              case "ping": {
                ws?.send(JSON.stringify({ type: "pong" }));
                break;
              }
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
            }, 5000);
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
  }, [userId, userName]);

  // Cambiar de sala
  const joinRoom = useCallback((roomSlug: string) => {
    setActiveRoom(roomSlug);
    setPrivateRecipient(null);
    setMessages([]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "join-room",
        roomId: roomSlug,
        senderId: userRef.current.id || 1,
        senderName: userRef.current.name || "Invitado",
      }));
    }
  }, []);

  // Chat privado
  const openPrivateChat = useCallback((recipientId: number) => {
    setActiveRoom("dm");
    setPrivateRecipient(recipientId);
    setMessages([]);
  }, []);

  // ============================================================
  // SEND: Optimistic update + tRPC + WS
  // ============================================================
  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const roomSlug = activeRoom === "dm" ? "dm" : activeRoom;
    const isPrivate = activeRoom === "dm";
    const senderId = userRef.current.id || 1;
    const senderName = userRef.current.name || "Invitado";

    // 1. Mostrar INMEDIATAMENTE
    const localMsg: ChatMsg = {
      id: nextId(),
      senderId,
      senderName,
      content: trimmed,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, localMsg]);

    // 2. Enviar por WS si conectado
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat-message",
        roomId: roomSlug,
        senderId,
        senderName,
        content: trimmed,
      }));
    }

    // 3. Persistir en DB via tRPC (siempre funciona, aunque WS este caido)
    sendMsgMut.mutate({
      roomSlug,
      content: trimmed,
      isPrivate,
      recipientId: isPrivate ? privateRecipient || undefined : undefined,
    });
  }, [activeRoom, privateRecipient, sendMsgMut]);

  // Crear sala
  const createRoom = useCallback((name: string, isPrivate: boolean) => {
    return createRoomMut.mutateAsync({ name, isPrivate });
  }, [createRoomMut]);

  return {
    messages,
    onlineUsers,
    connected,
    activeRoom,
    privateRecipient,
    publicRooms,
    joinRoom,
    openPrivateChat,
    sendMessage,
    createRoom,
  };
}
