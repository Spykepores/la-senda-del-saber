import { useState, useEffect, useRef, useCallback } from "react";
import { CATEGORIES } from "@/types/game";
import { trpc } from "@/providers/trpc";
import type { Question } from "@/types/game";

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

// WS URL helper
function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const isDev = window.location.hostname === "localhost";
  if (isDev) return `${protocol}//localhost:3001`;
  return `${protocol}//${window.location.host}`;
}

// ============================================================
// HOOK PRINCIPAL - Juego de Sellos con WebSocket
// ============================================================
export function useChallengeSealsGame(cid: number, uid: number, _cInfo?: { cId: number; cName: string; oId: number; oName: string; isJoining?: boolean }) {
  const [state, setState] = useState<ChallengeSealsState | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const [question, setQuestion] = useState<Question | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uidRef = useRef(uid);
  const cidRef = useRef(cid);
  const timeRef = useRef(QUESTION_TIME_MS);

  uidRef.current = uid;
  cidRef.current = cid;

  // tRPC: get challenge state from DB for initial load
  const { data: dbChallenge } = trpc.duel.get.useQuery(
    { challengeId: cid },
    { enabled: cid > 0 }
  );

  // tRPC: get current question
  const { data: serverQuestion } = trpc.duel.getCurrentQuestion.useQuery(
    { challengeId: cid },
    { enabled: cid > 0 && state?.phase === "question" && state?.currentTurnId === uid }
  );

  useEffect(() => {
    if (serverQuestion && state?.phase === "question") {
      const q: Question = {
        id: serverQuestion.id,
        category: serverQuestion.category as any,
        difficulty: serverQuestion.difficulty as any,
        question: serverQuestion.question,
        options: serverQuestion.options,
        correctAnswer: serverQuestion.correctAnswer,
        explanation: serverQuestion.explanation || "",
      };
      setQuestion(q);
    }
  }, [serverQuestion, state?.phase, state?.currentTurnId]);

  // Inicializar estado desde DB
  useEffect(() => {
    if (!dbChallenge || state) return;

    const empty: SealProgress = {};
    CATEGORIES.forEach(c => (empty[c.id] = 0));

    const cSealsRaw = dbChallenge.challengerSeals;
    const oSealsRaw = dbChallenge.opponentSeals;
    const challengerSeals = cSealsRaw ? JSON.parse(cSealsRaw) : { ...empty };
    const opponentSeals = oSealsRaw ? JSON.parse(oSealsRaw) : { ...empty };

    const p1: ChallengePlayerState = {
      userId: dbChallenge.challengerId,
      name: (dbChallenge as any).challengerName || `Jugador #${dbChallenge.challengerId}`,
      seals: challengerSeals,
      brokenCount: Object.values(challengerSeals).filter((v: any) => v >= SEALS_TO_BREAK).length,
      correctCount: dbChallenge.challengerScore || 0,
      wrongCount: 0,
      totalTimeMs: 0,
    };
    const p2: ChallengePlayerState = {
      userId: dbChallenge.opponentId || 0,
      name: (dbChallenge as any).opponentName || (dbChallenge.opponentId ? `Jugador #${dbChallenge.opponentId}` : "Esperando..."),
      seals: opponentSeals,
      brokenCount: Object.values(opponentSeals).filter((v: any) => v >= SEALS_TO_BREAK).length,
      correctCount: dbChallenge.opponentScore || 0,
      wrongCount: 0,
      totalTimeMs: 0,
    };

    // Determinar fase
    let phase: GamePhase = "dice_roll";
    if (dbChallenge.status === "completed" || dbChallenge.status === "cancelled") phase = "finished";
    else if (dbChallenge.winnerId) phase = "finished";
    else if (!dbChallenge.opponentId || dbChallenge.opponentId === 0) phase = "dice_roll";
    else if (dbChallenge.currentTurnUserId) phase = "waiting";

    setState({
      challengeId: cid,
      p1, p2,
      currentTurnId: dbChallenge.currentTurnUserId || 0,
      phase,
      winnerId: dbChallenge.winnerId,
      currentCategory: dbChallenge.currentCategory || undefined,
      questionStartTime: Date.now(),
      diceRolled: false,
    });
  }, [dbChallenge, cid]);

  // ---- WEBSOCKET ----
  useEffect(() => {
    if (cid <= 0 || uid <= 0) return;
    const wsUrl = getWsUrl();
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          // Join duel room
          ws!.send(JSON.stringify({
            type: "join-room",
            roomId: `duel_${cid}`,
            senderId: uid,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "game_state": {
                if (data.state) {
                  // Merge server state into local state
                  const s = data.state as any;
                  setState(prev => {
                    if (!prev) return prev;
                    const newState = { ...prev };
                    if (s.challengerSeals) {
                      newState.p1 = { ...newState.p1, seals: s.challengerSeals, brokenCount: Object.values(s.challengerSeals).filter((v: any) => v >= SEALS_TO_BREAK).length };
                    }
                    if (s.opponentSeals) {
                      newState.p2 = { ...newState.p2, seals: s.opponentSeals, brokenCount: Object.values(s.opponentSeals).filter((v: any) => v >= SEALS_TO_BREAK).length };
                    }
                    if (s.challengerScore !== undefined) newState.p1 = { ...newState.p1, correctCount: s.challengerScore };
                    if (s.opponentScore !== undefined) newState.p2 = { ...newState.p2, correctCount: s.opponentScore };
                    if (s.currentTurnUserId !== undefined) newState.currentTurnId = s.currentTurnUserId;
                    if (s.currentCategory !== undefined) newState.currentCategory = s.currentCategory || undefined;
                    if (s.status === "completed") newState.phase = "finished";
                    if (s.winnerId) { newState.winnerId = s.winnerId; newState.phase = "finished"; }
                    if (s.challengerStreak !== undefined) newState.p1 = { ...newState.p1, correctCount: s.challengerStreak };
                    if (s.opponentStreak !== undefined) newState.p2 = { ...newState.p2, correctCount: s.opponentStreak };
                    return newState;
                  });
                }
                break;
              }
              case "game_error": {
                console.warn("[Game WS Error]", data.message);
                break;
              }
              case "timer": {
                if (data.timer) {
                  setTimeLeft(data.timer.remaining * 1000);
                  timeRef.current = data.timer.remaining * 1000;
                }
                break;
              }
              case "ping": {
                ws?.send(JSON.stringify({ type: "pong" }));
                break;
              }
            }
          } catch { /* */ }
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (!closed && !reconnectTimer.current) {
            reconnectTimer.current = setTimeout(() => { reconnectTimer.current = null; connect(); }, 3000);
          }
        };
        ws.onerror = () => ws?.close();
      } catch { setConnected(false); }
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      ws?.close();
    };
  }, [cid, uid]);

  // ---- Helpers ----
  const myState = state ? (state.p1.userId === uid ? state.p1 : state.p2) : null;
  const oppState = state ? (state.p1.userId === uid ? state.p2 : state.p1) : null;
  const isMyTurn = state?.currentTurnId === uid && state?.phase !== "dice_roll";
  const isFinished = state?.phase === "finished" || state?.phase === "forfeit" || !!state?.winnerId;

  // ---- Timer local ----
  const canAnswer = (state?.phase === "question") && isMyTurn;
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
      }
    }, 150);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [canAnswer, isFinished]);

  // ---- Send game action via WS ----
  const sendAction = useCallback((action: { kind: string; [key: string]: any }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "game_action",
        roomId: `duel_${cidRef.current}`,
        action: { ...action, playerId: uidRef.current },
      }));
    }
  }, []);

  // ---- DICE ROLL ----
  const rollDice = useCallback(() => {
    const diceValue = Math.floor(Math.random() * 6) + 1;
    sendAction({ kind: "roll_dice", diceValue });

    setState(prev => {
      if (!prev || prev.phase !== "dice_roll") return prev;
      const isP1 = prev.p1.userId === uidRef.current;
      const ns: ChallengeSealsState = {
        ...prev,
        [isP1 ? "p1" : "p2"]: { ...(isP1 ? prev.p1 : prev.p2), diceValue },
      };
      // Check both rolled
      if (ns.p1.diceValue && ns.p2.diceValue) {
        ns.diceRolled = true;
        if (ns.p1.diceValue > ns.p2.diceValue) {
          ns.currentTurnId = ns.p1.userId; ns.diceWinnerId = ns.p1.userId;
        } else if (ns.p2.diceValue > ns.p1.diceValue) {
          ns.currentTurnId = ns.p2.userId; ns.diceWinnerId = ns.p2.userId;
        } else {
          ns.p1 = { ...ns.p1, diceValue: undefined };
          ns.p2 = { ...ns.p2, diceValue: undefined };
          ns.diceRolled = false;
        }
        if (ns.diceRolled) ns.phase = "waiting";
      }
      return ns;
    });

    return diceValue;
  }, [sendAction]);

  // ---- START TURN (girar ruleta) ----
  const startTurn = useCallback(() => {
    sendAction({ kind: "start_turn" });
  }, [sendAction]);

  // ---- RULETA COMPLETADA ----
  const onRouletteComplete = useCallback((category: string) => {
    sendAction({ kind: "roulette_result", category });
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, phase: "question", currentCategory: category, questionStartTime: Date.now() };
    });
  }, [sendAction]);

  // ---- SUBMIT ANSWER ----
  const submitAnswer = useCallback((selectedOption: number, _timeMs?: number) => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Determine locally if correct (for immediate UI feedback)
    const correct = question ? question.correctAnswer === selectedOption : false;

    // Send to server: questionId + selectedOption (server validates)
    sendAction({ kind: "submit_answer", questionId: question?.id || 0, selectedOption, correct });

    setState(prev => {
      if (!prev) return prev;
      const me = uidRef.current;
      if (correct) {
        const cat = prev.currentCategory;
        if (!cat) return prev;
        const isP1 = prev.p1.userId === me;
        const ns = { ...prev };
        const player = isP1 ? { ...ns.p1 } : { ...ns.p2 };
        player.seals = { ...player.seals, [cat]: (player.seals[cat] || 0) + 1 };
        player.brokenCount = Object.values(player.seals).filter(v => v >= SEALS_TO_BREAK).length;
        player.correctCount++;
        if (isP1) ns.p1 = player; else ns.p2 = player;
        if (player.brokenCount >= CATEGORIES.length) {
          ns.phase = "finished"; ns.winnerId = me; ns.winReason = "all_seals"; ns.lastAnswerCorrect = true;
        } else {
          ns.phase = "result"; ns.lastAnswerCorrect = true;
        }
        return ns;
      } else {
        const isP1 = prev.p1.userId === me;
        const ns = { ...prev };
        const player = isP1 ? { ...ns.p1 } : { ...ns.p2 };
        player.wrongCount++;
        if (isP1) ns.p1 = player; else ns.p2 = player;
        ns.currentTurnId = prev.p1.userId === me ? prev.p2.userId : prev.p1.userId;
        ns.phase = "waiting";
        ns.lastAnswerCorrect = false;
        return ns;
      }
    });
  }, [sendAction, question]);

  // ---- CONTINUE AFTER CORRECT ----
  const continueAfterCorrect = useCallback(() => {
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, phase: "roulette", questionStartTime: Date.now() };
    });
  }, []);

  // ---- FORFEIT ----
  const forfeit = useCallback(() => {
    sendAction({ kind: "forfeit" });
    setState(prev => {
      if (!prev) return prev;
      const me = uidRef.current;
      const otherId = prev.p1.userId === me ? prev.p2.userId : prev.p1.userId;
      return { ...prev, phase: "forfeit", winnerId: otherId, forfeitBy: me, winReason: "forfeit" };
    });
  }, [sendAction]);

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
    question,
    connected,
  };
}
