// ============================================================
// TIPOS CENTRALIZADOS DEL SERVIDOR WEBSOCKET
// ============================================================

import type { WebSocket } from "ws";

// ---- Eventos del protocolo ----
export type WSEventType =
  // Conexion
  | "connect" | "disconnect" | "reconnect"
  // Sala
  | "join-room" | "leave-room" | "room-users" | "room-created" | "room-deleted"
  // Chat
  | "chat-message" | "typing"
  // Jugador
  | "player-ready"
  // Juego
  | "game-start" | "next-turn" | "spin-wheel" | "wheel-result"
  | "question" | "answer" | "correct" | "wrong" | "score-update"
  | "timer" | "game-over" | "dice"
  // Duelo (desafio 1v1)
  | "game_action" | "game_state" | "game_error"
  // Estado
  | "game-state" | "presence"
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
  // Payloads especificos
  players?: PlayerInfo[];
  player?: PlayerInfo;
  state?: GameState;
  question?: QuestionData;
  answer?: AnswerData;
  wheelResult?: WheelResult;
  score?: ScoreUpdate;
  timer?: TimerData;
  diceValue?: number;
  correct?: boolean;
  ready?: boolean;
  // Duelo
  action?: {
    kind: "roll_dice" | "start_turn" | "roulette_result" | "submit_answer" | "forfeit" | "set_turn";
    playerId?: number;
    diceValue?: number;
    category?: string;
    questionId?: number;
    selectedOption?: number;
    correct?: boolean;
  };
  gameError?: string;
  category?: string;
  message?: ChatMessageData;
  users?: PresenceUser[];
  history?: ChatMessageData[];
  reason?: string;
  winnerId?: number | null;
}

// ---- Jugador ----
export interface PlayerInfo {
  id: number;
  name: string;
  connected: boolean;
  score: number;
  seals: Record<string, number>;
  brokenCount: number;
  correctCount: number;
  wrongCount: number;
  diceValue?: number;
  ready: boolean;
}

// ---- Cliente WebSocket ----
export interface Client {
  ws: WebSocket;
  playerId: number;
  playerName: string;
  rooms: Set<string>;
  lastPing: number;
}

// ---- Sala ----
export interface Room {
  id: string;
  hostId: number;
  players: number[]; // IDs de jugadores
  state: "waiting" | "playing" | "finished";
  createdAt: number;
  syncCode: string;
  name: string;
}

// ---- Partida ----
export interface GameState {
  roomId: string;
  turn: number; // indice del jugador cuyo turno es
  round: number;
  phase: "waiting" | "dice_roll" | "playing" | "roulette" | "question" | "result" | "finished" | "forfeit";
  currentCategory?: string;
  currentQuestion?: QuestionData | null;
  wheelAngle?: number;
  wheelResult?: string; // categoria resultante
  timer: number; // segundos restantes
  timerActive: boolean;
  winnerId?: number | null;
  forfeitBy?: number;
  winReason?: string;
  lastAnswerCorrect?: boolean;
  diceRolled: boolean;
  started: boolean;
  startedAt?: number;
}

// ---- Pregunta ----
export interface QuestionData {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

// ---- Respuesta ----
export interface AnswerData {
  playerId: number;
  questionId: string;
  selectedAnswer: number;
  timeMs: number;
}

// ---- Resultado ruleta ----
export interface WheelResult {
  angle: number;
  category: string;
  categoryName: string;
}

// ---- Actualizacion puntaje ----
export interface ScoreUpdate {
  playerId: number;
  seals?: Record<string, number>;
  brokenCount?: number;
  correctCount?: number;
  wrongCount?: number;
  score?: number;
  diceValue?: number;
}

// ---- Timer ----
export interface TimerData {
  remaining: number;
  total: number;
  active: boolean;
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

// ---- Estado global del servidor ----
export interface GameServer {
  clients: Map<WebSocket, Client>;
  rooms: Map<string, Room>;
  games: Map<string, GameState>;
  players: Map<number, PlayerInfo>;
  chatHistory: Map<string, ChatMessageData[]>;
}

// ---- Categorias del juego ----
export const GAME_CATEGORIES = [
  { id: "historia", name: "Historia Biblica", color: "#92400E" },
  { id: "personajes", name: "Personajes", color: "#14B8A6" },
  { id: "libros", name: "Libros", color: "#3B82F6" },
  { id: "ensenanzas", name: "Ensenanzas", color: "#7C3AED" },
  { id: "geografia", name: "Geografia", color: "#6B7280" },
  { id: "profecias", name: "Profecias", color: "#F59E0B" },
  { id: "nuevo_testamento", name: "Nuevo Testamento", color: "#8B5CF6" },
];

export const SEALS_TO_BREAK = 2;
export const QUESTION_TIME_MS = 15000;
