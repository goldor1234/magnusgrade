import { checkInitData } from "../lib/auth";
import { ensureUser } from "../lib/db";
import { MULTIPLIERS, EDGE, MIN_BET, ADMINS } from "../lib/config";

export default async function handler(req: any, res: any) {
  const u = checkInitData(String(req.headers["x-init-data"] || ""));
  if (!u) return res.status(401).json({ error: "bad initData" });
  const { user } = await ensureUser(u.id, u.username ?? null);
  res.json({
    user_id: u.id,
    balance: user.balance,
    banned: user.banned,
    multipliers: MULTIPLIERS,
    edge: EDGE,
    min_bet: MIN_BET,
    admin_id: ADMINS.values().next().value ?? null,
  });
}
