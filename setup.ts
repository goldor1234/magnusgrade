import { bot } from "../lib/bot";

// Открыть один раз после деплоя: /api/setup?secret=ВАШ_WEBHOOK_SECRET
export default async function handler(req: any, res: any) {
  if (req.query.secret !== process.env.WEBHOOK_SECRET) return res.status(403).send("forbidden");
  const url = `${process.env.WEBAPP_URL}/api/webhook`;
  await bot.api.setWebhook(url, {
    secret_token: process.env.WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  res.json({ ok: true, webhook: url, info: await bot.api.getWebhookInfo() });
}
