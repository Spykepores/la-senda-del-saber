import { GAME_CATEGORIES, SEALS_TO_BREAK } from "./types";
import type { WheelResult, PlayerInfo } from "./types";

// ============================================================
// LOGICA DE LA RULETA
// ============================================================

const CATEGORY_IDS = GAME_CATEGORIES.map((c) => c.id);
const ANGLE_PER_CATEGORY = 360 / CATEGORY_IDS.length;

/**
 * Genera un resultado de ruleta determinado por el servidor.
 * El cliente solo recibe el resultado final.
 */
export function spinWheel(mySeals: Record<string, number>): WheelResult {
  // Solo elegir categorias que no estan completas
  const avail = CATEGORY_IDS.filter((id) => (mySeals[id] || 0) < SEALS_TO_BREAK);
  const pool = avail.length > 0 ? avail : CATEGORY_IDS;

  const categoryId = pool[Math.floor(Math.random() * pool.length)];
  const categoryIdx = CATEGORY_IDS.indexOf(categoryId);
  const category = GAME_CATEGORIES[categoryIdx];

  // Calcular angulo: multiples vueltas + posicion de la categoria
  const extraSpins = 3 + Math.floor(Math.random() * 3); // 3-5 vueltas
  const targetAngle = extraSpins * 360 + categoryIdx * ANGLE_PER_CATEGORY + Math.floor(Math.random() * (ANGLE_PER_CATEGORY - 10) + 5);

  return {
    angle: targetAngle,
    category: categoryId,
    categoryName: category.name,
  };
}

export function getAvailableCategories(mySeals: Record<string, number>): typeof GAME_CATEGORIES {
  const avail = GAME_CATEGORIES.filter((c) => (mySeals[c.id] || 0) < SEALS_TO_BREAK);
  return avail.length > 0 ? avail : GAME_CATEGORIES;
}
