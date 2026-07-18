import { WebSocketServer, WebSocket } from "ws";

interface WSMessage {
  type: "join" | "leave" | "chat" | "ping" | "pong" | "presence" | "roster" | "welcome";
  room?: string;
  senderId?: number;
  senderName?: string;
  content?: string;
  timestamp?: number;
  users?: Array<{ id: number; name: string }>;
  messages?: Array<{ senderId: number; senderName: string; content: string; timestamp: number }>;
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

// Lista de usuarios unicos actualmente en una sala
function getRoomUsers(room: string): Array<{ id: number; name: string }> {
  const seen = new Map<number, string>();
  for (const [, info] of clients) {
    if (info.rooms.has(room) && info.userId && info.ws.readyState === WebSocket.OPEN) {
      seen.set(info.userId, info.userName || `Jugador #${info.userId}`);
    }
  }
  return Array.from(seen, ([id, name]) => ({ id, name }));
}

function broadcastRoster(room: string) {
  broadcast(room, { type: "roster", room, users: getRoomUsers(room), timestamp: Date.now() });
}

function addToHistory(room: string, msg: { senderId: number; senderName: string; content: string; timestamp: number }) {
  if (!roomHistory.has(room)) roomHistory.set(room, []);
  const history = roomHistory.get(room)!;
  history.push(msg);
  if (history.length > MAX_HISTORY) history.shift();
}

export function startWebSocketServer(port: number = 3001, host: string = "0.0.0.0") {
  const wss = new WebSocketServer({ port, host });

  console.log(`[WebSocket] Server running on ws://${host}:${port}`);

  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [ws, info] of clients) {
      if (now - info.lastPing > 60000) {
        // terminate() dispara "close" -> ahi se limpia y se anuncia la salida
        ws.terminate();
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
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
              const alreadyInRoom = info.rooms.has(msg.room);
              info.rooms.add(msg.room);
              info.userId = msg.senderId;
              info.userName = msg.senderName;

              // Historial + lista actual para el que entra
              ws.send(JSON.stringify({
                type: "welcome",
                room: msg.room,
                messages: roomHistory.get(msg.room) || [],
                users: getRoomUsers(msg.room),
              }));

              if (!alreadyInRoom) {
                broadcast(msg.room, {
                  type: "presence",
                  room: msg.room,
                  senderId: msg.senderId,
                  senderName: msg.senderName,
                  content: "joined",
                  timestamp: Date.now(),
                }, ws);
              }
              // Lista actualizada para TODOS en la sala (incluye al nuevo)
              broadcastRoster(msg.room);
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
              broadcastRoster(msg.room);
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
              // No reenviar al emisor: el ya muestra su mensaje localmente
              broadcast(msg.room, chatMsg, ws);
            }
            break;
          }
          case "pong": {
            break;
          }
        }
      } catch { /* mensaje invalido */ }
    });

    const handleDisconnect = () => {
      if (!clients.has(ws)) return; // ya procesado
      clients.delete(ws);
      for (const room of info.rooms) {
        broadcast(room, {
          type: "presence",
          room,
          senderId: info.userId,
          senderName: info.userName,
          content: "left",
          timestamp: Date.now(),
        });
        broadcastRoster(room);
      }
    };

    ws.on("close", handleDisconnect);
    ws.on("error", handleDisconnect);
  });

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
}
