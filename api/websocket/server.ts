import { WebSocketServer, WebSocket } from "ws";
import type { WSMessage } from "./types";
import { addChatMessage, getChatHistory } from "./types";
import {
  registerClient, unregisterClient, getClient, getClientsInRoom, getPresenceUsers, cleanupStaleClients,
} from "./presence";
import { applyGameAction, getFullGameState } from "../game-socket-bridge";

// ============================================================
// UTILIDADES DE ENVIO
// ============================================================
function send(ws: WebSocket, msg: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(roomId: string, msg: WSMessage, exclude?: WebSocket): void {
  const data = JSON.stringify(msg);
  for (const client of getClientsInRoom(roomId)) {
    if (client.ws !== exclude && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function broadcastAll(roomId: string, msg: WSMessage): void {
  const data = JSON.stringify(msg);
  for (const client of getClientsInRoom(roomId)) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function sendRoomUsers(roomId: string): void {
  broadcastAll(roomId, {
    type: "room-users",
    roomId,
    users: getPresenceUsers(roomId),
  });
}

// Broadcast estado de duelo a todos los clientes de una sala
export function broadcastGameState(roomId: string, state: any): void {
  broadcastAll(roomId, {
    type: "game_state",
    roomId,
    state,
  });
}

// ============================================================
// SERVIDOR WEBSOCKET
// ============================================================
export function startWebSocketServer(port: number = 3001, host: string = "0.0.0.0") {
  const wss = new WebSocketServer({ port, host });
  console.log(`[WebSocket] Server running on ws://${host}:${port}`);

  // ---- HEARTBEAT: cerrar conexiones inactivas ----
  const heartbeat = setInterval(() => {
    cleanupStaleClients(60000);
    for (const client of Array.from(getAllClients().values())) {
      if (client.ws.readyState === WebSocket.OPEN) {
        send(client.ws, { type: "ping" });
      }
    }
  }, 30000);

  // ---- NUEVA CONEXION ----
  wss.on("connection", (ws) => {
    // Cliente temporal - debe identificarse con join-room
    registerClient(ws, 0, "Anonimo");

    ws.on("message", (raw) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());
        const client = getClient(ws);
        if (!client) return;
        client.lastPing = Date.now();

        // ============================================================
        // EVENTOS
        // ============================================================
        switch (msg.type) {

          // ---- JOIN ROOM ----
          case "join-room": {
            const roomId = msg.roomId;
            const playerId = msg.senderId || 0;
            const playerName = msg.senderName || "Jugador";
            if (!roomId || !playerId) break;

            // Re-registrar con datos reales
            registerClient(ws, playerId, playerName);
            const me = getClient(ws)!;
            me.rooms.add(roomId);

            // Enviar historial de chat
            const history = getChatHistory(roomId);
            send(ws, {
              type: "room-users",
              roomId,
              users: getPresenceUsers(roomId),
            });
            if (history.length > 0) {
              send(ws, {
                type: "game_state",
                roomId,
                history,
              } as any);
            }

            // Si es sala de duelo (prefijo duel_), enviar estado real de Postgres
            if (roomId.startsWith("duel_")) {
              const challengeId = Number(roomId.replace("duel_", ""));
              if (!isNaN(challengeId) && challengeId > 0) {
                const loadAndSend = async () => {
                  try {
                    const state = await getFullGameState(challengeId);
                    if (state) {
                      send(ws, { type: "game_state", roomId, state });
                    }
                  } catch (e) {
                    // ignore
                  }
                };
                loadAndSend();
              }
            }

            sendRoomUsers(roomId);

            // Notificar a otros
            broadcast(roomId, {
              type: "presence",
              roomId,
              senderId: playerId,
              senderName: playerName,
              content: "joined",
              timestamp: Date.now(),
            }, ws);
            break;
          }

          // ---- LEAVE ROOM ----
          case "leave-room": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;

            client.rooms.delete(roomId);

            broadcast(roomId, {
              type: "presence",
              roomId,
              senderId: client.playerId,
              senderName: client.playerName,
              content: "left",
              timestamp: Date.now(),
            });

            sendRoomUsers(roomId);
            break;
          }

          // ---- CHAT MESSAGE ----
          case "chat-message": {
            const roomId = msg.roomId;
            const content = msg.content;
            if (!roomId || !content || !client.playerId) break;

            const message = addChatMessage(roomId, client.playerId, client.playerName, content);

            broadcastAll(roomId, {
              type: "chat-message",
              roomId,
              message,
            });
            break;
          }

          // ---- TYPING ----
          case "typing": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;
            broadcast(roomId, {
              type: "typing",
              roomId,
              senderId: client.playerId,
              senderName: client.playerName,
            }, ws);
            break;
          }

          // ---- GAME ACTION (duelo - Sistema B) ----
          case "game_action": {
            const roomId = msg.roomId;
            const action = msg.action;
            if (!roomId || !action || !client.playerId) break;

            const challengeId = Number(roomId.replace("duel_", ""));
            if (isNaN(challengeId) || challengeId <= 0) break;

            const handleAction = async () => {
              try {
                const result = await applyGameAction(challengeId, action as any, client.playerId);
                if (result.error) {
                  send(ws, { type: "game_error" as any, roomId, gameError: result.error });
                } else if (result.broadcast) {
                  const fullState = await getFullGameState(challengeId);
                  if (fullState) broadcastGameState(roomId, fullState);
                }
              } catch (e: any) {
                send(ws, { type: "game_error" as any, roomId, gameError: e.message || "Error" });
              }
            };
            handleAction();
            break;
          }

          // ---- PONG ----
          case "pong": {
            break;
          }

          default:
            break;
        }
      } catch (err) {
        // Ignorar mensajes malformados
      }
    });

    // ---- CIERRE DE CONEXION ----
    ws.on("close", () => {
      const c = unregisterClient(ws);
      if (c) {
        for (const roomId of c.rooms) {
          broadcast(roomId, {
            type: "presence",
            roomId,
            senderId: c.playerId,
            senderName: c.playerName,
            content: "disconnected",
            timestamp: Date.now(),
          });
          sendRoomUsers(roomId);
        }
      }
    });

    ws.on("error", () => {
      unregisterClient(ws);
    });
  });

  // ---- LIMPIEZA AL CERRAR ----
  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return { wss };
}

// Helper for heartbeat
function getAllClients(): Map<WebSocket, any> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const presence = require("./presence") as { getAllClients: () => Map<WebSocket, any> };
  return presence.getAllClients ? presence.getAllClients() : new Map();
}
