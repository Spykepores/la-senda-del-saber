// ============================================================
// DUEL ENGINE - Funciones puras de calculo de duelo
// Compartido entre tRPC router y WebSocket bridge
// ============================================================

export const SEALS_TO_BREAK = 2;
export const CATEGORIES = ["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"];

export interface DuelStateDTO {
  id: number;
  challengerId: number;
  opponentId: number;
  status: "pending" | "active" | "completed" | "cancelled";
  winnerId: number | null;
  challengerScore: number;
  opponentScore: number;
  challengerStreak: number;
  opponentStreak: number;
  challengerSeals: Record<string, number>;
  opponentSeals: Record<string, number>;
  currentRound: number;
  currentCategory: string | null;
  currentQuestionId: number | null;
  currentTurnUserId: number | null;
  roomCode: string | null;
  challengerName?: string;
  opponentName?: string;
}

export type DuelAction =
  | { kind: "roll_dice"; playerId: number; diceValue: number }
  | { kind: "start_turn"; playerId: number }
  | { kind: "roulette_result"; playerId: number; category: string }
  | { kind: "submit_answer"; playerId: number; questionId: number; selectedOption: number; correct: boolean }
  | { kind: "forfeit"; playerId: number }
  | { kind: "set_turn"; playerId: number };

// ---- Parsear sellos desde JSON string ----
export function parseSeals(json: string | null): Record<string, number> {
  try {
    if (json) return JSON.parse(json);
  } catch { /* */ }
  const seals: Record<string, number> = {};
  CATEGORIES.forEach((c) => (seals[c] = 0));
  return seals;
}

// ---- Calcular sellos rotos ----
export function countBrokenSeals(seals: Record<string, number>): number {
  return Object.values(seals).filter((v) => v >= SEALS_TO_BREAK).length;
}

// ---- Verificar si todos los sellos estan rotos ----
export function allSealsBroken(seals: Record<string, number>): boolean {
  return CATEGORIES.every((cat) => (seals[cat] || 0) >= SEALS_TO_BREAK);
}

// ---- Construir DTO desde fila de DB ----
export function buildDuelStateDTO(row: any, challengerName?: string, opponentName?: string): DuelStateDTO {
  return {
    id: row.id,
    challengerId: row.challengerId,
    opponentId: row.opponentId,
    status: row.status,
    winnerId: row.winnerId || null,
    challengerScore: row.challengerScore || 0,
    opponentScore: row.opponentScore || 0,
    challengerStreak: row.challengerStreak || 0,
    opponentStreak: row.opponentStreak || 0,
    challengerSeals: parseSeals(row.challengerSeals),
    opponentSeals: parseSeals(row.opponentSeals),
    currentRound: row.currentRound || 1,
    currentCategory: row.currentCategory || null,
    currentQuestionId: row.currentQuestionId || null,
    currentTurnUserId: row.currentTurnUserId || null,
    roomCode: row.roomCode || null,
    challengerName,
    opponentName,
  };
}

// ---- Determinar el otro jugador ----
export function getOtherPlayerId(state: DuelStateDTO, playerId: number): number {
  return state.challengerId === playerId ? state.opponentId : state.challengerId;
}

// ---- Verificar si un jugador es challenger ----
export function isChallenger(state: DuelStateDTO, playerId: number): boolean {
  return state.challengerId === playerId;
}

// ---- Obtener sellos de un jugador ----
export function getPlayerSeals(state: DuelStateDTO, playerId: number): Record<string, number> {
  return isChallenger(state, playerId) ? state.challengerSeals : state.opponentSeals;
}

// ---- Procesar respuesta correcta (retorna nuevo estado y si gano) ----
export function processCorrectAnswer(
  state: DuelStateDTO,
  playerId: number
): { state: DuelStateDTO; won: boolean } {
  const newState = { ...state };
  const isChal = isChallenger(newState, playerId);
  const cat = newState.currentCategory || "doctrine";

  // Update seals
  const seals = { ...getPlayerSeals(newState, playerId) };
  seals[cat] = (seals[cat] || 0) + 1;

  if (isChal) {
    newState.challengerSeals = seals;
    newState.challengerStreak += 1;
    newState.challengerScore += 1;
  } else {
    newState.opponentSeals = seals;
    newState.opponentStreak += 1;
    newState.opponentScore += 1;
  }

  // Check win
  if (allSealsBroken(seals)) {
    newState.status = "completed";
    newState.winnerId = playerId;
    return { state: newState, won: true };
  }

  return { state: newState, won: false };
}

// ---- Procesar respuesta incorrecta (cambia turno) ----
export function processWrongAnswer(state: DuelStateDTO, playerId: number): DuelStateDTO {
  const newState = { ...state };
  const isChal = isChallenger(newState, playerId);

  if (isChal) {
    newState.challengerStreak = 0;
  } else {
    newState.opponentStreak = 0;
  }

  // Switch turn
  newState.currentTurnUserId = getOtherPlayerId(newState, playerId);
  return newState;
}

// ---- Procesar forfeit ----
export function processForfeit(state: DuelStateDTO, playerId: number): DuelStateDTO {
  return {
    ...state,
    status: "completed",
    winnerId: getOtherPlayerId(state, playerId),
  };
}

// ---- Determinar quien empieza por dados ----
export function determineFirstTurn(challengerDice: number, opponentDice: number): { firstTurnId: "challenger" | "opponent" | "tie"; challengerDice: number; opponentDice: number } {
  if (challengerDice > opponentDice) return { firstTurnId: "challenger", challengerDice, opponentDice };
  if (opponentDice > challengerDice) return { firstTurnId: "opponent", challengerDice, opponentDice };
  return { firstTurnId: "tie", challengerDice, opponentDice };
}

// ---- Roll dice ----
export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ---- Validar que un jugador puede actuar en este desafio ----
export function canPlayerAct(state: DuelStateDTO, playerId: number): boolean {
  if (state.status !== "active") return false;
  return state.challengerId === playerId || state.opponentId === playerId;
}

// ---- Obtener updates para DB desde estado modificado ----
export function getDbUpdates(state: DuelStateDTO, playerId: number): Record<string, any> {
  const isChal = isChallenger(state, playerId);
  const updates: Record<string, any> = {};

  if (isChal) {
    updates.challengerSeals = JSON.stringify(state.challengerSeals);
    updates.challengerStreak = state.challengerStreak;
    updates.challengerScore = state.challengerScore;
  } else {
    updates.opponentSeals = JSON.stringify(state.opponentSeals);
    updates.opponentStreak = state.opponentStreak;
    updates.opponentScore = state.opponentScore;
  }

  if (state.status === "completed") {
    updates.status = "completed";
    updates.winnerId = state.winnerId;
    updates.endedAt = new Date();
  }

  if (state.currentTurnUserId !== null) {
    updates.currentTurnUserId = state.currentTurnUserId;
  }

  return updates;
}
