import { motion } from 'framer-motion';
import { ChevronLeft, User, Zap, Swords } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router';

interface ModeSelectProps {
  onSelectMode: (mode: 'solo' | 'rush' | 'online') => void;
  onBack: () => void;
}

export function ModeSelect({ onSelectMode, onBack }: ModeSelectProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleOnline = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/challenges');
  };

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-white/60 hover:text-white transition">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Selecciona Modo</h1>
        </div>

        <div className="space-y-4">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => onSelectMode('solo')}
            className="w-full p-6 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition">
                <User className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Solo</h3>
                <p className="text-sm text-white/50">Juega individualmente con la ruleta de categorias</p>
              </div>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => onSelectMode('rush')}
            className="w-full p-6 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition">
                <Zap className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Rush</h3>
                <p className="text-sm text-white/50">60 segundos para responder todas las que puedas</p>
              </div>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleOnline}
            className="w-full p-6 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition">
                <Swords className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Desafios Online</h3>
                <p className="text-sm text-white/50">Retar a otros jugadores en tiempo real</p>
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
