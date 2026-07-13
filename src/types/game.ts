export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface Question {
  id: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Player {
  id: number;
  name: string;
  score: number;
  correct: number;
  wrong: number;
  broken: number;
  seals: Record<string, number>;
  color: string;
  rank: Rank;
  galleryUnlocked: string[];
}

export interface Rank {
  name: string;
  symbol: string;
  color: string;
  description: string;
  requiredCorrect: number;
}

export type GameScreen =
  | 'menu'
  | 'modeSelect'
  | 'playerSetup'
  | 'sealHub'
  | 'roulette'
  | 'question'
  | 'duelQuestion'
  | 'rushMode'
  | 'victory'
  | 'leaderboard'
  | 'settings'
  | 'tutorial'
  | 'profile'
  | 'gallery';

export type GameMode = 'solo' | 'rush' | 'online';

export interface LeaderboardEntry {
  name: string;
  score: number;
  correct: number;
  wrong: number;
  broken: number;
  time: number;
  date: string;
}

export const CATEGORIES: Category[] = [
  { id: 'genealogy', name: 'Genealogia', icon: 'Users', color: '#92400E', description: 'Arboles genealogicos y descendencias' },
  { id: 'parables', name: 'Parabolas', icon: 'MessageCircle', color: '#14B8A6', description: 'Las ensenanzas de Jesus en parabolas' },
  { id: 'stories', name: 'Historias', icon: 'BookOpen', color: '#3B82F6', description: 'Relatos biblicos memorables' },
  { id: 'prophecy', name: 'Profecia', icon: 'Star', color: '#7C3AED', description: 'Profecias y su cumplimiento' },
  { id: 'doctrine', name: 'Doctrina', icon: 'Shield', color: '#6B7280', description: 'Enseñanzas fundamentales' },
  { id: 'characters', name: 'Personajes', icon: 'User', color: '#F59E0B', description: 'Figuras importantes de la Biblia' },
  { id: 'books', name: 'Libros', icon: 'Library', color: '#8B5CF6', description: 'Los libros de la Biblia' },
];

export const RANKS: Rank[] = [
  { name: 'Siervo', symbol: '✦', color: '#6B7280', description: 'Comienza tu viaje', requiredCorrect: 0 },
  { name: 'Obrero', symbol: '⚒', color: '#8B5CF6', description: 'Trabajando en la viña', requiredCorrect: 5 },
  { name: 'Siervo Fiel', symbol: '✶', color: '#3B82F6', description: 'Demostrando fidelidad', requiredCorrect: 15 },
  { name: 'Maestro', symbol: '📖', color: '#14B8A6', description: 'Compartiendo sabiduría', requiredCorrect: 30 },
  { name: 'Evangelista', symbol: '✝', color: '#F59E0B', description: 'Llevando la palabra', requiredCorrect: 50 },
  { name: 'Anciano', symbol: '♔', color: '#EF4444', description: 'Guía espiritual', requiredCorrect: 75 },
  { name: 'Apóstol', symbol: '👑', color: '#FBBF24', description: 'Fundamento de la iglesia', requiredCorrect: 100 },
];

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Fácil',
  medium: 'Medio',
  hard: 'Difícil',
};

export const SEALS_TO_BREAK = 2;
export const TOTAL_SEALS = 7;
