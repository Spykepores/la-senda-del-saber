import { motion } from 'framer-motion';
import { ChevronLeft, Play, RotateCcw, Users, Zap, Star, Shield } from 'lucide-react';

interface TutorialScreenProps {
  onBack: () => void;
}

export function TutorialScreen({ onBack }: TutorialScreenProps) {
  const steps = [
    {
      icon: Play,
      title: 'Como Jugar',
      description: 'Gira la ruleta para obtener una categoria biblica. Responde correctamente para romper los sellos.',
      color: '#4F46E5',
    },
    {
      icon: Shield,
      title: 'Sistema de Sellos',
      description: 'Hay 7 sellos (categorias). Necesitas 2 respuestas correctas por categoria para romper cada sello.',
      color: '#8B5CF6',
    },
    {
      icon: Star,
      title: 'Puntuacion',
      description: 'Cada respuesta correcta te da 100 puntos. Rompe los 7 sellos para ganar!',
      color: '#F59E0B',
    },
    {
      icon: Zap,
      title: 'Modo Rush',
      description: 'En modo Rush tienes 60 segundos para responder todas las preguntas que puedas.',
      color: '#EF4444',
    },
    {
      icon: Users,
      title: 'Desafios Online',
      description: 'Retar a otros jugadores en tiempo real. El primero en romper todos los sellos gana!',
      color: '#10B981',
    },
    {
      icon: RotateCcw,
      title: 'Rangos',
      description: 'Sube de rango respondiendo correctamente. Desde Siervo hasta Apostol!',
      color: '#EC4899',
    },
  ];

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="text-white/60 hover:text-white transition">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Como Jugar</h1>
      </div>

      <div className="max-w-2xl mx-auto w-full space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex gap-4 bg-white/5 rounded-xl p-4 border border-white/10"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: step.color + '33' }}
              >
                <Icon className="w-6 h-6" style={{ color: step.color }} />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">{step.title}</h3>
                <p className="text-sm text-white/60">{step.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
