import crypto from "crypto";

/** Проверка подписи Telegram initData. Возвращает пользователя или null. */
export function checkInitData(initData: string): any | null {
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get("hash");
    if (!hash) return null;
    p.delete("hash");
    const data = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN!).digest();
    const calc = crypto.createHmac("sha256", secret).update(data).digest("hex");
    if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
    if (Date.now() / 1000 - Number(p.get("auth_date")) > 86400) return null;
    return JSON.parse(p.get("user")!);
  } catch {
    return null;
  }
}
