import { useState, useEffect, useRef, useCallback } from "react";
import { CATEGORIES } from "@/types/game";
import { trpc } from "@/providers/trpc";
import type { Question } from "@/types/game";

export const SEALS_TO_BREAK = 2; // sellos para ganar
export const QUESTION_TIME_MS = 15000;

export type GamePhase = "dice_roll" | "waiting" | "roulette" | "question" | "result" | "finished" | "forfeit";

export interface SealProgress { [category: string]: number; }

export interface ChallengePlayerState {
  userId: number;
  seals: SealProgress;
  broken: string[];
  score: number;
  streak: number;
  questionCount: number;
  correctCount: number;
}

export interface ChallengeSealsState {
  id: number;
  status: "waiting" | "active" | "finished" | "forfeit";
  phase: GamePhase;
  currentPlayerId: number | null;
  challenger: ChallengePlayerState;
  opponent: ChallengePlayerState;
  winnerId: number | null;
  currentCategory: string | null;
  currentQuestionId: number | null;
  lastAnswerCorrect: boolean | null;
  forfeitBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export function useChallengeSealsGame(cid: number, uid: number) {
  const utils = trpc.useUtils();
  const [state, setState] = useState<ChallengeSealsState | null>(null);
  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [question, setQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [myState, setMyState] = useState<ChallengePlayerState | null>(null);
  const [oppState, setOppState] = useState<ChallengePlayerState | null>(null);
  const [diceRolled, setDiceRolled] = useState(false);
  const [myDice, setMyDice] = useState(1);
  const [oppDice, setOppDice] = useState(1);
  const [diceWinnerId, setDiceWinnerId] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ playerId: number; value: number } | null>(null);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<{ correct: boolean; selectedOption: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justBroke, setJustBroke] = useState(false);
  const [justBrokeCategory, setJustBrokeCategory] = useState<string | null>(null);

  // Poll for state
  const { data: challengeData } = trpc.duel.get.useQuery(
    { challengeId: cid },
    { enabled: cid > 0, refetchInterval: 1500 }
  );

  useEffect(() => {
    if (challengeData) {
      const gs = challengeData.gameState as any;
      if (gs) {
        setState(gs);
        setPhase(gs.phase || "waiting");
        setIsFinished(gs.status === "finished" || gs.status === "forfeit");
        setDiceWinnerId(gs.currentPlayerId);
        if (gs.challenger?.userId === uid) {
          setMyState(gs.challenger);
          setOppState(gs.opponent);
          setIsMyTurn(gs.currentPlayerId === uid);
        } else {
          setMyState(gs.opponent);
          setOppState(gs.challenger);
          setIsMyTurn(gs.currentPlayerId === uid);
        }
      }
    }
  }, [challengeData, uid]);

  // Timer
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 100) { setTimerActive(false); return 0; }
          return prev - 100;
        });
      }, 100);
    } else if (timeLeft <= 0) {
      setTimerActive(false);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, timeLeft]);

  const timerPct = timeLeft / QUESTION_TIME_MS;
  const timerColor = timerPct > 0.6 ? "#10B981" : timerPct > 0.3 ? "#F59E0B" : "#EF4444";
  const currentCategory = state?.currentCategory || null;

  const startTurn = useCallback(async () => {
    if (!cid || !uid) return;
    setIsRolling(true);
    setDiceRolled(false);
    const value = Math.floor(Math.random() * 6) + 1;
    setMyDice(value);
    setRollResult({ playerId: uid, value });
    try {
      await utils.client.duel.action.mutate({
        challengeId: cid,
        action: { kind: "roll_dice", playerId: uid, diceValue: value },
      });
      setDiceRolled(true);
    } catch (e) { console.error(e); }
    setIsRolling(false);
  }, [cid, uid, utils]);

  const onRouletteComplete = useCallback(async (category: string) => {
    if (!cid || !uid) return;
    setRouletteSpinning(false);
    setRouletteResult(category);
    try {
      await utils.client.duel.action.mutate({
        challengeId: cid,
        action: { kind: "roulette_result", playerId: uid, category },
      });
    } catch (e) { console.error(e); }
  }, [cid, uid, utils]);

  const submitAnswer = useCallback(async (selectedOption: number, _timeMs?: number) => {
    if (!cid || !uid || !state?.currentQuestionId) return;
    setIsSubmitting(true);
    try {
      const result = await utils.client.duel.submitAnswer.mutate({
        challengeId: cid,
        questionId: state.currentQuestionId,
        selectedOption,
      });
      setResultData({ correct: result.correct, selectedOption });
      setShowResult(true);
    } catch (e) { console.error(e); }
    setIsSubmitting(false);
  }, [cid, uid, state, utils]);

  const continueAfterCorrect = useCallback(async () => {
    setShowResult(false);
    setResultData(null);
    if (!cid || !uid) return;
    try {
      await utils.client.duel.action.mutate({
        challengeId: cid,
        action: { kind: "set_turn", playerId: uid },
      });
    } catch (e) { console.error(e); }
  }, [cid, uid, utils]);

  const forfeit = useCallback(async () => {
    if (!cid || !uid) return;
    try {
      await utils.client.duel.forfeit.mutate({ challengeId: cid });
    } catch (e) { console.error(e); }
  }, [cid, uid]);

  return {
    state, phase, question, timeLeft, timerActive, timerPct, timerColor,
    isMyTurn, isFinished, myState, oppState,
    diceRolled, myDice, oppDice, diceWinnerId, isRolling, rollResult,
    rouletteSpinning, rouletteResult, showResult, resultData,
    isSubmitting, justBroke, justBrokeCategory,
    startTurn, onRouletteComplete, submitAnswer, continueAfterCorrect, forfeit,
    currentCategory,
  };
}
