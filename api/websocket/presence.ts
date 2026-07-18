import type { WebSocket } from "ws";

// ============================================================
// PRESENCE - Registro de clientes por socket
// Solo para chat/presencia generica. Sin GameState ni Room.
// ============================================================

export interface WsClient {
  ws: WebSocket;
  playerId: number;
  playerName: string;
  rooms: Set<string>;
  lastPing: number;
}

export interface PresenceUser {
  id: number;
  name: string;
  connected: boolean;
}

const clients = new Map<WebSocket, WsClient>();

export function registerClient(ws: WebSocket, playerId: number, playerName: string): WsClient {
  // Si ya existe un cliente para este jugador, limpiarlo
  for (const [, c] of clients) {
    if (c.playerId === playerId && c.ws !== ws) {
      try { c.ws.close(); } catch { /* */ }
      clients.delete(c.ws);
    }
  }

  const client: WsClient = {
    ws,
    playerId,
    playerName,
    rooms: new Set(),
    lastPing: Date.now(),
  };
  clients.set(ws, client);
  return client;
}

export function unregisterClient(ws: WebSocket): WsClient | undefined {
  const client = clients.get(ws);
  if (!client) return undefined;
  clients.delete(ws);
  return client;
}

export function getClient(ws: WebSocket): WsClient | undefined {
  return clients.get(ws);
}

export function getClientByPlayerId(playerId: number): WsClient | undefined {
  for (const [, c] of clients) {
    if (c.playerId === playerId) return c;
  }
  return undefined;
}

export function getClientsInRoom(roomId: string): WsClient[] {
  const result: WsClient[] = [];
  for (const [, c] of clients) {
    if (c.rooms.has(roomId)) result.push(c);
  }
  return result;
}

export function getPresenceUsers(roomId: string): PresenceUser[] {
  const seen = new Set<number>();
  const result: PresenceUser[] = [];
  for (const [, c] of clients) {
    if (c.rooms.has(roomId) && !seen.has(c.playerId)) {
      seen.add(c.playerId);
      result.push({ id: c.playerId, name: c.playerName, connected: true });
    }
  }
  return result;
}

export function getAllClients(): Map<WebSocket, WsClient> {
  return clients;
}

export function cleanupStaleClients(maxAgeMs: number = 60000): number {
  const now = Date.now();
  let count = 0;
  for (const [ws, c] of clients) {
    if (now - c.lastPing > maxAgeMs) {
      try { ws.terminate(); } catch { /* */ }
      clients.delete(ws);
      count++;
    }
  }
  return count;
}
