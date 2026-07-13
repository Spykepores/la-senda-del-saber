import { motion } from 'framer-motion';
import { Crown, Home, RotateCcw, Timer, Star, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Player {
  name: string;
  score: number;
  correct: number;
  wrong: number;
  broken: number;
}

interface VictoryScreenProps {
  winner: Player;
  players: Player[];
  elapsedTime: number;
  onHome: () => void;
  onRematch: () => void;
}

export function VictoryScreen({ winner, players, elapsedTime, onHome, onRematch }: VictoryScreenProps) {
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="text-center max-w-md w-full"
      >
        {/* Crown */}
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-6"
        >
          <Crown className="w-24 h-24 text-yellow-400 mx-auto" style={{ filter: 'drop-shadow(0 0 20px rgba(250, 204, 21, 0.5))' }} />
        </motion.div>

        {/* Winner text */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold text-white mb-2"
        >
          Ganador
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-8"
        >
          {winner.name}
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{winner.score}</p>
            <p className="text-sm text-white/50">Puntos</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Shield className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{winner.broken}/7</p>
            <p className="text-sm text-white/50">Sellos rotos</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Timer className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{formatTime(elapsedTime)}</p>
            <p className="text-sm text-white/50">Tiempo</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Star className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{winner.correct}</p>
            <p className="text-sm text-white/50">Correctas</p>
          </div>
        </motion.div>

        {/* Player rankings */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="space-y-2 mb-8"
        >
          {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
              <span className="text-lg font-bold text-white/50 w-8">#{i + 1}</span>
              <span className="flex-1 text-white font-medium text-left">{p.name}</span>
              <span className="text-yellow-400 font-bold">{p.score} pts</span>
            </div>
          ))}
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="flex gap-4"
        >
          <Button onClick={onHome} variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10">
            <Home className="w-4 h-4 mr-2" /> Inicio
          </Button>
          <Button onClick={onRematch} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
            <RotateCcw className="w-4 h-4 mr-2" /> Revancha
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
