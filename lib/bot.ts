import { Bot, InlineKeyboard } from "grammy";
import { ADMINS } from "./config";
import { sb, ensureUser, changeBalance } from "./db";

const APP = process.env.WEBAPP_URL || "";
const PAGE = 8;
type View = { text: string; kb: InlineKeyboard };

export const bot = new Bot(process.env.BOT_TOKEN!);
bot.catch((e) => console.error("bot error:", e.error));

// ---------- клавиатуры и тексты ----------
const startKb = (uid: number) => {
  const k = new InlineKeyboard()
    .webApp("🎯 Открыть апгрейдер", APP).row()
    .text("👤 Профиль", "profile").text("📜 История", "history");
  if (ADMINS.has(uid)) k.row().text("🛠 Админ-панель", "adm:home");
  return k;
};
const backKb = () => new InlineKeyboard().text("⬅️ Назад", "back");
const appKb = () => new InlineKeyboard().webApp("🎯 Открыть апгрейдер", APP);

async function profileText(id: number) {
  const { data: u } = await sb.from("users").select("balance").eq("user_id", id).maybeSingle();
  if (!u) return "Сначала нажми /start";
  const { data: s } = await sb.rpc("user_stats", { p_user: id });
  const rate = s.games ? ((s.wins / s.games) * 100).toFixed(1) : "0.0";
  return `👤 Профиль\n\nID: ${id}\nБаланс: ${u.balance} 💎\nИгр: ${s.games}\nПобед: ${s.wins} (${rate}%)`;
}

async function historyText(id: number) {
  const { data } = await sb.from("upgrades").select("bet,multiplier,win,payout")
    .eq("user_id", id).order("id", { ascending: false }).limit(10);
  if (!data?.length) return "История пуста. Открой приложение и сыграй 🎯";
  return "📜 Последние игры:\n\n" + data.map((r) =>
    `${r.win ? "✅" : "❌"} ${r.bet} × ${r.multiplier} → ${r.win ? "+" + r.payout : "-" + r.bet}`).join("\n");
}

// меняет текст сообщения, а у сообщения с картинкой — подпись
async function show(ctx: any, text: string, kb: InlineKeyboard) {
  try {
    if (ctx.callbackQuery?.message?.photo) await ctx.editMessageCaption({ caption: text, reply_markup: kb });
    else await ctx.editMessageText(text, { reply_markup: kb });
  } catch (e: any) {
    if (!String(e?.description || e).includes("not modified")) throw e;
  }
}

// сброс «ожидания суммы» при любой команде админа
bot.use(async (ctx, next) => {
  const uid = ctx.from?.id;
  if (uid && ADMINS.has(uid) && ctx.message?.text?.startsWith("/"))
    await sb.from("admin_pending").delete().eq("admin_id", uid);
  await next();
});

// ---------- команды игрока ----------
bot.command("start", async (ctx) => {
  const id = ctx.from!.id;
  const { user, isNew } = await ensureUser(id, ctx.from!.username ?? null);
  const text =
    "🔮 Добро пожаловать в MagnusGrade!\n\n" +
    (isNew ? `Стартовый баланс: ${user.balance} 💎\n\n` : "") +
    `Баланс: ${user.balance} 💎\n\nИграть можно в приложении: выбери множитель, чем он выше, тем ниже шанс.\n\n` +
    "/app — открыть приложение\n/profile — профиль\n/history — история";
  try {
    await ctx.replyWithPhoto(`${APP}/welcome.png`, { caption: text, reply_markup: startKb(id) });
  } catch {
    await ctx.reply(text, { reply_markup: startKb(id) });
  }
});
bot.command(["app", "upgrade"], (ctx) => ctx.reply("Игра только в приложении 👇", { reply_markup: appKb() }));
bot.command("profile", async (ctx) => ctx.reply(await profileText(ctx.from!.id), { reply_markup: backKb() }));
bot.command("history", async (ctx) => ctx.reply(await historyText(ctx.from!.id), { reply_markup: backKb() }));

