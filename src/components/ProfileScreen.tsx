import { motion } from 'framer-motion';
import { ChevronLeft, User, Star, Shield, Trophy, Target } from 'lucide-react';
import type { Player } from '@/types/game';

interface ProfileScreenProps {
  player: Player;
  onBack: () => void;
}

export function ProfileScreen({ player, onBack }: ProfileScreenProps) {
  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="text-white/60 hover:text-white transition">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
      </div>

      <div className="max-w-md mx-auto w-full">
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex flex-col items-center mb-8"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: player.color + '33', border: `3px solid ${player.color}` }}
          >
            <User className="w-12 h-12" style={{ color: player.color }} />
          </div>
          <h2 className="text-xl font-bold text-white">{player.name}</h2>
          <p className="text-sm" style={{ color: player.rank.color }}>
            {player.rank.symbol} {player.rank.name}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <Star className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{player.score}</p>
            <p className="text-xs text-white/50">Puntos</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{player.correct}</p>
            <p className="text-xs text-white/50">Correctas</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <Target className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{player.wrong}</p>
            <p className="text-xs text-white/50">Incorrectas</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <Shield className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{player.broken}/7</p>
            <p className="text-xs text-white/50">Sellos rotos</p>
          </div>
        </div>

        {/* Seals progress */}
        <h3 className="text-lg font-bold text-white mb-4">Progreso de Sellos</h3>
        <div className="space-y-3">
          {Object.entries(player.seals).map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="text-sm text-white/70 w-24 capitalize">{cat}</span>
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (count / 2) * 100)}%` }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: count >= 2 ? '#10B981' : '#F59E0B',
                  }}
                />
              </div>
              <span className="text-sm text-white/50 w-8">{count}/2</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
