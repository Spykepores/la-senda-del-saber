import type { Client, PlayerInfo, GameServer, PresenceUser } from "./types";
import type { WebSocket } from "ws";

// ============================================================
// GESTION DE JUGADORES
// ============================================================

export function createPlayer(server: GameServer, id: number, name: string): PlayerInfo {
  const player: PlayerInfo = {
    id,
    name,
    connected: true,
    score: 0,
    seals: Object.fromEntries([
      "historia", "personajes", "libros", "ensenanzas",
      "geografia", "profecias", "nuevo_testamento",
    ].map((c) => [c, 0])),
    brokenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    ready: false,
  };
  server.players.set(id, player);
  return player;
}

export function getPlayer(server: GameServer, id: number): PlayerInfo | undefined {
  return server.players.get(id);
}

export function updatePlayer(server: GameServer, id: number, updates: Partial<PlayerInfo>): PlayerInfo | undefined {
  const player = server.players.get(id);
  if (!player) return undefined;
  Object.assign(player, updates);
  return player;
}

export function setPlayerConnected(server: GameServer, id: number, connected: boolean): void {
  const player = server.players.get(id);
  if (player) player.connected = connected;
}

export function removePlayer(server: GameServer, id: number): void {
  server.players.delete(id);
}

export function getClientByPlayerId(server: GameServer, playerId: number): Client | undefined {
  for (const [, client] of server.clients) {
    if (client.playerId === playerId) return client;
  }
  return undefined;
}

export function getClientsInRoom(server: GameServer, roomId: string): Client[] {
  const result: Client[] = [];
  for (const [, client] of server.clients) {
    if (client.rooms.has(roomId)) result.push(client);
  }
  return result;
}

export function getPlayerIdsInRoom(server: GameServer, roomId: string): number[] {
  const room = server.rooms.get(roomId);
  return room ? room.players : [];
}

export function getPlayersInRoom(server: GameServer, roomId: string): PlayerInfo[] {
  const room = server.rooms.get(roomId);
  if (!room) return [];
  return room.players
    .map((id) => server.players.get(id))
    .filter((p): p is PlayerInfo => p !== undefined);
}

export function getPresenceUsers(server: GameServer, roomId: string): PresenceUser[] {
  return getPlayersInRoom(server, roomId).map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
  }));
}

export function registerClient(server: GameServer, ws: WebSocket, playerId: number, playerName: string): Client {
  // Si ya existe un cliente para este jugador, limpiarlo
  const existing = getClientByPlayerId(server, playerId);
  if (existing) {
    // Cerrar sin llamar a onclose para evitar loops
    existing.ws.removeAllListeners();
    try { existing.ws.close(); } catch { /* */ }
    server.clients.delete(existing.ws);
  }

  const client: Client = {
    ws,
    playerId,
    playerName,
    rooms: new Set(),
    lastPing: Date.now(),
  };
  server.clients.set(ws, client);

  // Asegurar que el jugador existe
  if (!server.players.has(playerId)) {
    createPlayer(server, playerId, playerName);
  } else {
    setPlayerConnected(server, playerId, true);
    const p = server.players.get(playerId)!;
    if (p.name !== playerName) p.name = playerName;
  }

  return client;
}

export function unregisterClient(server: GameServer, ws: WebSocket): Client | undefined {
  const client = server.clients.get(ws);
  if (!client) return undefined;

  // Marcar desconectado
  setPlayerConnected(server, client.playerId, false);

  // Eliminar de todas las salas
  for (const roomId of client.rooms) {
    const room = server.rooms.get(roomId);
    if (room) {
      room.players = room.players.filter((id) => id !== client.playerId);
      if (room.players.length === 0) {
        server.rooms.delete(roomId);
        server.games.delete(roomId);
        server.chatHistory.delete(roomId);
      } else if (room.hostId === client.playerId) {
        room.hostId = room.players[0];
      }
    }
  }

  server.clients.delete(ws);
  return client;
}
