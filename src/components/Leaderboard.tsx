import { motion } from 'framer-motion';
import { ChevronLeft, Trophy, Clock, Star, Shield } from 'lucide-react';
import type { LeaderboardEntry } from '@/types/game';

interface LeaderboardScreenProps {
  entries: LeaderboardEntry[];
  onBack: () => void;
}

export function LeaderboardScreen({ entries, onBack }: LeaderboardScreenProps) {
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="text-white/60 hover:text-white transition">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Records</h1>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40">
          <Trophy className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">No hay records aun</p>
          <p className="text-sm">Juega para establecer tu primer record</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto w-full space-y-3">
          {entries.map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                index === 0 ? 'bg-amber-500 text-indigo-950' :
                index === 1 ? 'bg-gray-300 text-indigo-950' :
                index === 2 ? 'bg-orange-600 text-white' :
                'bg-white/10 text-white/50'
              }`}>
                {index + 1}
              </div>

              <div className="flex-1">
                <p className="font-bold text-white">{entry.name}</p>
                <div className="flex items-center gap-3 text-xs text-white/50">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" />{entry.score}</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-purple-400" />{entry.broken}/7</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-400" />{formatTime(entry.time)}</span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-amber-400 font-bold">{entry.score} pts</p>
                <p className="text-xs text-white/40">{entry.correct} correctas</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
