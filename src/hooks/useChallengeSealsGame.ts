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
// HOOK: Juego de Sellos - SOLO confia en servidor (game_state)
// ============================================================
export function useChallengeSealsGame(cid: number, uid: number) {
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

  // tRPC: get current question (only when server says it's question phase and our turn)
  const { data: serverQuestion } = trpc.duel.getCurrentQuestion.useQuery(
    { challengeId: cid },
    { enabled: cid > 0 && state?.phase === "question" && state?.currentTurnId === uid }
  );

  // Convert server question to local Question type
  useEffect(() => {
    if (serverQuestion && state?.phase === "question") {
      setQuestion({
        id: serverQuestion.id,
        category: serverQuestion.category as any,
        difficulty: serverQuestion.difficulty as any,
        question: serverQuestion.question,
        options: serverQuestion.options,
        correctAnswer: serverQuestion.correctAnswer,
        explanation: serverQuestion.explanation || "",
      });
    }
  }, [serverQuestion, state?.phase, state?.currentTurnId]);

  // ---- Build local state from server DTO (dbChallenge or WS game_state) ----
  const applyServerState = useCallback((dto: any) => {
    if (!dto) return;
    const empty: SealProgress = {};
    CATEGORIES.forEach(c => (empty[c.id] = 0));

    const cSeals = dto.challengerSeals || { ...empty };
    const oSeals = dto.opponentSeals || { ...empty };

    const p1: ChallengePlayerState = {
      userId: dto.challengerId || 0,
      name: dto.challengerName || `Jugador #${dto.challengerId || 0}`,
      seals: cSeals,
      brokenCount: Object.values(cSeals).filter((v: any) => v >= SEALS_TO_BREAK).length,
      correctCount: dto.challengerScore || 0,
      wrongCount: 0,
      totalTimeMs: 0,
      diceValue: dto.challengerDice || undefined,
    };
    const p2: ChallengePlayerState = {
      userId: dto.opponentId || 0,
      name: dto.opponentName || (dto.opponentId ? `Jugador #${dto.opponentId}` : "Esperando..."),
      seals: oSeals,
      brokenCount: Object.values(oSeals).filter((v: any) => v >= SEALS_TO_BREAK).length,
      correctCount: dto.opponentScore || 0,
      wrongCount: 0,
      totalTimeMs: 0,
      diceValue: dto.opponentDice || undefined,
    };

    const phase: GamePhase = dto.phase || "dice_roll";

    setState({
      challengeId: cidRef.current,
      p1, p2,
      currentTurnId: dto.currentTurnUserId || 0,
      phase,
      winnerId: dto.winnerId,
      currentCategory: dto.currentCategory || undefined,
      questionStartTime: Date.now(),
      diceRolled: dto.challengerDice !== null && dto.opponentDice !== null && dto.challengerDice !== undefined && dto.opponentDice !== undefined,
      diceWinnerId: phase === "waiting" ? dto.currentTurnUserId || undefined : undefined,
      lastAnswerCorrect: phase === "result" ? true : undefined,
      forfeitBy: phase === "forfeit" ? dto.winnerId : undefined,
      winReason: phase === "forfeit" ? "forfeit" : undefined,
    });
  }, []);

  // Inicializar desde DB al cargar
  useEffect(() => {
    if (!dbChallenge || state) return;
    applyServerState(dbChallenge);
  }, [dbChallenge, state, applyServerState]);

  // ---- WEBSOCKET: solo escuchar game_state del servidor ----
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
          ws!.send(JSON.stringify({
            type: "join-room",
            roomId: `duel_${cidRef.current}`,
            senderId: uid,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "game_state": {
                if (data.state) applyServerState(data.state);
                break;
              }
              case "game_error": {
                console.warn("[Game WS Error]", data.gameError || data.message);
                break;
              }
              case "timer": {
                if (data.timer) {
                  setTimeLeft(data.timer.remaining * 1000);
                  timeRef.current = data.timer.remaining * 1000;
                }
                break;
              }
              case "chat-message": {
                // Handled by useWebSocketChat if needed
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
  }, [cid, uid, applyServerState]);

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

  // ---- DICE ROLL: solo envia al servidor, espera game_state ----
  const rollDice = useCallback(() => {
    const diceValue = Math.floor(Math.random() * 6) + 1;
    sendAction({ kind: "roll_dice", diceValue });
    return diceValue;
  }, [sendAction]);

  // ---- START TURN: pide ruleta al servidor (el server decide categoria) ----
  const startTurn = useCallback(() => {
    sendAction({ kind: "start_turn" });
  }, [sendAction]);

  // ---- RULETA VISUAL: animacion pura, NO envia nada al servidor ----
  // El servidor ya decidio la categoria cuando respondio con game_state (phase="question")
  const onRouletteComplete = useCallback((_category: string) => {
    // NOOP - solo visual. El servidor ya seteo currentCategory y phase="question"
  }, []);

  // ---- SUBMIT ANSWER: envia questionId + selectedOption, servidor valida ----
  const submitAnswer = useCallback((selectedOption: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    sendAction({ kind: "submit_answer", questionId: question?.id || 0, selectedOption });
  }, [sendAction, question]);

  // ---- CONTINUE AFTER CORRECT: solo visual, espera game_state ----
  const continueAfterCorrect = useCallback(() => {
    // NO envia nada - cuando el server ve phase="result" y el jugador hace start_turn,
    // el server pasara a "question" con nueva categoria
    startTurn();
  }, [startTurn]);

  // ---- FORFEIT ----
  const forfeit = useCallback(() => {
    sendAction({ kind: "forfeit" });
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
