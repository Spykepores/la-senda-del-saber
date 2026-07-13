import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Timer, Zap } from 'lucide-react';
import type { Question } from '@/types/game';

interface RushModeProps {
  question: Question | null;
  score: number;
  timeLeft: number;
  questionsAnswered: number;
  onAnswer: (index: number) => void;
  onEnd: () => void;
}

export function RushMode({ question, score, timeLeft, onAnswer, onEnd }: RushModeProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeLeft <= 0) {
      onEnd();
    }
  }, [timeLeft, onEnd]);

  const handleAnswer = (index: number) => {
    if (!question || showResult) return;

    setSelectedAnswer(index);
    const correct = index === question.correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);

    onAnswer(index);

    // Next question after delay
    timerRef.current = setTimeout(() => {
      setSelectedAnswer(null);
      setShowResult(false);
    }, 1500);
  };

  if (!question) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Zap className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
          <p>Cargando pregunta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-bold">{score} pts</span>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-red-400" />
            <span className={`font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-amber-500 rounded-full"
            style={{ width: `${(timeLeft / 60) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Question */}
        <motion.h2
          key={question.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-white mb-8"
        >
          {question.text}
        </motion.h2>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleAnswer(index)}
              disabled={showResult}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                showResult
                  ? index === question.correctAnswer
                    ? 'bg-green-500/20 border-green-400/50'
                    : index === selectedAnswer
                    ? 'bg-red-500/20 border-red-400/50'
                    : 'bg-white/5 border-white/10 opacity-50'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <span className="text-white font-medium">{option}</span>
            </motion.button>
          ))}
        </div>

        {/* Result indicator */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center"
          >
            {isCorrect ? (
              <span className="text-green-400 font-bold text-lg">Correcto! +100 pts</span>
            ) : (
              <span className="text-red-400 font-bold text-lg">Incorrecto</span>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
