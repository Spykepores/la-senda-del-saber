import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Zap, Globe, Lock, Brain } from 'lucide-react';
import type { GameMode } from '@/types/game';
import { useSound } from '@/hooks/useSound';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router';

interface ModeSelectProps {
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
}

const modes = [
  {
    id: 'solo' as GameMode,
    title: 'Modo Solo',
    description: 'Juega por tu cuenta rompiendo los 7 sellos. Responde preguntas de diferentes categorias y avanza en tu camino de fe.',
    icon: User,
    color: '#4F46E5',
    features: ['1 jugador', '7 categorias', 'Ruleta de sellos'],
  },
  {
    id: 'rush' as GameMode,
    title: 'Rush Relampago',
    description: '60 segundos para responder la mayor cantidad de preguntas. Acumula combos y sube en la tabla de records!',
    icon: Zap,
    color: '#F59E0B',
    features: ['1 jugador', '60 segundos', 'Modo arcade'],
  },
  {
    id: 'online' as GameMode,
    title: 'Desafios Online',
    description: 'Reta a otros jugadores en duelos de fe por rondas. Solo disponible si has iniciado sesion.',
    icon: Globe,
    color: '#EF4444',
    features: ['Multijugador', 'Requiere login', 'Chat en vivo'],
    requiresAuth: true,
  },
];

export function ModeSelect({ onSelectMode, onBack }: ModeSelectProps) {
  const { play } = useSound();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleSelect = (mode: GameMode) => {
    play('click');
    const selected = modes.find(m => m.id === mode);
    if (selected?.requiresAuth && !isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (mode === 'online') {
      navigate('/challenges');
      return;
    }
    onSelectMode(mode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-950 flex flex-col items-center px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-md flex items-center mb-6">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => { play('click'); onBack(); }}
          className="p-2 rounded-full bg-white/10 text-white"
        >
          <ArrowLeft size={24} />
        </motion.button>
        <h2 
          className="flex-1 text-center text-2xl font-bold text-white mr-10"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
        >
          Elige tu Modo
        </h2>
      </div>

      {/* Floating Brain Icon */}
      <motion.div
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/20 flex items-center justify-center mb-4 backdrop-blur-sm"
        animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: '0 0 25px rgba(99,102,241,0.4)' }}
      >
        <Brain size={32} className="text-indigo-300" />
      </motion.div>

      {/* Mode Cards */}
      <div className="flex flex-col gap-4 w-full max-w-md">
        {modes.map((mode, index) => (
          <motion.button
            key={mode.id}
            initial={{ x: index % 2 === 0 ? -100 : 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 + index * 0.15, type: 'spring' }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleSelect(mode.id)}
            className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all`}
            style={{ 
              background: `linear-gradient(135deg, ${mode.color}, ${mode.color}dd)`,
              boxShadow: `0 8px 25px ${mode.color}44`,
            }}
          >
            {/* Glow effect */}
            <div 
              className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-20"
              style={{ background: `radial-gradient(circle, white, transparent)` }}
            />
            
            <div className="relative flex items-start gap-4">
              <div className="p-3 rounded-xl bg-white/20 relative">
                <mode.icon size={28} className="text-white" />
                {mode.requiresAuth && !isAuthenticated && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <Lock size={10} className="text-red-500" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-white">{mode.title}</h3>
                  {mode.requiresAuth && !isAuthenticated && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white/70 flex items-center gap-1">
                      <Lock size={9} /> Login requerido
                    </span>
                  )}
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-3">{mode.description}</p>
                <div className="flex flex-wrap gap-2">
                  {mode.features.map(f => (
                    <span key={f} className="text-xs px-2 py-1 rounded-full bg-white/20 text-white/90">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 max-w-md w-full"
      >
        <Globe size={18} className="text-amber-400 flex-shrink-0" />
        <p className="text-sm text-white/70">
          Los Desafios Online requieren iniciar sesion. Crea una cuenta o inicia sesion para retar a otros jugadores.
        </p>
      </motion.div>

      {/* Login Required Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            onClick={() => setShowLoginModal(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              className="relative bg-indigo-900 rounded-2xl p-6 max-w-sm w-full border border-white/20 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Inicia Sesion</h3>
              <p className="text-white/60 text-sm mb-6">
                Para retar a otros jugadores online necesitas tener una cuenta e iniciar sesion.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 py-3 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition"
                >
                  Iniciar Sesion
                </button>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
