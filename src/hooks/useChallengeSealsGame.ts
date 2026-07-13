import { useState, useEffect, useRef, useCallback } from "react";
import { CATEGORIES } from "@/types/game";

export const SEALS_TO_BREAK = 2;
export const QUESTION_TIME_MS = 15000;

export type GamePhase = "dice_roll" | "waiting" | "roulette" | "question" | "result" | "finished" | "forfeit";

export interface SealProgress { [category: string]: number; }

export interface ChallengePlayerState {
  userId: number; name: string;
  seals: SealProgress;
  brokenCount: number;
  correctCount: number;
  wrongCount: number;
  totalTimeMs: number;
  diceValue?: number;
}

export interface ChallengeSealsState {
  challengeId: number;
  p1: ChallengePlayerState;
  p2: ChallengePlayerState;
  currentTurnId: number;
  phase: GamePhase;
  winnerId?: number | null;
  currentCategory?: string;
  questionStartTime: number;
  forfeitBy?: number;
  winReason?: "all_seals" | "forfeit" | "forfeit_other";
  lastAnswerCorrect?: boolean;
  diceRolled: boolean;
  diceWinnerId?: number;
}

function sKey(cid: number) { return `senda_seals_${cid}`; }

export function loadSealsState(cid: number): ChallengeSealsState | null {
  try { const r = localStorage.getItem(sKey(cid)); if (r) return JSON.parse(r); } catch { /* */ }
  return null;
}

function persist(s: ChallengeSealsState) { localStorage.setItem(sKey(s.challengeId), JSON.stringify(s)); }

export function initSealsState(cid: number, c1id: number, c1name: string, c2id: number, c2name: string, isJoining: boolean): ChallengeSealsState {
  const empty: SealProgress = {};
  CATEGORIES.forEach(c => (empty[c.id] = 0));

  // When joining a room (not being challenged directly), start with dice roll
  // When accepting a challenge, the acceptor starts (no dice)
  const startWithDice = !isJoining;

  const s: ChallengeSealsState = {
    challengeId: cid,
    p1: { userId: c1id, name: c1name, seals: { ...empty }, brokenCount: 0, correctCount: 0, wrongCount: 0, totalTimeMs: 0 },
    p2: { userId: c2id, name: c2name, seals: { ...empty }, brokenCount: 0, correctCount: 0, wrongCount: 0, totalTimeMs: 0 },
    currentTurnId: startWithDice ? 0 : c2id, // 0 means no one, dice decides
    phase: startWithDice ? "dice_roll" : "waiting",
    questionStartTime: Date.now(),
    diceRolled: !startWithDice,
  };
  persist(s);
  return s;
}

