import { WebSocketServer, WebSocket } from "ws";
import type { GameServer, WSMessage, Client, PlayerInfo } from "./types";
import { QUESTION_TIME_MS } from "./types";

// Modulos
import {
  registerClient, unregisterClient, getClientByPlayerId,
  getClientsInRoom, getPlayersInRoom, getPresenceUsers,
} from "./players";
import {
  createRoom, getRoom, getRoomBySyncCode, addPlayerToRoom,
  removePlayerFromRoom, startGame,
} from "./rooms";
import { addChatMessage, getChatHistory } from "./chat";
import {
  rollDice, spinRoulette, processAnswer, continueAfterCorrect,
  processForfeit, decrementTimer, buildFullState, setPlayerReady,
} from "./game";
import { applyGameAction, getFullGameState } from "../game-socket-bridge";
import type { DuelAction } from "../lib/duel-engine";

// ============================================================
// SERVIDOR GLOBAL
// ============================================================
const server: GameServer = {
  clients: new Map(),
  rooms: new Map(),
  games: new Map(),
  players: new Map(),
  chatHistory: new Map(),
};

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
  for (const [, client] of server.clients) {
    if (client.rooms.has(roomId) && client.ws !== exclude && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// Broadcast incluyendo al emisor (chat vuelve al emisor)
function broadcastAll(roomId: string, msg: WSMessage): void {
  const data = JSON.stringify(msg);
  for (const [, client] of server.clients) {
    if (client.rooms.has(roomId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// Enviar estado completo del juego a todos
function sendGameState(roomId: string): void {
  const game = server.games.get(roomId);
  if (!game) return;

  const room = server.rooms.get(roomId);
  const players = room
    ? room.players.map((id) => server.players.get(id)).filter((p): p is PlayerInfo => !!p)
    : [];

  const stateWithPlayers = { ...game, players };

  broadcastAll(roomId, {
    type: "game-state",
    roomId,
    state: stateWithPlayers as any,
  });
}

// Enviar lista de usuarios
function sendRoomUsers(roomId: string): void {
  const users = getPresenceUsers(server, roomId);
  broadcastAll(roomId, {
    type: "room-users",
    roomId,
    users,
  });
}

// Enviar estado de reconexion a un cliente
function sendReconnectState(ws: WebSocket, roomId: string): void {
  const fullState = buildFullState(server, roomId);
  if (!fullState) return;

  const history = getChatHistory(server, roomId);

  send(ws, {
    type: "game-state",
    roomId,
    state: { ...fullState.game, players: fullState.players },
    history,
    users: getPresenceUsers(server, roomId),
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
  console.log(`[WebSocket] Game server running on ws://${host}:${port}`);

  // ---- TIMER GLOBAL: decrementar timers activos cada segundo ----
  const timerInterval = setInterval(() => {
    for (const [roomId, game] of server.games) {
      if (game.timerActive && game.phase === "question") {
        const updated = decrementTimer(server, roomId);
        if (updated) {
          broadcastAll(roomId, {
            type: "timer",
            roomId,
            timer: { remaining: updated.timer, total: QUESTION_TIME_MS / 1000, active: updated.timerActive },
          });
          // Si el timer llego a 0, enviar estado actualizado
          if (!updated.timerActive && updated.phase !== "question") {
            sendGameState(roomId);
          }
        }
      }
    }
  }, 1000);

  // ---- HEARTBEAT: cerrar conexiones inactivas ----
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [ws, client] of server.clients) {
      if (now - client.lastPing > 60000) {
        ws.terminate();
        unregisterClient(server, ws);
      } else if (ws.readyState === WebSocket.OPEN) {
        send(ws, { type: "ping" });
      }
    }
  }, 30000);

  // ---- NUEVA CONEXION ----
  wss.on("connection", (ws) => {
    // Cliente temporal - debe identificarse con join-room
    const tempClient: Client = {
      ws,
      playerId: 0,
      playerName: "Anonimo",
      rooms: new Set(),
      lastPing: Date.now(),
    };
    server.clients.set(ws, tempClient);

    ws.on("message", (raw) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());
        const client = server.clients.get(ws);
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

            // Registrar/actualizar cliente
            registerClient(server, ws, playerId, playerName);
            const me = server.clients.get(ws)!;
            me.rooms.add(roomId);

            // Crear sala si no existe (primera vez)
            let room = getRoom(server, roomId);
            if (!room) {
              room = createRoom(server, playerId, msg.content, playerName);
            }

            // Agregar jugador a la sala
            addPlayerToRoom(server, roomId, playerId);

            // Enviar estado de reconexion completo
            const history = getChatHistory(server, roomId);
            send(ws, {
              type: "game-state",
              roomId,
              history,
              users: getPresenceUsers(server, roomId),
            });
            sendGameState(roomId);
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
            const room = removePlayerFromRoom(server, roomId, client.playerId);

            broadcast(roomId, {
              type: "presence",
              roomId,
              senderId: client.playerId,
              senderName: client.playerName,
              content: "left",
              timestamp: Date.now(),
            });

            if (room) {
              sendRoomUsers(roomId);
              sendGameState(roomId);
            }
            break;
          }

          // ---- CHAT MESSAGE ----
          case "chat-message": {
            const roomId = msg.roomId;
            const content = msg.content;
            if (!roomId || !content || !client.playerId) break;

            const message = addChatMessage(server, roomId, client.playerId, client.playerName, content);

            // INCLUYE al emisor - el cliente siempre ve su mensaje
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

          // ---- PLAYER READY ----
          case "player-ready": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;

            setPlayerReady(server, roomId, client.playerId);
            const player = server.players.get(client.playerId);

            broadcastAll(roomId, {
              type: "player-ready",
              roomId,
              player: player ? { ...player } : undefined,
              senderId: client.playerId,
            });
            break;
          }

          // ---- GAME START ----
          case "game-start": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;

            const room = getRoom(server, roomId);
            if (room && room.hostId === client.playerId) {
              const game = startGame(server, roomId);
              if (game) {
                broadcastAll(roomId, { type: "game-start", roomId, state: game });
                sendGameState(roomId);
              }
            }
            break;
          }

          // ---- SPIN WHEEL ----
          case "spin-wheel": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;

            const { result, game } = spinRoulette(server, roomId, client.playerId);
            if (result && game) {
              broadcastAll(roomId, {
                type: "wheel-result",
                roomId,
                wheelResult: result,
                senderId: client.playerId,
              });
              sendGameState(roomId);
            }
            break;
          }

          // ---- ANSWER ----
          case "answer": {
            const roomId = msg.roomId;
            const correct = msg.correct;
            if (!roomId || correct === undefined || !client.playerId) break;

            const { game, finished } = processAnswer(server, roomId, client.playerId, correct);

            if (game) {
              if (finished) {
                broadcastAll(roomId, {
                  type: "game-over",
                  roomId,
                  winnerId: game.winnerId,
                  reason: game.winReason,
                  state: game,
                });
              } else {
                broadcastAll(roomId, {
                  type: correct ? "correct" : "wrong",
                  roomId,
                  senderId: client.playerId,
                  senderName: client.playerName,
                });
              }
              sendGameState(roomId);
            }
            break;
          }

          // ---- NEXT TURN (continuar despues de respuesta correcta) ----
          case "next-turn": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;

            const game = continueAfterCorrect(server, roomId);
            if (game) {
              broadcastAll(roomId, { type: "next-turn", roomId, state: game });
              sendGameState(roomId);
            }
            break;
          }

          // ---- DICE ----
          case "dice": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;

            const { allRolled, game } = rollDice(server, roomId, client.playerId);
            if (game) {
              if (allRolled) {
                broadcastAll(roomId, {
                  type: "game-state",
                  roomId,
                  state: game,
                  senderId: client.playerId,
                });
              } else {
                // Solo notificar que este jugador tiro
                const player = server.players.get(client.playerId);
                broadcastAll(roomId, {
                  type: "score-update",
                  roomId,
                  score: player ? { playerId: player.id, diceValue: player.diceValue } : undefined,
                });
              }
              sendGameState(roomId);
            }
            break;
          }

          // ---- FORFEIT ----
          case "game-over": {
            const roomId = msg.roomId;
            if (!roomId || !client.playerId) break;

            const game = processForfeit(server, roomId, client.playerId);
            if (game) {
              broadcastAll(roomId, {
                type: "game-over",
                roomId,
                winnerId: game.winnerId,
                reason: "forfeit",
                state: game,
              });
              sendGameState(roomId);
            }
            break;
          }

          // ---- GAME ACTION (duelo) ----
          case "game_action": {
            const roomId = msg.roomId;
            const action = msg.action;
            if (!roomId || !action || !client.playerId) break;

            // Parse challenge ID from room (format: "duel_<challengeId>")
            const challengeId = Number(roomId.replace("duel_", ""));
            if (isNaN(challengeId) || challengeId <= 0) break;

            // Async handler
            const handleAction = async () => {
              try {
                const result = await applyGameAction(challengeId, action as DuelAction, client.playerId);
                if (result.error) {
                  send(ws, { type: "game_error" as any, roomId, gameError: result.error });
                } else if (result.broadcast) {
                  const fullState = await getFullGameState(challengeId);
                  if (fullState) broadcastGameState(roomId, fullState);
                }
              } catch (e: any) {
                send(ws, { type: "game_error" as any, roomId, gameError: e.message || "Error procesando accion" });
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
      const client = unregisterClient(server, ws);
      if (client) {
        for (const roomId of client.rooms) {
          broadcast(roomId, {
            type: "presence",
            roomId,
            senderId: client.playerId,
            senderName: client.playerName,
            content: "disconnected",
            timestamp: Date.now(),
          });
          sendRoomUsers(roomId);
          sendGameState(roomId);
        }
      }
    });

    ws.on("error", () => {
      unregisterClient(server, ws);
    });
  });

  // ---- LIMPIEZA AL CERRAR ----
  wss.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(timerInterval);
  });

  return { wss, server };
}

// ============================================================
// API EXTERNA
// ============================================================
export function getServerState() {
  return {
    clients: server.clients.size,
    rooms: Array.from(server.rooms.entries()).map(([id, r]) => ({
      id,
      name: r.name,
      status: r.state,
      players: r.players.length,
      syncCode: r.syncCode,
    })),
    players: server.players.size,
  };
}
