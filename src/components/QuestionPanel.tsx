import { motion } from 'framer-motion';
import { HelpCircle, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Question } from '@/types/game';

interface QuestionPanelProps {
  question: Question;
  currentPlayer: { name: string; color: string };
  showExplanation: boolean;
  answeredCorrectly: boolean | null;
  selectedAnswer: number | null;
  availableOptions: number[];
  onAnswer: (index: number) => void;
  onContinue: () => void;
}

export function QuestionPanel({
  question,
  currentPlayer,
  showExplanation,
  answeredCorrectly,
  selectedAnswer,
  availableOptions,
  onAnswer,
  onContinue,
}: QuestionPanelProps) {
  const getOptionStyle = (index: number) => {
    if (!showExplanation) {
      return 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20';
    }
    if (index === question.correctAnswer) {
      return 'bg-green-500/20 border-green-400/50';
    }
    if (index === selectedAnswer && !answeredCorrectly) {
      return 'bg-red-500/20 border-red-400/50';
    }
    return 'bg-white/5 border-white/10 opacity-50';
  };

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Player info */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentPlayer.color }} />
          <span className="text-white/70 text-sm">{currentPlayer.name}</span>
        </div>

        {/* Category */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-4"
        >
          <HelpCircle className="w-5 h-5 text-white/50" />
          <span className="text-white/50 text-sm capitalize">{question.category}</span>
        </motion.div>

        {/* Question */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-white mb-8"
        >
          {question.text}
        </motion.h2>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              onClick={() => !showExplanation && onAnswer(index)}
              disabled={showExplanation}
              className={`w-full p-4 rounded-xl border text-left transition-all ${getOptionStyle(index)}`}
            >
              <span className="text-white font-medium">{option}</span>
            </motion.button>
          ))}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6"
          >
            <p className="text-white/80 mb-4">{question.explanation}</p>
            <Button
              onClick={onContinue}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
