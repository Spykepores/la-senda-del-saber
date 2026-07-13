import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Category } from '@/types/game';
import { CATEGORIES } from '@/types/game';

interface RouletteWheelProps {
  isSpinning: boolean;
  targetCategory: Category | null;
}

export function RouletteWheel({ isSpinning, targetCategory }: RouletteWheelProps) {
  const [displayCategory, setDisplayCategory] = useState<Category>(CATEGORIES[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isSpinning) return;

    setIsAnimating(true);
    let index = 0;
    const interval = setInterval(() => {
      setDisplayCategory(CATEGORIES[index % CATEGORIES.length]);
      index++;
    }, 100);

    // Stop after 2 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (targetCategory) {
        setDisplayCategory(targetCategory);
      }
      setIsAnimating(false);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSpinning, targetCategory]);

  if (!isSpinning && !targetCategory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className="text-center"
      >
        <motion.div
          animate={isAnimating ? { rotate: 360 } : { rotate: 0 }}
          transition={isAnimating ? { duration: 0.5, repeat: Infinity, ease: 'linear' } : {}}
          className="w-48 h-48 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{
            background: `conic-gradient(${CATEGORIES.map((c, i) => `${c.color} ${i * (360 / CATEGORIES.length)}deg ${(i + 1) * (360 / CATEGORIES.length)}deg`).join(', ')})`,
            boxShadow: `0 0 60px ${displayCategory.color}44`,
          }}
        >
          <div className="w-32 h-32 rounded-full bg-indigo-950 flex items-center justify-center">
            <span className="text-4xl font-bold" style={{ color: displayCategory.color }}>
              {displayCategory.name.charAt(0)}
            </span>
          </div>
        </motion.div>

        <motion.h2
          key={displayCategory.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white mb-2"
          style={{ color: displayCategory.color }}
        >
          {displayCategory.name}
        </motion.h2>
        <p className="text-white/50">{displayCategory.description}</p>
      </motion.div>
    </div>
  );
}
