// ============================================================
// GAME SOCKET BRIDGE - Puente entre WebSocket y DB (tRPC)
// Recibe DuelAction desde WS, ejecuta logica contra Postgres,
// y devuelve el nuevo estado para broadcast.
// ============================================================

import { eq } from "drizzle-orm";
import { challenges, questions } from "../db/schema";
import { getDb } from "./queries/connection";
import {
  type DuelStateDTO,
  type DuelAction,
  buildDuelStateDTO,
  canPlayerAct,
  resolveDiceRoll,
  startRoulette,
  processCorrectAnswer,
  processWrongAnswer,
  processForfeit,
  getDbUpdates,
} from "./lib/duel-engine";

export interface GameActionResult {
  state: DuelStateDTO;
  error?: string;
  broadcast: boolean;
}

// ---- Obtener estado actual de DB ----
async function loadState(challengeId: number): Promise<DuelStateDTO | null> {
  const db = getDb();
  const [row] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!row) return null;

  // Get names
  const { getUserName } = await import("./challenge-router");
  const challengerName = (await getUserName(row.challengerId)) || undefined;
  const opponentName = row.opponentId ? ((await getUserName(row.opponentId)) || undefined) : undefined;

  return buildDuelStateDTO(row, challengerName, opponentName);
}

// ---- Guardar estado a DB ----
async function saveState(challengeId: number, state: DuelStateDTO): Promise<void> {
  const db = getDb();
  await db.update(challenges).set(getDbUpdates(state)).where(eq(challenges.id, challengeId));
}

// ---- Aplicar accion ----
export async function applyGameAction(
  challengeId: number,
  action: DuelAction,
  playerId: number
): Promise<GameActionResult> {
  // Load state
  const state = await loadState(challengeId);
  if (!state) return { state: {} as DuelStateDTO, error: "Desafio no encontrado", broadcast: false };

  // Validate player can act
  if (!canPlayerAct(state, playerId)) {
    return { state, error: "No puedes actuar en este desafio", broadcast: false };
  }

  // Validate it's the player's turn for actions that require it
  if (state.currentTurnUserId && state.currentTurnUserId !== playerId) {
    if (action.kind === "start_turn" || action.kind === "submit_answer") {
      return { state, error: "No es tu turno", broadcast: false };
    }
  }

  // Validate phase for the action
  if (action.kind === "roll_dice" && state.phase !== "dice_roll") {
    return { state, error: "La fase de dados ya termino", broadcast: false };
  }
  if (action.kind === "start_turn" && state.phase !== "waiting") {
    return { state, error: "No puedes iniciar turno ahora", broadcast: false };
  }
  if (action.kind === "submit_answer" && state.phase !== "question") {
    return { state, error: "No hay pregunta activa", broadcast: false };
  }

  switch (action.kind) {
    case "roll_dice": {
      const newState = resolveDiceRoll(state, playerId, action.diceValue || Math.floor(Math.random() * 6) + 1);
      await saveState(challengeId, newState);
      return { state: newState, broadcast: true };
    }

    case "start_turn": {
      // Server decides the category (roulette)
      const newState = startRoulette(state, playerId);
      await saveState(challengeId, newState);
      return { state: newState, broadcast: true };
    }

    case "submit_answer": {
      // VALIDATE ANSWER SERVER-SIDE: load question from DB, compare
      const db = getDb();
      const [question] = await db.select().from(questions).where(eq(questions.id, action.questionId)).limit(1);

      if (!question) {
        return { state, error: "Pregunta no encontrada", broadcast: false };
      }

      const correct = question.correctAnswer === action.selectedOption;

      // Track current question as used
      const s = { ...state, currentQuestionId: action.questionId };

      if (correct) {
        const { state: newState, won } = processCorrectAnswer(s, playerId);
        await saveState(challengeId, newState);
        return { state: newState, broadcast: true };
      } else {
        const newState = processWrongAnswer(s, playerId);
        await saveState(challengeId, newState);
        return { state: newState, broadcast: true };
      }
    }

    case "forfeit": {
      const newState = processForfeit(state, playerId);
      await saveState(challengeId, newState);
      return { state: newState, broadcast: true };
    }

    case "set_turn": {
      const newState = { ...state, currentTurnUserId: action.playerId || playerId };
      await saveState(challengeId, newState);
      return { state: newState, broadcast: true };
    }

    default:
      return { state, error: "Accion no reconocida", broadcast: false };
  }
}

// ---- Obtener estado para broadcast ----
export async function getFullGameState(challengeId: number): Promise<DuelStateDTO | null> {
  return loadState(challengeId);
}