export function useChallengeSealsGame(challengeId: number, userId: number) {
  const [state, setState] = useState<ChallengeSealsState | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load state
  useEffect(() => {
    if (challengeId <= 0) return;
    const s = loadSealsState(challengeId);
    if (s) setState(s);
  }, [challengeId]);

  // Timer
  useEffect(() => {
    if (!state || state.phase !== "question") {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    setTimeLeft(QUESTION_TIME_MS);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state?.phase]);

  const isMyTurn = state?.currentTurnId === userId;
  const myState: ChallengePlayerState | null = state ? (state.p1.userId === userId ? state.p1 : state.p2.userId === userId ? state.p2 : null) : null;
  const oppState: ChallengePlayerState | null = state ? (state.p1.userId === userId ? state.p2 : state.p2.userId === userId ? state.p1 : null) : null;

  const timerPct = state?.phase === "question" && isMyTurn
    ? Math.max(0, (timeLeft / QUESTION_TIME_MS) * 100)
    : 100;
  const timerColor = timerPct > 50 ? "#10B981" : timerPct > 25 ? "#F59E0B" : "#EF4444";

  const rollDice = useCallback(() => {
    setState(prev => {
      if (!prev || prev.phase !== "dice_roll") return prev;
      const p1Dice = Math.floor(Math.random() * 6) + 1;
      const p2Dice = Math.floor(Math.random() * 6) + 1;
      const next: ChallengeSealsState = {
        ...prev,
        p1: { ...prev.p1, diceValue: p1Dice },
        p2: { ...prev.p2, diceValue: p2Dice },
        diceRolled: true,
      };
      // Decide winner after a delay
      setTimeout(() => {
        const winnerId = p1Dice >= p2Dice ? prev.p1.userId : prev.p2.userId;
        setState(p => {
          if (!p) return p;
          const updated = { ...p, currentTurnId: winnerId, phase: "waiting" as GamePhase, diceWinnerId: winnerId };
          persist(updated);
          return updated;
        });
      }, 2000);
      persist(next);
      return next;
    });
  }, []);

  const startTurn = useCallback((category?: string) => {
    setState(prev => {
      if (!prev) return prev;
      const cat = category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].id;
      const next: ChallengeSealsState = { ...prev, phase: "roulette", currentCategory: cat, questionStartTime: Date.now() };
      persist(next);
      return next;
    });
  }, []);

  const onRouletteComplete = useCallback(() => {
    setState(prev => {
      if (!prev) return prev;
      const next: ChallengeSealsState = { ...prev, phase: "question", questionStartTime: Date.now() };
      persist(next);
      return next;
    });
  }, []);

  const submitAnswer = useCallback((correct: boolean) => {
    setState(prev => {
      if (!prev || !myState) return prev;
      const isP1 = prev.p1.userId === userId;
      const playerKey = isP1 ? "p1" : "p2";
      const player = { ...prev[playerKey] };

      if (correct) {
        const cat = prev.currentCategory || "doctrine";
        player.seals = { ...player.seals, [cat]: (player.seals[cat] || 0) + 1 };
        player.correctCount++;
        if (player.seals[cat] >= SEALS_TO_BREAK) player.brokenCount++;

        const allBroken = Object.values(player.seals).every(v => v >= SEALS_TO_BREAK);
        if (allBroken) {
          const next: ChallengeSealsState = {
            ...prev,
            [playerKey]: player,
            phase: "finished",
            winnerId: userId,
            lastAnswerCorrect: true,
            winReason: "all_seals",
          };
          persist(next);
          return next;
        }

        const next: ChallengeSealsState = { ...prev, [playerKey]: player, phase: "result", lastAnswerCorrect: true };
        persist(next);
        return next;
      } else {
        player.wrongCount++;
        const otherId = isP1 ? prev.p2.userId : prev.p1.userId;
        const next: ChallengeSealsState = {
          ...prev,
          [playerKey]: player,
          currentTurnId: otherId,
          phase: "result",
          lastAnswerCorrect: false,
        };
        persist(next);
        return next;
      }
    });
  }, [userId, myState]);

  const continueAfterCorrect = useCallback(() => {
    setState(prev => {
      if (!prev) return prev;
      const next: ChallengeSealsState = { ...prev, phase: "roulette" };
      persist(next);
      return next;
    });
  }, []);

  const forfeit = useCallback(() => {
    setState(prev => {
      if (!prev) return prev;
      const otherId = prev.p1.userId === userId ? prev.p2.userId : prev.p1.userId;
      const next: ChallengeSealsState = {
        ...prev,
        phase: "finished",
        winnerId: otherId,
        forfeitBy: userId,
        winReason: "forfeit",
      };
      persist(next);
      return next;
    });
  }, [userId]);

  const isFinished = state?.phase === "finished";
  const currentCategory = state?.currentCategory;
  const diceRolled = state?.diceRolled ?? false;
  const myDice = myState?.diceValue ?? 0;
  const oppDice = oppState?.diceValue ?? 0;
  const diceWinnerId = state?.diceWinnerId;
  const phase = state?.phase || "waiting";

  return {
    state, myState, oppState,
    isMyTurn, isFinished, phase,
    submitAnswer, forfeit,
    timeLeft, timerPct, timerColor,
    currentCategory,
    startTurn, onRouletteComplete,
    continueAfterCorrect,
    diceRolled, myDice, oppDice, diceWinnerId, rollDice,
  };
}
