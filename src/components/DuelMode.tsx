import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Question } from '@/types/game';

interface DuelModeProps {
  question: Question;
  players: { name: string; color: string; score: number }[];
  onAnswer: (index: number) => void;
  onContinue: () => void;
}

export function DuelMode({ question, players, onAnswer }: DuelModeProps) {
  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Players */}
        <div className="flex justify-between mb-6">
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-white font-medium text-sm">{p.name}</span>
              <span className="text-amber-400 font-bold text-sm">{p.score} pts</span>
            </div>
          ))}
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-amber-400" />
          <span className="text-amber-400 font-bold">15s</span>
        </div>

        {/* Question */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-white text-center mb-8"
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
              transition={{ delay: index * 0.1 }}
              onClick={() => onAnswer(index)}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all text-left"
            >
              <span className="font-medium">{option}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
