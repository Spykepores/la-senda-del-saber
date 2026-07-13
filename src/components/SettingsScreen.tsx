import { motion } from 'framer-motion';
import { ChevronLeft, Volume2, VolumeX, Music, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface SettingsScreenProps {
  soundEnabled: boolean;
  musicEnabled: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onSetDifficulty: (d: 'easy' | 'medium' | 'hard') => void;
  onResetLeaderboard: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  soundEnabled,
  musicEnabled,
  difficulty,
  onToggleSound,
  onToggleMusic,
  onSetDifficulty,
  onResetLeaderboard,
  onBack,
}: SettingsScreenProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="text-white/60 hover:text-white transition">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Configuracion</h1>
      </div>

      <div className="max-w-md mx-auto w-full space-y-6">
        {/* Sound */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-green-400" />
              ) : (
                <VolumeX className="w-5 h-5 text-red-400" />
              )}
              <span className="text-white font-medium">Sonido</span>
            </div>
            <button
              onClick={onToggleSound}
              className={`w-14 h-8 rounded-full transition-all ${
                soundEnabled ? 'bg-green-500' : 'bg-white/20'
              }`}
            >
              <motion.div
                animate={{ x: soundEnabled ? 24 : 4 }}
                className="w-6 h-6 rounded-full bg-white shadow"
              />
            </button>
          </div>
        </div>

        {/* Music */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Music className={`w-5 h-5 ${musicEnabled ? 'text-green-400' : 'text-red-400'}`} />
              <span className="text-white font-medium">Musica</span>
            </div>
            <button
              onClick={onToggleMusic}
              className={`w-14 h-8 rounded-full transition-all ${
                musicEnabled ? 'bg-green-500' : 'bg-white/20'
              }`}
            >
              <motion.div
                animate={{ x: musicEnabled ? 24 : 4 }}
                className="w-6 h-6 rounded-full bg-white shadow"
              />
            </button>
          </div>
        </div>

        {/* Difficulty */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h3 className="text-white font-medium mb-3">Dificultad</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => onSetDifficulty(d)}
                className={`py-2 rounded-lg font-medium text-sm transition-all ${
                  difficulty === d
                    ? 'bg-amber-500 text-indigo-950'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {d === 'easy' ? 'Facil' : d === 'medium' ? 'Medio' : 'Dificil'}
              </button>
            ))}
          </div>
        </div>

        {/* Reset Leaderboard */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h3 className="text-white font-medium mb-3">Datos</h3>
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">Borrar Records</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Estas seguro? Esta accion no se puede deshacer.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { onResetLeaderboard(); setShowResetConfirm(false); }}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-400 transition"
                >
                  Borrar
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2 bg-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/20 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
