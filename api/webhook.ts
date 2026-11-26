import { bot } from "../lib/bot";

let ready = false;

export default async function handler(req: any, res: any) {
  if (req.headers["x-telegram-bot-api-secret-token"] !== process.env.WEBHOOK_SECRET)
    return res.status(401).send("unauthorized");
  try {
    if (!ready) { await bot.init(); ready = true; }
    await bot.handleUpdate(req.body);
  } catch (e) {
    console.error("update failed", e);
  }
  res.status(200).send("ok"); // всегда 200, чтобы Telegram не повторял апдейт
}
