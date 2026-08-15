import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/providers/trpc";

/* ============================================================
   tRPC Query-based Challenge Seals Game Hook
   - Server state as single source of truth
   - All mutations update server; local state via trpc.useUtils
   ============================================================ */

export type GameStatus = "idle" | "rolling" | "roulette" | "question" | "result" | "game_over";

export interface SealsGameState {
  status: GameStatus;
  currentPlayer: number;
  challengerSeals: number[]; // broken seals
  opponentSeals: number[];
  challengerScore: number;
  opponentScore: number;
  challengerStreak: number;
  opponentStreak: number;
  category: string | null;
  diceValue: number | null;
  question: {
    id: number;
    category: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
    difficulty: string;
  } | null;
  selectedOption: number | null;
  correct: boolean | null;
  message: string;
  round: number;
  challengerName?: string;
  opponentName?: string;
  timer: number;
}

const INITIAL_STATE: SealsGameState = {
  status: "idle",
  currentPlayer: 1,
  challengerSeals: [],
  opponentSeals: [],
  challengerScore: 0,
  opponentScore: 0,
  challengerStreak: 0,
  opponentStreak: 0,
  category: null,
  diceValue: null,
  question: null,
  selectedOption: null,
  correct: null,
  message: "",
  round: 1,
  timer: 30,
};

const CATEGORIES = [
  { id: "genealogy", name: "Genealogia", color: "#F59E0B", icon: "🌟" },
  { id: "parables", name: "Parabolas", color: "#10B981", icon: "🌱" },
  { id: "stories", name: "Historias", color: "#3B82F6", icon: "📚" },
  { id: "prophecy", name: "Profecias", color: "#8B5CF6", icon: "✨" },
  { id: "doctrine", name: "Doctrina", color: "#EC4899", icon: "📖" },
  { id: "characters", name: "Personajes", color: "#EF4444", icon: "👤" },
  { id: "books", name: "Libros", color: "#14B8A6", icon: "📕" },
];

/* ============================================================
   useChallengeSealsGame — uses tRPC for all state
   ============================================================ */