bot.callbackQuery("profile", async (ctx) => { await show(ctx, await profileText(ctx.from.id), backKb()); await ctx.answerCallbackQuery(); });
bot.callbackQuery("history", async (ctx) => { await show(ctx, await historyText(ctx.from.id), backKb()); await ctx.answerCallbackQuery(); });
bot.callbackQuery("back", async (ctx) => {
  const { data: u } = await sb.from("users").select("balance").eq("user_id", ctx.from.id).maybeSingle();
  await show(ctx, `Баланс: ${u?.balance ?? 0} 💎\n\nИграть можно в приложении 👇`, startKb(ctx.from.id));
  await ctx.answerCallbackQuery();
});

// ---------- админ-панель ----------
async function adminHome(): Promise<View> {
  const { data: s } = await sb.rpc("admin_stats");
  return {
    text: `🛠 Админ-панель\n\nИгроков: ${s.users}\nЗаблокировано: ${s.banned}\nВсего 💎 у игроков: ${s.total}`,
    kb: new InlineKeyboard().text("👥 Список игроков", "adm:list:0").row()
      .text("🔄 Обновить", "adm:home").row().text("🚪 Выйти", "back"),
  };
}

async function adminList(page: number): Promise<View> {
  const { data: rows, count } = await sb.from("users")
    .select("user_id,username,balance,banned", { count: "exact" })
    .order("balance", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (!rows?.length && page > 0) return adminList(0);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const kb = new InlineKeyboard();
  for (const r of rows ?? []) {
    const name = r.username ? `@${r.username}` : `id${r.user_id}`;
    kb.text(`${name} · ${r.balance} 💎${r.banned ? " 🚫" : ""}`, `adm:u:${r.user_id}:${page}`).row();
  }
  if (page > 0) kb.text("⬅️", `adm:list:${page - 1}`);
  if (page < pages - 1) kb.text("➡️", `adm:list:${page + 1}`);
  if (page > 0 || page < pages - 1) kb.row();
  kb.text("🏠 В панель", "adm:home");
  return { text: rows?.length ? `👥 Игроки (по балансу), стр. ${page + 1} из ${pages}\nВсего: ${count}` : "Игроков пока нет.", kb };
}

async function adminCard(uid: number, page = 0): Promise<View> {
  const kb = new InlineKeyboard();
  const { data: u } = await sb.from("users").select("*").eq("user_id", uid).maybeSingle();
  if (!u) return { text: "Игрок не найден.", kb: kb.text("⬅️ К списку", `adm:list:${page}`) };
  const { data: s } = await sb.rpc("user_stats", { p_user: uid });
  const text =
    `👤 ${u.username ? "@" + u.username : "без username"}\nID: ${u.user_id}\nБаланс: ${u.balance} 💎\n` +
    `Статус: ${u.banned ? "🚫 заблокирован" : "✅ активен"}\n` +
    `Регистрация: ${new Date(u.created_at).toLocaleDateString("ru-RU")}\n\n` +
    `Игр: ${s.games}, побед: ${s.wins}\nПоставлено: ${s.bets}, выиграно: ${s.payouts}`;
  for (const a of [100, 1000, 10000]) kb.text(`💰 +${a}`, `adm:give:${uid}:${page}:${a}`);
  kb.row().text("✏️ Другая сумма", `adm:custom:${uid}:${page}`).row()
    .text(u.banned ? "✅ Разбанить" : "🚫 Забанить", `adm:${u.banned ? "unban" : "ban"}:${uid}:${page}`).row()
    .text("⬅️ К списку", `adm:list:${page}`);
  return { text, kb };
}

bot.command("admin", async (ctx) => {
  if (!ADMINS.has(ctx.from!.id)) return;
  const v = await adminHome();
  await ctx.reply(v.text, { reply_markup: v.kb });
});
bot.command("user", async (ctx) => {
  if (!ADMINS.has(ctx.from!.id)) return;
  const id = Number(ctx.match.trim());
  if (!id) return ctx.reply("Использование: /user <id>");
  const v = await adminCard(id);
  await ctx.reply(v.text, { reply_markup: v.kb });
});
bot.command("stats", async (ctx) => {
  if (!ADMINS.has(ctx.from!.id)) return;
  const { data: s } = await sb.rpc("admin_stats");
  await ctx.reply(`📊 Статистика\n\nИгроков: ${s.users}\nИгр: ${s.games}\nПоставлено: ${s.bets}\nВыплачено: ${s.payouts}\nПрофит бота: ${s.bets - s.payouts}`);
});
bot.command("give", async (ctx) => {
  if (!ADMINS.has(ctx.from!.id)) return;
  const [id, amount] = ctx.match.trim().split(/\s+/).map(Number);
  if (!id || !Number.isInteger(amount)) return ctx.reply("Использование: /give <id> <сумма>");
  const nb = await changeBalance(id, amount);
  await ctx.reply(nb === null ? "Пользователь не найден" : `Готово ✅ Баланс: ${nb}`);
});
bot.command(["ban", "unban"], async (ctx) => {
  if (!ADMINS.has(ctx.from!.id)) return;
  const id = Number(ctx.match.trim());
  if (!id) return ctx.reply("Использование: /ban <id> или /unban <id>");
  if (ADMINS.has(id)) return ctx.reply("Админа блокировать нельзя");
  const { data } = await sb.from("users").update({ banned: ctx.msg.text!.startsWith("/ban") }).eq("user_id", id).select();
  await ctx.reply(data?.length ? "Готово ✅" : "Пользователь не найден");
});

bot.callbackQuery(/^adm:/, async (ctx) => {
  if (!ADMINS.has(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true });
  await sb.from("admin_pending").delete().eq("admin_id", ctx.from.id);
  const [, action, a, b, c] = ctx.callbackQuery.data!.split(":");
  let v: View, toast: string | undefined;
  if (action === "home") v = await adminHome();
  else if (action === "list") v = await adminList(+a);
  else if (action === "u") v = await adminCard(+a, +b);
  else if (action === "ban" || action === "unban") {
    if (ADMINS.has(+a)) return ctx.answerCallbackQuery({ text: "Админа блокировать нельзя", show_alert: true });
    await sb.from("users").update({ banned: action === "ban" }).eq("user_id", +a);
    v = await adminCard(+a, +b);
    toast = action === "ban" ? "Игрок заблокирован" : "Игрок разблокирован";
  } else if (action === "give") {
    const nb = await changeBalance(+a, +c);
    v = await adminCard(+a, +b);
    toast = nb === null ? "Игрок не найден" : `+${c} 💎. Баланс: ${nb}`;
  } else if (action === "custom") {
    await sb.from("admin_pending").upsert({ admin_id: ctx.from.id, target: +a, page: +b });
    v = {
      text: `Введи сумму числом для игрока ${a}.\nМинус — забрать (например -500).`,
      kb: new InlineKeyboard().text("❌ Отмена", `adm:u:${a}:${b}`),
    };
  } else return ctx.answerCallbackQuery();
  await show(ctx, v.text, v.kb);
  await ctx.answerCallbackQuery({ text: toast });
});

// ввод своей суммы (админ после кнопки «Другая сумма»)
bot.on("message:text", async (ctx) => {
  if (!ADMINS.has(ctx.from.id)) return;
  const { data: p } = await sb.from("admin_pending").select("*").eq("admin_id", ctx.from.id).maybeSingle();
  if (!p) return;
  const amount = Number(ctx.message.text.trim());
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1e9)
    return ctx.reply("Нужно целое число, например 500 или -500 (не 0 и не больше миллиарда).");
  await sb.from("admin_pending").delete().eq("admin_id", ctx.from.id);
  const nb = await changeBalance(p.target, amount);
  const v = await adminCard(p.target, p.page);
  await ctx.reply((nb !== null ? `Готово: ${amount > 0 ? "+" : ""}${amount} 💎\n\n` : "") + v.text, { reply_markup: v.kb });
});
