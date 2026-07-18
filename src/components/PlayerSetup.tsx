import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, X, Play, Users } from "lucide-react";

const PLAYER_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B"];
const MAX_PLAYERS = 4;

interface PlayerSetupProps {
  onStart: (names: string[]) => void;
  onBack: () => void;
}

export function PlayerSetup({ onStart, onBack }: PlayerSetupProps) {
  const [names, setNames] = useState<string[]>([""]);

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const addPlayer = () => {
    if (names.length < MAX_PLAYERS) setNames((prev) => [...prev, ""]);
  };

  const removePlayer = (index: number) => {
    if (names.length > 1) setNames((prev) => prev.filter((_, i) => i !== index));
  };

  const validNames = names.map((n) => n.trim()).filter((n) => n.length > 0);
  const canStart = validNames.length > 0;

  const handleStart = () => {
    if (canStart) onStart(validNames);
  };

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-amber-400 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Modo Solo / Local</h1>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <Users className="w-14 h-14 text-amber-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-1">¿Quienes juegan?</h2>
            <p className="text-white/50 text-sm">
              Escribe el nombre de cada jugador (1 a {MAX_PLAYERS})
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {names.map((name, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: `${PLAYER_COLORS[index % PLAYER_COLORS.length]}33`, color: PLAYER_COLORS[index % PLAYER_COLORS.length], border: `2px solid ${PLAYER_COLORS[index % PLAYER_COLORS.length]}66` }}
                >
                  {index + 1}
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => updateName(index, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                  placeholder={`Jugador ${index + 1}`}
                  maxLength={20}
                  autoFocus={index === 0}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 text-sm"
                />
                {names.length > 1 && (
                  <button
                    onClick={() => removePlayer(index)}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>

          {names.length < MAX_PLAYERS && (
            <button
              onClick={addPlayer}
              className="w-full py-3 mb-4 bg-white/5 border border-dashed border-white/20 text-white/60 rounded-2xl font-medium hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-2 text-sm"
            >
              <UserPlus className="w-4 h-4" /> Agregar jugador
            </button>
          )}

          <motion.button
            whileHover={canStart ? { scale: 1.02 } : {}}
            whileTap={canStart ? { scale: 0.98 } : {}}
            onClick={handleStart}
            disabled={!canStart}
            className="w-full py-4 bg-amber-500 text-indigo-950 rounded-2xl font-bold text-lg hover:bg-amber-400 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={canStart ? { boxShadow: "0 4px 20px rgba(245,158,11,0.4)" } : {}}
          >
            <Play className="w-5 h-5" /> Comenzar Juego
          </motion.button>

          <p className="text-center text-[10px] text-white/30 mt-4">
            Los jugadores se turnan en el mismo dispositivo
          </p>
        </motion.div>
      </div>
    </div>
  );
}
