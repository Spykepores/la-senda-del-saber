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

// ============================================================
// HOOK: Chat con WebSocket (tiempo real) + tRPC (persistencia)
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

  // tRPC: list public rooms
  const { data: publicRooms = [] } = trpc.chat.listRooms.useQuery();

  // tRPC: get messages for active room
  const { data: roomMessages = [], refetch: refetchRoomMessages } = trpc.chat.getMessages.useQuery(
    { roomSlug: activeRoom },
    { enabled: activeRoom !== "dm" && activeRoom.length > 0 }
  );

  // tRPC: get private messages
  const { data: privateMessages = [], refetch: refetchPrivateMessages } = trpc.chat.getPrivateMessages.useQuery(
    { otherUserId: privateRecipient || 0 },
    { enabled: privateRecipient !== null && privateRecipient > 0 }
  );

  // tRPC: send message mutation
  const sendMsgMut = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      if (activeRoom !== "dm") refetchRoomMessages();
      if (privateRecipient) refetchPrivateMessages();
    },
  });

  // tRPC: create room
  const createRoomMut = trpc.chat.createRoom.useMutation({
    onSuccess: () => {
      trpc.useUtils().chat.listRooms.invalidate();
    },
  });

  // Load persisted messages into state
  useEffect(() => {
    if (activeRoom === "dm" && privateRecipient) {
      setMessages(privateMessages.map(m => ({ ...m, createdAt: new Date(m.createdAt) })));
    } else if (activeRoom !== "dm") {
      setMessages(roomMessages.map(m => ({ ...m, createdAt: new Date(m.createdAt) })));
    }
  }, [roomMessages, privateMessages, activeRoom, privateRecipient]);

  // ---- WEBSOCKET ----
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
                  const msg: ChatMsg = {
                    id: Date.now(),
                    senderId: data.message.senderId,
                    senderName: data.message.senderName,
                    content: data.message.content,
                    createdAt: new Date(data.message.timestamp),
                  };
                  setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
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
              case "presence": {
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
  }, [userId, userName]);

  // Join a different room via WS
  const joinRoom = useCallback((roomSlug: string) => {
    setActiveRoom(roomSlug);
    setPrivateRecipient(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "join-room",
        roomId: roomSlug,
        senderId: userRef.current.id,
        senderName: userRef.current.name,
      }));
    }
    refetchRoomMessages();
  }, [refetchRoomMessages]);

  // Open private conversation
  const openPrivateChat = useCallback((recipientId: number) => {
    setActiveRoom("dm");
    setPrivateRecipient(recipientId);
    refetchPrivateMessages();
  }, [refetchPrivateMessages]);

  // Send message (WS + persist to DB)
  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;

    const roomSlug = activeRoom === "dm" ? "dm" : activeRoom;
    const isPrivate = activeRoom === "dm";

    sendMsgMut.mutate({
      roomSlug,
      content: content.trim(),
      isPrivate,
      recipientId: isPrivate ? privateRecipient || undefined : undefined,
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat-message",
        roomId: roomSlug,
        senderId: userRef.current.id,
        senderName: userRef.current.name,
        content: content.trim(),
      }));
    }
  }, [activeRoom, privateRecipient, sendMsgMut]);

  // Create room
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
    setActiveRoom,
    setPrivateRecipient,
  };
}
