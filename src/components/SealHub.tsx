import { motion } from 'framer-motion';
import { Settings, Trophy, User, Image, Play, HelpCircle } from 'lucide-react';
import type { Player } from '@/types/game';
import { CATEGORIES } from '@/types/game';

interface SealHubProps {
  player: Player;
  elapsedTime: number;
  onSpin: () => void;
  onProfile: () => void;
  onGallery: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
}

export function SealHub({ player, elapsedTime, onSpin, onProfile, onGallery, onLeaderboard, onSettings }: SealHubProps) {
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const brokenSeals = Object.entries(player.seals).filter(([_, v]) => v >= 2).length;

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Player info */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: player.color + '33' }}>
              <User className="w-5 h-5" style={{ color: player.color }} />
            </div>
            <div>
              <p className="font-bold text-white">{player.name}</p>
              <p className="text-xs text-white/50">{player.rank.symbol} {player.rank.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{player.score}</p>
              <p className="text-xs text-white/50">Puntos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">{brokenSeals}/7</p>
              <p className="text-xs text-white/50">Sellos</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white/70">{formatTime(elapsedTime)}</p>
              <p className="text-xs text-white/50">Tiempo</p>
            </div>
          </div>
        </div>

        {/* Seals */}
        <div className="grid grid-cols-7 gap-2 mb-8">
          {CATEGORIES.map((cat, i) => {
            const progress = player.seals[cat.id] || 0;
            const isBroken = progress >= 2;

            return (
              <motion.div
                key={cat.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-all ${
                    isBroken
                      ? 'bg-amber-500/20 border-2 border-amber-500'
                      : 'bg-white/5 border-2 border-white/10'
                  }`}
                >
                  <span className="text-lg font-bold" style={{ color: isBroken ? '#F59E0B' : 'rgba(255,255,255,0.3)' }}>
                    {progress}
                  </span>
                </div>
                <span className="text-[10px] text-white/50 text-center leading-tight">{cat.name}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Spin button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSpin}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl font-bold text-lg text-white mb-6 hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
          style={{ boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)' }}
        >
          <Play className="w-6 h-6" fill="white" /> Girar Ruleta
        </motion.button>

        {/* Menu buttons */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={onProfile} className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition border border-white/10">
            <User className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-white/70">Perfil</span>
          </button>
          <button onClick={onGallery} className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition border border-white/10">
            <Image className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-white/70">Galeria</span>
          </button>
          <button onClick={onLeaderboard} className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition border border-white/10">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span className="text-xs text-white/70">Records</span>
          </button>
          <button onClick={onSettings} className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition border border-white/10">
            <Settings className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-white/70">Config</span>
          </button>
        </div>
      </div>
    </div>
  );
}
