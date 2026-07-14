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
    diceRolled: false,
  };
  persist(s);
  return s;
}

export function useChallengeSealsGame(cid: number, uid: number, cInfo?: { cId: number; cName: string; oId: number; oName: string; isJoining?: boolean }) {
  const [state, setState] = useState<ChallengeSealsState | null>(() => {
    let s = loadSealsState(cid);
    if (!s && cInfo) {
      s = initSealsState(cid, cInfo.cId, cInfo.cName, cInfo.oId, cInfo.oName, cInfo.isJoining ?? false);
    }
    return s;
  });
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const uidRef = useRef(uid);
  const timeRef = useRef(QUESTION_TIME_MS);
  uidRef.current = uid;
  timeRef.current = timeLeft;

  // Cross-tab sync
  useEffect(() => {
    const bc = new BroadcastChannel(`senda_seals_${cid}`);
    bcRef.current = bc;
    bc.onmessage = (ev) => {
      if (ev.data?.type === "seals_update" && ev.data?.cid === cid) {
        setState({ ...ev.data.state });
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === sKey(cid) && e.newValue) {
        try { setState(JSON.parse(e.newValue)); } catch { /* */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => { bc.close(); window.removeEventListener("storage", onStorage); };
  }, [cid]);

  const broadcast = useCallback((s: ChallengeSealsState) => {
    persist(s);
    setState({ ...s });
    bcRef.current?.postMessage({ type: "seals_update", cid, state: s });
  }, [cid]);

  const myState = state ? (state.p1.userId === uid ? state.p1 : state.p2) : null;
  const oppState = state ? (state.p1.userId === uid ? state.p2 : state.p1) : null;
  const isMyTurn = state?.currentTurnId === uid;
  const isFinished = state?.phase === "finished" || state?.phase === "forfeit";

  // Timer
  const canAnswer = (state?.phase === "question" || state?.phase === "roulette") && isMyTurn;
  useEffect(() => {
    if (!canAnswer || isFinished) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    setTimeLeft(QUESTION_TIME_MS);
    timeRef.current = QUESTION_TIME_MS;
    timerRef.current = setInterval(() => {
      timeRef.current -= 150;
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        const me = uidRef.current;
        setState((gs) => {
          if (!gs || gs.phase !== "question" || gs.currentTurnId !== me) return gs;
          const ns = processWrong(gs, me);
          persist(ns);
          bcRef.current?.postMessage({ type: "seals_update", cid, state: ns });
          return { ...ns };
        });
      }
    }, 150);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [canAnswer, isFinished, cid]);

  // DICE ROLL
  const rollDice = useCallback(() => {
    const me = uidRef.current;
    const diceValue = Math.floor(Math.random() * 6) + 1; // 1-6

    setState((prev) => {
      if (!prev || prev.phase !== "dice_roll") return prev;
      const isP1 = prev.p1.userId === me;
      const ns: ChallengeSealsState = {
        ...prev,
        [isP1 ? "p1" : "p2"]: { ...(isP1 ? prev.p1 : prev.p2), diceValue },
      };

      // Check if both players have rolled
      const p1Roll = isP1 ? diceValue : (ns.p1.diceValue ?? 0);
      const p2Roll = isP1 ? (ns.p2.diceValue ?? 0) : diceValue;

      if (p1Roll > 0 && p2Roll > 0) {
        // Both rolled - determine winner
        ns.diceRolled = true;
        if (p1Roll > p2Roll) {
          ns.currentTurnId = ns.p1.userId;
          ns.diceWinnerId = ns.p1.userId;
        } else if (p2Roll > p1Roll) {
          ns.currentTurnId = ns.p2.userId;
          ns.diceWinnerId = ns.p2.userId;
        } else {
          // Tie - reset dice for re-roll
          ns.p1 = { ...ns.p1, diceValue: undefined };
          ns.p2 = { ...ns.p2, diceValue: undefined };
          ns.diceRolled = false;
        }
        // Move to waiting phase (highest roller's turn)
        if (ns.diceRolled) {
          ns.phase = "waiting";
        }
      }

      persist(ns);
      bcRef.current?.postMessage({ type: "seals_update", cid, state: ns });
      return { ...ns };
    });

    return diceValue;
  }, [cid]);

  const startTurn = useCallback(() => {
    setState((prev) => {
      if (!prev || prev.currentTurnId !== uidRef.current) return prev;
      const ns: ChallengeSealsState = { ...prev, phase: "roulette", questionStartTime: Date.now() };
      persist(ns);
      return ns;
    });
  }, []);

  const onRouletteComplete = useCallback((category: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const ns: ChallengeSealsState = { ...prev, phase: "question", currentCategory: category, questionStartTime: Date.now() };
      persist(ns);
      bcRef.current?.postMessage({ type: "seals_update", cid, state: ns });
      return ns;
    });
  }, [cid]);

  const submitAnswer = useCallback((correct: boolean, timeMs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const me = uidRef.current;
    setState((prev) => {
      if (!prev || prev.phase !== "question" || prev.currentTurnId !== me) return prev;
      if (correct) {
        const ns = processCorrect(prev, me, timeMs);
        broadcast(ns);
        return { ...ns };
      } else {
        const ns = processWrong(prev, me);
        broadcast(ns);
        return { ...ns };
      }
    });
  }, [broadcast]);

  const continueAfterCorrect = useCallback(() => {
    setState((prev) => {
      if (!prev || prev.currentTurnId !== uidRef.current) return prev;
      const ns: ChallengeSealsState = { ...prev, phase: "roulette", questionStartTime: Date.now() };
      persist(ns);
      return ns;
    });
  }, []);

  const forfeit = useCallback(() => {
    const me = uidRef.current;
    setState((prev) => {
      if (!prev) return prev;
      const otherId = prev.p1.userId === me ? prev.p2.userId : prev.p1.userId;
      const ns: ChallengeSealsState = { ...prev, phase: "forfeit", winnerId: otherId, forfeitBy: me, winReason: "forfeit" };
      broadcast(ns);
      return ns;
    });
  }, [broadcast]);

  const timerPct = state?.phase === "question" && isMyTurn
    ? Math.max(0, (timeLeft / QUESTION_TIME_MS) * 100) : 100;
  const timerColor = timerPct > 50 ? "#10B981" : timerPct > 25 ? "#F59E0B" : "#EF4444";

  return {
    state, myState, oppState, isMyTurn, isFinished,
    phase: state?.phase ?? "dice_roll",
    timeLeft, timerPct, timerColor,
    currentCategory: state?.currentCategory,
    lastAnswerCorrect: state?.lastAnswerCorrect,
    diceRolled: state?.diceRolled ?? false,
    myDice: myState?.diceValue,
    oppDice: oppState?.diceValue,
    diceWinnerId: state?.diceWinnerId,
    rollDice, startTurn, onRouletteComplete, submitAnswer, continueAfterCorrect, forfeit,
  };
}

function updateP(s: ChallengeSealsState, uid: number, fn: (p: ChallengePlayerState) => ChallengePlayerState): ChallengeSealsState {
  if (s.p1.userId === uid) return { ...s, p1: fn({ ...s.p1 }) };
  return { ...s, p2: fn({ ...s.p2 }) };
}

function otherId(s: ChallengeSealsState, uid: number): number {
  return s.p1.userId === uid ? s.p2.userId : s.p1.userId;
}

function processCorrect(s: ChallengeSealsState, uid: number, timeMs: number): ChallengeSealsState {
  const cat = s.currentCategory;
  if (!cat) return s;
  let ns = updateP(s, uid, (p) => {
    const newSeals = { ...p.seals, [cat]: (p.seals[cat] || 0) + 1 };
    return { ...p, seals: newSeals, brokenCount: Object.values(newSeals).filter(v => v >= SEALS_TO_BREAK).length, correctCount: p.correctCount + 1, totalTimeMs: p.totalTimeMs + timeMs };
  });
  const player = ns.p1.userId === uid ? ns.p1 : ns.p2;
  if (player.brokenCount >= CATEGORIES.length) {
    return { ...ns, phase: "finished", winnerId: uid, winReason: "all_seals", lastAnswerCorrect: true };
  }
  return { ...ns, phase: "result", lastAnswerCorrect: true };
}

function processWrong(s: ChallengeSealsState, uid: number): ChallengeSealsState {
  let ns = updateP(s, uid, (p) => ({ ...p, wrongCount: p.wrongCount + 1, totalTimeMs: p.totalTimeMs + QUESTION_TIME_MS }));
  ns = { ...ns, currentTurnId: otherId(ns, uid), phase: "waiting", lastAnswerCorrect: false };
  return ns;
}
