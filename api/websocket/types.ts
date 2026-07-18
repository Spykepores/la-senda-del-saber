// ============================================================
// TIPOS WEBSOCKET - Solo chat/presencia y duelo
// Sistema A eliminado (game.ts, rooms.ts, players.ts, wheel.ts)
// ============================================================

import type { WebSocket } from "ws";

// ---- Eventos del protocolo ----
export type WSEventType =
  // Conexion / presencia
  | "join-room" | "leave-room" | "room-users" | "presence"
  // Chat
  | "chat-message" | "typing"
  // Duelo (persistido en Postgres via game-socket-bridge.ts)
  | "game_action" | "game_state" | "game_error"
  // Heartbeat
  | "ping" | "pong";

// ---- Mensaje base ----
export interface WSMessage {
  type: WSEventType;
  roomId?: string;
  senderId?: number;
  senderName?: string;
  content?: string;
  timestamp?: number;
  // Chat
  message?: ChatMessageData;
  users?: PresenceUser[];
  history?: ChatMessageData[];
  // Duelo
  action?: DuelActionPayload;
  state?: any;
  gameError?: string;
}

// ---- Payload de accion de duelo ----
export interface DuelActionPayload {
  kind: "roll_dice" | "start_turn" | "submit_answer" | "forfeit" | "set_turn";
  playerId?: number;
  diceValue?: number;
  questionId?: number;
  selectedOption?: number;
}

// ---- Mensaje de chat ----
export interface ChatMessageData {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: number;
}

// ---- Usuario en presencia ----
export interface PresenceUser {
  id: number;
  name: string;
  connected: boolean;
}

// ---- Chat history por sala (usado por chat generico) ----
export const chatHistory = new Map<string, ChatMessageData[]>();
const MAX_MESSAGES = 100;

// Profanity filter
const BAD_WORDS = [
  "puta", "puto", "mierda", "chinga", "chingar", "pendejo", "pendeja",
  "cabron", "joder", "maricon", "mamon", "culero", "estupido", "estupida",
  "idiota", "imbecil", "gilipollas", "tonto", "tonta", "maldito", "maldita",
  "verga", "polla", "cojones", "huevon", "pinche", "malparido", "hijueputa",
  "hp", "pirobo", "gonorrea", "chimba", "careverga", "cagada", "mamahuevo",
  "soplapollas", "fuck", "shit", "bitch", "asshole", "bastard", "damn",
  "dick", "cock", "pussy", "whore", "slut", "retard", "stupid", "dumb", "moron",
  "loser",
];

function censorText(text: string): string {
  let censored = text;
  for (const word of BAD_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    censored = censored.replace(regex, "*".repeat(word.length));
  }
  return censored;
}

export function addChatMessage(
  roomId: string,
  senderId: number,
  senderName: string,
  content: string
): ChatMessageData {
  const censored = censorText(content);
  const message: ChatMessageData = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId,
    senderName,
    content: censored,
    timestamp: Date.now(),
  };

  if (!chatHistory.has(roomId)) {
    chatHistory.set(roomId, []);
  }
  const history = chatHistory.get(roomId)!;
  history.push(message);
  if (history.length > MAX_MESSAGES) history.shift();

  return message;
}

export function getChatHistory(roomId: string): ChatMessageData[] {
  return chatHistory.get(roomId) || [];
}

export function clearChatHistory(roomId: string): void {
  chatHistory.delete(roomId);
}
