import type { GameServer, Room, GameState } from "./types";

// ============================================================
// GESTION DE SALAS
// ============================================================

export function generateSyncCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateRoomId(): string {
  return `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function createRoom(server: GameServer, hostId: number, name?: string, playerName?: string): Room {
  const host = server.players.get(hostId);
  const room: Room = {
    id: generateRoomId(),
    hostId,
    players: [hostId],
    state: "waiting",
    createdAt: Date.now(),
    syncCode: generateSyncCode(),
    name: name || `Sala de ${host?.name || "Anfitrion"}`,
  };
  server.rooms.set(room.id, room);

  // Crear estado de juego
  const game: GameState = {
    roomId: room.id,
    turn: 0,
    round: 1,
    phase: "waiting",
    timer: 15,
    timerActive: false,
    diceRolled: false,
    started: false,
  };
  server.games.set(room.id, game);

  // Inicializar chat
  if (!server.chatHistory.has(room.id)) {
    server.chatHistory.set(room.id, []);
  }

  return room;
}

export function getRoom(server: GameServer, roomId: string): Room | undefined {
  return server.rooms.get(roomId);
}

export function getRoomBySyncCode(server: GameServer, code: string): Room | undefined {
  for (const [, room] of server.rooms) {
    if (room.syncCode === code) return room;
  }
  return undefined;
}

export function addPlayerToRoom(server: GameServer, roomId: string, playerId: number): Room | undefined {
  const room = server.rooms.get(roomId);
  if (!room) return undefined;

  if (!room.players.includes(playerId)) {
    room.players.push(playerId);
  }

  // Si hay 2+ jugadores, iniciar fase de dados
  const game = server.games.get(roomId);
  if (game && room.players.length >= 2 && !game.started) {
    game.phase = "dice_roll";
  }

  return room;
}

export function removePlayerFromRoom(server: GameServer, roomId: string, playerId: number): Room | undefined {
  const room = server.rooms.get(roomId);
  if (!room) return undefined;

  room.players = room.players.filter((id) => id !== playerId);

  if (room.players.length === 0) {
    server.rooms.delete(roomId);
    server.games.delete(roomId);
    server.chatHistory.delete(roomId);
    return undefined;
  }

  // Transferir host si es necesario
  if (room.hostId === playerId) {
    room.hostId = room.players[0];
  }

  return room;
}

export function getPublicRooms(server: GameServer): Room[] {
  const result: Room[] = [];
  for (const [, room] of server.rooms) {
    if (room.state === "waiting" && room.players.length < 2) {
      result.push(room);
    }
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function getPlayerRooms(server: GameServer, playerId: number): Room[] {
  const result: Room[] = [];
  for (const [, room] of server.rooms) {
    if (room.players.includes(playerId)) result.push(room);
  }
  return result;
}

export function startGame(server: GameServer, roomId: string): GameState | undefined {
  const room = server.rooms.get(roomId);
  const game = server.games.get(roomId);
  if (!room || !game) return undefined;

  room.state = "playing";
  game.started = true;
  game.startedAt = Date.now();

  // Reset dice for all players
  for (const pid of room.players) {
    const player = server.players.get(pid);
    if (player) player.diceValue = undefined;
  }

  if (room.players.length >= 2) {
    game.phase = "dice_roll";
    game.diceRolled = false;
  }

  return game;
}
