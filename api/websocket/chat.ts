import type { GameServer, ChatMessageData } from "./types";

// ============================================================
// GESTION DE CHAT POR SALAS
// ============================================================

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
  server: GameServer,
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

  if (!server.chatHistory.has(roomId)) {
    server.chatHistory.set(roomId, []);
  }
  const history = server.chatHistory.get(roomId)!;
  history.push(message);
  if (history.length > MAX_MESSAGES) history.shift();

  return message;
}

export function getChatHistory(server: GameServer, roomId: string): ChatMessageData[] {
  return server.chatHistory.get(roomId) || [];
}

export function clearChatHistory(server: GameServer, roomId: string): void {
  server.chatHistory.delete(roomId);
}
