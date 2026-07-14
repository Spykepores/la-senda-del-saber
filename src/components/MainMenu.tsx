import { motion } from 'framer-motion';
import { useState } from 'react';
import { Play, Trophy, Settings, HelpCircle, Users, Zap, Swords, LogIn, LogOut, Shield, User, Lock, X, MessageCircle, UserPlus } from 'lucide-react';
import { useSound } from '@/hooks/useSound';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion as motion2 } from 'framer-motion';

interface MainMenuProps {
  onPlay: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onTutorial: () => void;
  onLogout?: () => void;
  user?: {
    id: number;
    name: string | null;
    email?: string | null;
    avatar?: string | null;
    role: string;
    phone?: string | null;
  } | null;
}

export function MainMenu({ onPlay, onLeaderboard, onSettings, onTutorial, onLogout, user }: MainMenuProps) {
  const { play } = useSound();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const isAuthenticated = !!user;

  const handleClick = (fn: () => void) => {
    play('click');
    fn();
  };

  const handleChallengesClick = () => {
    play('click');
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    navigate('/challenges');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/bg_main.jpg)' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/40 via-transparent to-indigo-900/70" />

      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div key={i} className="absolute w-1 h-1 bg-amber-300 rounded-full"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }} />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-4">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', duration: 1 }} className="mb-4">
          <img src="/images/crown.png" alt="Corona" className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]" />
        </motion.div>

        <motion.h1 initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-4xl font-bold text-center mb-1" style={{ color: '#FEF3C7', textShadow: '0 0 30px rgba(245,158,11,0.5), 0 4px 8px rgba(0,0,0,0.5)' }}>
          La Senda del Saber
        </motion.h1>
        <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-lg text-amber-200 mb-8 tracking-wider" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          Edicion Divina
        </motion.p>

        {/* Menu Buttons */}
        <div className="flex flex-col gap-3 w-72">
          <motion.button initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(79,70,229,0.6)' }} whileTap={{ scale: 0.95 }}
            onClick={() => handleClick(onPlay)}
            className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold text-lg text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 15px rgba(79,70,229,0.4)' }}>
            <Play size={22} fill="white" /> Jugar
          </motion.button>

          <motion.button initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.75 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(239,68,68,0.5)' }} whileTap={{ scale: 0.95 }}
            onClick={handleChallengesClick}
            className="flex items-center justify-center gap-3 py-3 px-6 rounded-2xl font-semibold text-white transition-all relative"
            style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 4px 15px rgba(239,68,68,0.4)' }}>
            <Swords size={20} /> Desafios
            {!isAuthenticated && (
              <span className="absolute -top-1 -right-1 bg-white/20 rounded-full p-0.5"><Lock size={10} className="text-white" /></span>
            )}
          </motion.button>

          <motion.button initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.8 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(245,158,11,0.5)' }} whileTap={{ scale: 0.95 }}
            onClick={() => handleClick(onLeaderboard)}
            className="flex items-center justify-center gap-3 py-3 px-6 rounded-2xl font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 15px rgba(245,158,11,0.4)' }}>
            <Trophy size={20} /> Records
          </motion.button>

          <motion.button initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.9 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(16,185,129,0.5)' }} whileTap={{ scale: 0.95 }}
            onClick={() => handleClick(onTutorial)}
            className="flex items-center justify-center gap-3 py-3 px-6 rounded-2xl font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 15px rgba(16,185,129,0.4)' }}>
            <HelpCircle size={20} /> Como Jugar
          </motion.button>

          <motion.button initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1.0 }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(107,114,128,0.5)' }} whileTap={{ scale: 0.95 }}
            onClick={() => handleClick(onSettings)}
            className="flex items-center justify-center gap-3 py-3 px-6 rounded-2xl font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #6B7280, #4B5563)', boxShadow: '0 4px 15px rgba(107,114,128,0.4)' }}>
            <Settings size={20} /> Configuracion
          </motion.button>
        </div>

        {/* Auth & Admin buttons */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {!user && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.08 }}
                onClick={() => handleClick(() => navigate('/register'))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm transition font-medium"
              >
                <UserPlus size={16} />
                Registrarse
              </motion.button>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                onClick={() => handleClick(() => navigate('/login'))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-sm transition"
              >
                <LogIn size={16} />
                Iniciar Sesion
              </motion.button>
            </>
          )}
          {user && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }} className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-white/80 text-sm">
                  <User size={14} /> {user.name}
                </div>
                <span className="text-[10px] text-amber-400/70 font-mono">ID: {user.id}</span>
              </motion.div>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.08 }}
                onClick={() => handleClick(() => navigate('/chat'))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-300 text-sm transition">
                <MessageCircle size={16} /> Chat
              </motion.button>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
                onClick={() => { play('click'); onLogout?.(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition">
                <LogOut size={16} /> Salir
              </motion.button>
            </>
          )}
          {user?.role === 'admin' && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.15 }}
              onClick={() => handleClick(() => navigate('/admin'))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm transition">
              <Shield size={16} /> Admin
            </motion.button>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
          className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
          <Users size={16} className="text-amber-300" />
          <Zap size={14} className="text-amber-300" />
          <span className="text-sm text-amber-200">Multijugador • Retos • Power-ups</span>
        </motion.div>
      </div>

      {/* Login Required Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion2.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={() => setShowLoginModal(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion2.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 30 }}
              className="relative bg-indigo-900 rounded-2xl p-6 max-w-sm w-full border border-white/20 text-center" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowLoginModal(false)} className="absolute top-3 right-3 text-white/40 hover:text-white"><X size={18} /></button>
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4"><Lock className="w-7 h-7 text-amber-400" /></div>
              <h3 className="text-xl font-bold text-white mb-2">Inicia Sesion</h3>
              <p className="text-white/60 text-sm mb-6">Para retar a otros jugadores online necesitas tener una cuenta e iniciar sesion.</p>
              <div className="flex gap-3">
                <button onClick={() => navigate('/login')} className="flex-1 py-3 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">Iniciar Sesion</button>
                <button onClick={() => setShowLoginModal(false)} className="flex-1 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition">Cancelar</button>
              </div>
            </motion2.div>
          </motion2.div>
        )}
      </AnimatePresence>
    </div>
  );
}
