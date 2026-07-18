// ============================================================
// DUEL ENGINE - Funciones puras de calculo de duelo
// Compartido entre tRPC router y WebSocket bridge
// ============================================================

export const SEALS_TO_BREAK = 2;
export const CATEGORIES = ["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"];

export type GamePhase = "dice_roll" | "waiting" | "roulette" | "question" | "result" | "finished" | "forfeit";

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
  phase: GamePhase;
  challengerDice: number | null;
  opponentDice: number | null;
  roomCode: string | null;
  challengerName?: string;
  opponentName?: string;
}

export type DuelAction =
  | { kind: "roll_dice"; playerId: number; diceValue: number }
  | { kind: "start_turn"; playerId: number }
  | { kind: "submit_answer"; playerId: number; questionId: number; selectedOption: number }
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
    phase: row.phase || "dice_roll",
    challengerDice: row.challengerDice || null,
    opponentDice: row.opponentDice || null,
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

// ---- Roll dice ----
export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ---- Validar que un jugador puede actuar en este desafio ----
export function canPlayerAct(state: DuelStateDTO, playerId: number): boolean {
  if (state.status !== "active") return false;
  return state.challengerId === playerId || state.opponentId === playerId;
}

// ---- RESOLVER DADOS: guarda dado, decide turno si ambos tiraron ----
export function resolveDiceRoll(state: DuelStateDTO, playerId: number, diceValue: number): DuelStateDTO {
  const newState = { ...state };
  const isChal = isChallenger(newState, playerId);

  if (isChal) {
    newState.challengerDice = diceValue;
  } else {
    newState.opponentDice = diceValue;
  }

  // Si ambos ya tiraron, comparar
  if (newState.challengerDice !== null && newState.opponentDice !== null) {
    if (newState.challengerDice > newState.opponentDice) {
      newState.currentTurnUserId = newState.challengerId;
      newState.phase = "waiting";
    } else if (newState.opponentDice > newState.challengerDice) {
      newState.currentTurnUserId = newState.opponentId;
      newState.phase = "waiting";
    } else {
      // Empate: limpiar dados, mantener dice_roll
      newState.challengerDice = null;
      newState.opponentDice = null;
      newState.phase = "dice_roll";
    }
  }
  // Si falta uno, seguir en dice_roll

  return newState;
}

// ---- START ROULETTE: sortea categoria en servidor ----
export function startRoulette(state: DuelStateDTO, _playerId: number): DuelStateDTO {
  const newState = { ...state };
  const seals = getPlayerSeals(newState, newState.currentTurnUserId || _playerId);

  // Solo elegir categorias que el jugador no ha completado
  const avail = CATEGORIES.filter((cat) => (seals[cat] || 0) < SEALS_TO_BREAK);
  const pool = avail.length > 0 ? avail : CATEGORIES;
  const category = pool[Math.floor(Math.random() * pool.length)];

  newState.currentCategory = category;
  newState.phase = "question";

  return newState;
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
    newState.phase = "finished";
    return { state: newState, won: true };
  }

  // No gano aun: fase "result" (tiene otra pregunta del mismo sello o pasa)
  newState.phase = "result";
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
  newState.phase = "waiting";
  return newState;
}

// ---- Procesar forfeit ----
export function processForfeit(state: DuelStateDTO, playerId: number): DuelStateDTO {
  return {
    ...state,
    status: "completed",
    winnerId: getOtherPlayerId(state, playerId),
    phase: "forfeit",
  };
}

// ---- Obtener updates para DB desde estado modificado ----
export function getDbUpdates(state: DuelStateDTO): Record<string, any> {
  const updates: Record<string, any> = {
    challengerSeals: JSON.stringify(state.challengerSeals),
    opponentSeals: JSON.stringify(state.opponentSeals),
    challengerStreak: state.challengerStreak,
    opponentStreak: state.opponentStreak,
    challengerScore: state.challengerScore,
    opponentScore: state.opponentScore,
    currentRound: state.currentRound,
    currentCategory: state.currentCategory,
    currentTurnUserId: state.currentTurnUserId,
    currentQuestionId: state.currentQuestionId,
    status: state.status,
    phase: state.phase,
    challengerDice: state.challengerDice,
    opponentDice: state.opponentDice,
  };

  if (state.winnerId !== null) {
    updates.winnerId = state.winnerId;
    updates.endedAt = new Date();
  }

  return updates;
}
