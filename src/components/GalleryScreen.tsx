import { motion } from 'framer-motion';
import { ChevronLeft, Lock, Unlock, Crown, Star, BookOpen, Users, Shield, Flame, Compass, Heart, Moon } from 'lucide-react';

interface GalleryScreenProps {
  unlockedIds: string[];
  onBack: () => void;
}

const GALLERY_ITEMS = [
  { id: 'bible', name: 'La Biblia', description: 'El libro sagrado', icon: BookOpen, color: '#F59E0B' },
  { id: 'crown', name: 'Corona de Vida', description: 'Para los fieles', icon: Crown, color: '#EF4444' },
  { id: 'star', name: 'Estrella de David', description: 'Simbolo de Israel', icon: Star, color: '#3B82F6' },
  { id: 'shield', name: 'Escudo de Fe', description: 'Proteccion divina', icon: Shield, color: '#10B981' },
  { id: 'flame', name: 'Fuego del Espiritu', description: 'Pentecostes', icon: Flame, color: '#F97316' },
  { id: 'compass', name: 'Guia Divina', description: 'El camino correcto', icon: Compass, color: '#8B5CF6' },
  { id: 'heart', name: 'Amor de Dios', description: 'El mayor mandamiento', icon: Heart, color: '#EC4899' },
  { id: 'moon', name: 'Luz en la Oscuridad', description: 'Jesus es la luz', icon: Moon, color: '#6366F1' },
];

export function GalleryScreen({ unlockedIds, onBack }: GalleryScreenProps) {
  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="text-white/60 hover:text-white transition">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Galeria</h1>
        <span className="text-sm text-white/50 ml-auto">
          {unlockedIds.length}/{GALLERY_ITEMS.length}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto w-full">
        {GALLERY_ITEMS.map((item, index) => {
          const isUnlocked = unlockedIds.includes(item.id);
          const Icon = item.icon;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl p-6 border text-center transition-all ${
                isUnlocked
                  ? 'bg-white/5 border-white/20'
                  : 'bg-white/[0.02] border-white/5 opacity-50'
              }`}
            >
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-white/20" />
                </div>
              )}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: isUnlocked ? `${item.color}33` : 'rgba(255,255,255,0.05)' }}
              >
                <Icon
                  className="w-8 h-8"
                  style={{ color: isUnlocked ? item.color : 'rgba(255,255,255,0.2)' }}
                />
              </div>
              <h3 className="font-bold text-white text-sm mb-1">{item.name}</h3>
              <p className="text-xs text-white/50">{item.description}</p>
              {isUnlocked && (
                <div className="mt-2 flex items-center justify-center gap-1">
                  <Unlock className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400">Desbloqueado</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
