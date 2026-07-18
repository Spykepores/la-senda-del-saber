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
  parseSeals,
  countBrokenSeals,
  allSealsBroken,
  getOtherPlayerId,
  isChallenger,
  getPlayerSeals,
  processCorrectAnswer,
  processWrongAnswer,
  processForfeit,
  canPlayerAct,
  rollDice,
  SEALS_TO_BREAK,
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
  const isChal = (pid: number) => state.challengerId === pid;

  const update: Record<string, any> = {
    challengerSeals: JSON.stringify(state.challengerSeals),
    opponentSeals: JSON.stringify(state.opponentSeals),
    challengerStreak: state.challengerStreak,
    opponentStreak: state.opponentStreak,
    challengerScore: state.challengerScore,
    opponentScore: state.opponentScore,
    currentRound: state.currentRound,
    currentCategory: state.currentCategory,
    currentTurnUserId: state.currentTurnUserId,
    status: state.status,
  };

  if (state.winnerId !== null) {
    update.winnerId = state.winnerId;
    update.endedAt = new Date();
  }

  await db.update(challenges).set(update).where(eq(challenges.id, challengeId));
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

  switch (action.kind) {
    case "roll_dice": {
      const diceValue = action.diceValue || rollDice();
      const newState = { ...state };

      // Store dice value on the player
      if (isChallenger(newState, playerId)) {
        (newState as any).challengerDice = diceValue;
      } else {
        (newState as any).opponentDice = diceValue;
      }

      await saveState(challengeId, newState);
      return { state: newState, broadcast: true };
    }

    case "start_turn": {
      // Just confirmation that player is starting their turn
      return { state, broadcast: false };
    }

    case "roulette_result": {
      // Set the current category from the roulette spin
      const newState = { ...state, currentCategory: action.category || "doctrine" };
      await saveState(challengeId, newState);
      return { state: newState, broadcast: true };
    }

    case "submit_answer": {
      const correct = action.correct ?? false;

      if (correct) {
        const { state: newState, won } = processCorrectAnswer(state, playerId);
        await saveState(challengeId, newState);
        return { state: newState, broadcast: true };
      } else {
        const newState = processWrongAnswer(state, playerId);
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

// ---- Obtener pregunta para una categoria ----
export async function getQuestionForCategory(
  category: string,
  excludeQuestionId?: number
): Promise<{ id: number; question: string; options: string[]; correctAnswer: number; explanation: string } | null> {
  const db = getDb();
  const { and, eq, ne } = await import("drizzle-orm");

  const pool = await db
    .select()
    .from(questions)
    .where(and(eq(questions.category, category as any), eq(questions.isActive, true), ne(questions.id, excludeQuestionId || 0)));

  if (pool.length === 0) {
    const fallback = await db
      .select()
      .from(questions)
      .where(and(eq(questions.category, category as any), eq(questions.isActive, true)));
    if (fallback.length === 0) return null;
    const q = fallback[Math.floor(Math.random() * fallback.length)];
    return { id: q.id, question: q.question, options: [q.option1, q.option2, q.option3, q.option4], correctAnswer: q.correctAnswer, explanation: q.explanation || "" };
  }

  const q = pool[Math.floor(Math.random() * pool.length)];
  return { id: q.id, question: q.question, options: [q.option1, q.option2, q.option3, q.option4], correctAnswer: q.correctAnswer, explanation: q.explanation || "" };
}

// ---- Obtener estado para broadcast (incluye pregunta actual) ----
export async function getFullGameState(challengeId: number): Promise<DuelStateDTO | null> {
  return loadState(challengeId);
}
