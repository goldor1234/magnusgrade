import { checkInitData } from "../lib/auth";
import { ensureUser } from "../lib/db";
import { MULTIPLIERS, EDGE, MIN_BET } from "../lib/config";

export default async function handler(req: any, res: any) {
  const u = checkInitData(String(req.headers["x-init-data"] || ""));
  if (!u) return res.status(401).json({ error: "bad initData" });
  const { user } = await ensureUser(u.id, u.username ?? null);
  res.json({ balance: user.balance, banned: user.banned, multipliers: MULTIPLIERS, edge: EDGE, min_bet: MIN_BET });
}
