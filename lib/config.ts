export const MULTIPLIERS = [1.5, 2, 3, 5, 10, 20];
export const EDGE = 0.05; // комиссия 5%
export const MIN_BET = 1;
export const MAX_BET = 1_000_000_000;
export const ADMINS = new Set(
  (process.env.ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean)
);
export const chanceOf = (m: number) => Math.min(0.95, (1 / m) * (1 - EDGE));