export function useChallengeSealsGame(challengeId?: number | null) {
  const [state, setState] = useState<SealsGameState>(INITIAL_STATE);
  const [wsState, setWsState] = useState<any>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerActiveRef = useRef(false);
  const localUser = JSON.parse(localStorage.getItem("senda_local_user") || "null");
  const myId = Number(localStorage.getItem("senda_user_id") || localUser?.id || 0);

  /* ---- Load challenge from tRPC ---- */
  const utils = trpc.useUtils();
  const { data: challenge } = trpc.duel.get.useQuery(
    { id: challengeId || 0 },
    { enabled: !!challengeId, refetchInterval: 2000 }
  );

  /* ---- Load question via tRPC ---- */
  const { data: fetchedQuestion } = trpc.duel.getCurrentQuestion.useQuery(
    { category: state.category || CATEGORIES[0].id, excludeIds: [] },
    { enabled: state.status === "question" && !!state.category }
  );

  /* ---- Mutations ---- */
  const actionMut = trpc.duel.action.useMutation({
    onSuccess: () => {
      if (challengeId) utils.duel.get.invalidate({ id: challengeId });
    },
  });

  const submitAnswerMut = trpc.duel.submitAnswer.useMutation({
    onSuccess: () => {
      if (challengeId) utils.duel.get.invalidate({ id: challengeId });
    },
  });

  /* ---- Merge server state ---- */
  useEffect(() => {
    if (!challenge?.gameState) return;
    const gs = challenge.gameState as any;
    setState(prev => ({
      ...prev,
      challengerSeals: gs.challengerSeals || [],
      opponentSeals: gs.opponentSeals || [],
      challengerScore: gs.challengerScore || 0,
      opponentScore: gs.opponentScore || 0,
      currentPlayer: gs.currentPlayer || 1,
      challengerName: challenge.challengerName || undefined,
      opponentName: challenge.opponentName || undefined,
    }));
  }, [challenge]);

  /* ---- Set question from tRPC ---- */
  useEffect(() => {
    if (state.status === "question" && fetchedQuestion) {
      const q = fetchedQuestion as any;
      const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]");
      setState(prev => ({
        ...prev,
        question: {
          id: q.id,
          category: q.category,
          question: q.question,
          options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || "",
          difficulty: q.difficulty || "medium",
        },
      }));
    }
  }, [fetchedQuestion, state.status]);

  /* ---- WebSocket (optional) ---- */
  useEffect(() => {
    if (!challengeId) return;

    const wsUrl = (() => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      if (window.location.hostname === "localhost") return `${protocol}//localhost:3001`;
      return `${protocol}//${window.location.host}`;
    })();

    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          setWsError(null);
          ws!.send(JSON.stringify({ type: "join-room", roomId: `duel_${challengeId}`, senderId: myId }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "game_state") setWsState(data.state);
            if (data.type === "game_error") setWsError(data.gameError);
            if (data.type === "chat-message") { /* handled by useChat */ }
            if (data.type === "ping") ws?.send(JSON.stringify({ type: "pong" }));
          } catch { /* */ }
        };

        ws.onclose = () => { setWsConnected(false); wsRef.current = null; };
        ws.onerror = () => { ws?.close(); };
      } catch { setWsConnected(false); }
    };

    connect();
    return () => { closed = true; ws?.close(); };
  }, [challengeId, myId]);

  /* ---- Timer ---- */
  useEffect(() => {
    if (state.status === "question" && state.timer > 0) {
      timerActiveRef.current = true;
      timerRef.current = setInterval(() => {
        setState(prev => {
          if (!timerActiveRef.current) return prev;
          if (prev.timer <= 1) {
            timerActiveRef.current = false;
            return { ...prev, timer: 0 };
          }
          return { ...prev, timer: prev.timer - 1 };
        });
      }, 1000);
    } else {
      timerActiveRef.current = false;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [state.status]);

  /* ---- Roll dice ---- */
  const rollDice = useCallback(() => {
    if (state.status !== "idle" && state.status !== "result") return;
    const value = Math.floor(Math.random() * 6) + 1;
    setState(prev => ({ ...prev, status: "rolling", diceValue: value, message: `Has sacado un ${value}!` }));

    setTimeout(() => {
      setState(prev => {
        const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        return {
          ...prev,
          status: "roulette",
          category: cat.id,
          message: `Categoria: ${cat.name}`,
          diceValue: value,
        };
      });

      setTimeout(() => {
        setState(prev => ({
          ...prev,
          status: "question",
          selectedOption: null,
          correct: null,
          timer: 30,
        }));

        if (challengeId) {
          actionMut.mutate({
            challengeId,
            action: { kind: "roulette_result", playerId: myId, diceValue: value, category: state.category || "genealogy" },
          });
        }
      }, 1500);
    }, 1000);

    if (challengeId) {
      actionMut.mutate({
        challengeId,
        action: { kind: "roll_dice", playerId: myId, diceValue: value },
      });
    }
  }, [state.status, challengeId, myId, state.category, actionMut]);

  /* ---- Submit answer ---- */
  const submitAnswer = useCallback((selectedOption: number, _timeMs?: number) => {
    if (state.status !== "question" || state.correct !== null) return;
    timerActiveRef.current = false;

    if (state.question) {
      const correct = state.question.correctAnswer === selectedOption;

      if (challengeId) {
        submitAnswerMut.mutate({
          challengeId,
          questionId: state.question.id,
          selectedOption,
        });
      }

      setState(prev => ({
        ...prev,
        selectedOption,
        correct,
        status: "result",
        message: correct ? "Correcto! Has ganado un sello!" : "Incorrecto! Pierdes tu turno.",
      }));

      if (challengeId) {
        actionMut.mutate({
          challengeId,
          action: {
            kind: "submit_answer",
            playerId: myId,
            questionId: state.question.id,
            selectedOption,
            correct,
          },
        });
      }
    }
  }, [state.status, state.question, challengeId, myId, actionMut, submitAnswerMut]);

  /* ---- Next turn ---- */
  const nextTurn = useCallback(() => {
    setState(prev => ({
      ...INITIAL_STATE,
      currentPlayer: prev.currentPlayer === 1 ? 2 : 1,
      challengerSeals: prev.challengerSeals,
      opponentSeals: prev.opponentSeals,
      challengerScore: prev.challengerScore,
      opponentScore: prev.opponentScore,
      challengerStreak: prev.challengerStreak,
      opponentStreak: prev.opponentStreak,
      round: prev.round + (prev.currentPlayer === 2 ? 1 : 0),
      challengerName: prev.challengerName,
      opponentName: prev.opponentName,
    }));
  }, []);

  const resetGame = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    wsConnected,
    wsError,
    wsState,
    myId,
    isMyTurn: state.currentPlayer === 1, // simplified
    CATEGORIES,
    rollDice,
    submitAnswer,
    nextTurn,
    resetGame,
  };
}
