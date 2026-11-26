import crypto from "crypto";
import { checkInitData } from "../lib/auth";
import { sb } from "../lib/db";
import { MULTIPLIERS, MIN_BET, MAX_BET, chanceOf } from "../lib/config";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const u = checkInitData(String(req.headers["x-init-data"] || ""));
  if (!u) return res.status(401).json({ error: "bad initData" });

  const bet = Number(req.body?.bet);
  const mult = Number(req.body?.mult);
  if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET || !MULTIPLIERS.includes(mult))
    return res.status(400).json({ error: "Некорректные данные" });

  // бросок на сервере, криптостойкий генератор
  const chance = chanceOf(mult);
  const win = crypto.randomInt(0, 1_000_000) < Math.floor(chance * 1_000_000);

  const { data, error } = await sb.rpc("play_upgrade", {
    p_user: u.id, p_bet: bet, p_mult: mult, p_chance: chance, p_win: win,
  });
  if (error) return res.status(500).json({ error: "Ошибка сервера" });
  if (!data.ok)
    return res.status(data.error === "cooldown" ? 429 : 400)
      .json({ error: data.error === "cooldown" ? "Слишком быстро, подожди секунду" : "Недостаточно средств" });
  res.json({ win, payout: data.payout, balance: data.balance, chance });
}
