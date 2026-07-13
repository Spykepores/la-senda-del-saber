import { useState, useCallback, useRef, useEffect } from 'react';
import { questions as allQuestions } from '@/data/questions';
import type { Question, Player, GameScreen, GameMode, Category, LeaderboardEntry } from '@/types/game';
import { CATEGORIES, RANKS } from '@/types/game';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useGameState() {
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [mode, setMode] = useState<GameMode>('solo');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [availableOptions, setAvailableOptions] = useState<number[]>([0, 1, 2, 3]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rouletteCategory, setRouletteCategory] = useState<Category | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gameTimer, setGameTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('senda_leaderboard') || '[]'); }
    catch { return []; }
  });
  const [rankUpNotif, setRankUpNotif] = useState<{ oldRank: typeof RANKS[0], newRank: typeof RANKS[0] } | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [rushScore, setRushScore] = useState(0);
  const [rushTimeLeft, setRushTimeLeft] = useState(60);
  const [rushTimer, setRushTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPlayer = players[currentPlayerIndex] || null;

  // Game timer
  const startGameTimer = useCallback(() => {
    setElapsedTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopGameTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Player setup
  const setupPlayers = useCallback((names: string[]) => {
    const newPlayers: Player[] = names.map((name, i) => ({
      id: i,
      name,
      score: 0,
      correct: 0,
      wrong: 0,
      broken: 0,
      seals: {},
      color: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 6],
      rank: RANKS[0],
      galleryUnlocked: [],
    }));
    setPlayers(newPlayers);
    setCurrentPlayerIndex(0);
  }, []);

  // Roulette
  const spinRoulette = useCallback(() => {
    setIsSpinning(true);
    setScreen('roulette');

    // Spin animation
    let spins = 0;
    const maxSpins = 20;
    const interval = setInterval(() => {
      const randomCat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      setRouletteCategory(randomCat);
      spins++;
      if (spins >= maxSpins) {
        clearInterval(interval);
        const finalCat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        setRouletteCategory(finalCat);
        setTimeout(() => {
          setIsSpinning(false);
          // Get question for category
          const catQuestions = allQuestions.filter(q => q.category === finalCat.id && q.difficulty === difficulty);
          if (catQuestions.length > 0) {
            const q = catQuestions[Math.floor(Math.random() * catQuestions.length)];
            setCurrentQuestion(q);
            setAvailableOptions([0, 1, 2, 3]);
            setShowExplanation(false);
            setAnsweredCorrectly(null);
            setSelectedAnswer(null);
            setScreen('question');
          }
        }, 500);
      }
    }, 100);
  }, [difficulty]);

  // Answer
  const answerQuestion = useCallback((index: number) => {
    if (!currentQuestion || !currentPlayer) return;

    setSelectedAnswer(index);
    const correct = index === currentQuestion.correctAnswer;
    setAnsweredCorrectly(correct);
    setShowExplanation(true);

    setPlayers(prev => prev.map(p => {
      if (p.id !== currentPlayer.id) return p;
      const newCorrect = p.correct + (correct ? 1 : 0);
      const newWrong = p.wrong + (correct ? 0 : 1);
      const newScore = p.score + (correct ? 100 : 0);

      // Update seals
      const newSeals = { ...p.seals };
      if (correct) {
        const cat = currentQuestion.category;
        newSeals[cat] = (newSeals[cat] || 0) + 1;
      }

      // Check broken seals
      const broken = Object.values(newSeals).filter(v => v >= 2).length;

      // Check rank up
      const totalCorrect = newCorrect;
      const newRankIndex = RANKS.findIndex((r, i) => {
        if (i === 0) return false;
        const prevReq = RANKS[i - 1].requiredCorrect;
        return totalCorrect >= r.requiredCorrect && p.correct < r.requiredCorrect;
      });

      if (newRankIndex > 0) {
        setRankUpNotif({ oldRank: p.rank, newRank: RANKS[newRankIndex] });
      }

      return {
        ...p,
        correct: newCorrect,
        wrong: newWrong,
        score: newScore,
        seals: newSeals,
        broken,
        rank: newRankIndex > 0 ? RANKS[newRankIndex] : p.rank,
      };
    }));

    // Check win condition (all 7 seals broken)
    if (correct) {
      const updated = players.map(p => {
        if (p.id !== currentPlayer.id) return p;
        const newSeals = { ...p.seals };
        newSeals[currentQuestion.category] = (newSeals[currentQuestion.category] || 0) + 1;
        return { ...p, seals: newSeals };
      });
      const currentP = updated.find(p => p.id === currentPlayer.id);
      if (currentP && Object.values(currentP.seals).filter(v => v >= 2).length >= 7) {
        setWinner(currentP);
        setScreen('victory');
        stopGameTimer();
        // Save to leaderboard
        const entry: LeaderboardEntry = {
          name: currentP.name,
          score: currentP.score,
          correct: currentP.correct,
          wrong: currentP.wrong,
          broken: currentP.broken,
          time: elapsedTime,
          date: new Date().toISOString(),
        };
        setLeaderboard(prev => {
          const updated = [...prev, entry].sort((a, b) => b.score - a.score).slice(0, 50);
          localStorage.setItem('senda_leaderboard', JSON.stringify(updated));
          return updated;
        });
        return;
      }
    }
  }, [currentQuestion, currentPlayer, players, elapsedTime, stopGameTimer]);

  // Continue
  const continueAfterAnswer = useCallback(() => {
    setScreen('sealHub');
    setCurrentPlayerIndex(prev => (prev + 1) % players.length);
  }, [players.length]);

  // Rush mode
  const startRushMode = useCallback(() => {
    setRushScore(0);
    setRushTimeLeft(60);
    setScreen('rushMode');

    // Start timer
    const timer = setInterval(() => {
      setRushTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setScreen('victory');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setRushTimer(timer);

    // Load first question
    const q = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    setCurrentQuestion(q);
  }, []);

  // Reset
  const resetGame = useCallback(() => {
    setScreen('menu');
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setCurrentQuestion(null);
    setShowExplanation(false);
    setAnsweredCorrectly(null);
    setSelectedAnswer(null);
    setIsSpinning(false);
    setRouletteCategory(null);
    setElapsedTime(0);
    setWinner(null);
    setRushScore(0);
    setRushTimeLeft(60);
    stopGameTimer();
    if (rushTimer) clearInterval(rushTimer);
  }, [stopGameTimer, rushTimer]);

  // Navigation
  const goToScreen = useCallback((s: GameScreen) => setScreen(s), []);

  // Toggle sound
  const toggleSound = useCallback(() => setSoundEnabled(prev => !prev), []);

  // Set difficulty
  const setDiff = useCallback((d: 'easy' | 'medium' | 'hard') => setDifficulty(d), []);

  return {
    screen, mode, players, currentPlayer, currentPlayerIndex,
    currentQuestion, showExplanation, answeredCorrectly, selectedAnswer, availableOptions,
    isSpinning, rouletteCategory,
    soundEnabled, difficulty, elapsedTime, leaderboard, rankUpNotif, winner,
    rushScore, rushTimeLeft,
    setMode, setupPlayers, spinRoulette, answerQuestion, continueAfterAnswer,
    startGameTimer, stopGameTimer, goToScreen, toggleSound, setDifficulty: setDiff,
    setLeaderboard, setRankUpNotif, resetGame, startRushMode,
  };
}
