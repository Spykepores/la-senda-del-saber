import { WebSocketServer, WebSocket } from "ws";

interface WSMessage {
  type: "join" | "leave" | "chat" | "ping" | "pong" | "presence";
  room?: string;
  senderId?: number;
  senderName?: string;
  content?: string;
  timestamp?: number;
}

interface ClientInfo {
  ws: WebSocket;
  rooms: Set<string>;
  userId?: number;
  userName?: string;
  lastPing: number;
}

const clients = new Map<WebSocket, ClientInfo>();
const roomHistory = new Map<string, Array<{ senderId: number; senderName: string; content: string; timestamp: number }>>();
const MAX_HISTORY = 100;

function broadcast(room: string, message: WSMessage, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  for (const [, info] of clients) {
    if (info.rooms.has(room) && info.ws !== exclude && info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(data);
    }
  }
}

function addToHistory(room: string, msg: { senderId: number; senderName: string; content: string; timestamp: number }) {
  if (!roomHistory.has(room)) roomHistory.set(room, []);
  const history = roomHistory.get(room)!;
  history.push(msg);
  if (history.length > MAX_HISTORY) history.shift();
}

export function startWebSocketServer(port: number = 3001) {
  const wss = new WebSocketServer({ port });

  console.log(`[WebSocket] Server running on ws://localhost:${port}`);

  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [ws, info] of clients) {
      if (now - info.lastPing > 60000) {
        ws.terminate();
        clients.delete(ws);
      } else {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }
    }
  }, 30000);

  wss.on("connection", (ws) => {
    const info: ClientInfo = { ws, rooms: new Set(), lastPing: Date.now() };
    clients.set(ws, info);

    ws.on("message", (raw) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());
        info.lastPing = Date.now();

        switch (msg.type) {
          case "join": {
            if (msg.room) {
              info.rooms.add(msg.room);
              info.userId = msg.senderId;
              info.userName = msg.senderName;
              const history = roomHistory.get(msg.room) || [];
              ws.send(JSON.stringify({ type: "history", room: msg.room, messages: history }));
              broadcast(msg.room, {
                type: "presence",
                room: msg.room,
                senderId: msg.senderId,
                senderName: msg.senderName,
                content: "joined",
                timestamp: Date.now(),
              }, ws);
            }
            break;
          }
          case "leave": {
            if (msg.room) {
              info.rooms.delete(msg.room);
              broadcast(msg.room, {
                type: "presence",
                room: msg.room,
                senderId: msg.senderId,
                senderName: msg.senderName,
                content: "left",
                timestamp: Date.now(),
              }, ws);
            }
            break;
          }
          case "chat": {
            if (msg.room && msg.content) {
              const chatMsg = {
                type: "chat" as const,
                room: msg.room,
                senderId: msg.senderId || 0,
                senderName: msg.senderName || "Anonimo",
                content: msg.content,
                timestamp: msg.timestamp || Date.now(),
              };
              addToHistory(msg.room, {
                senderId: chatMsg.senderId,
                senderName: chatMsg.senderName,
                content: chatMsg.content,
                timestamp: chatMsg.timestamp,
              });
              broadcast(msg.room, chatMsg);
            }
            break;
          }
          case "pong": {
            break;
          }
        }
      } catch { /* */ }
    });

    ws.on("close", () => {
      for (const room of info.rooms) {
        broadcast(room, {
          type: "presence",
          room,
          senderId: info.userId,
          senderName: info.userName,
          content: "disconnected",
          timestamp: Date.now(),
        });
      }
      clients.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
}
