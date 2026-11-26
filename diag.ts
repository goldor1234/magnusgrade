import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  const out: any = {
    time: new Date().toISOString(),
    env: {
      BOT_TOKEN: process.env.BOT_TOKEN ? "✅ set (" + process.env.BOT_TOKEN.length + " chars)" : "❌ MISSING",
      SUPABASE_URL: process.env.SUPABASE_URL || "❌ MISSING",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "✅ set (" + process.env.SUPABASE_SERVICE_ROLE_KEY.length + " chars)"
        : "❌ MISSING",
      WEBAPP_URL: process.env.WEBAPP_URL || "❌ MISSING",
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ? "✅ set" : "❌ MISSING",
      ADMIN_IDS: process.env.ADMIN_IDS || "❌ MISSING",
    },
    supabase: { url_ok: false, table_users: "?", error: null },
  };

  // проверим, что URL похож на правду
  const url = process.env.SUPABASE_URL || "";
  out.supabase.url_ok = /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url);
  out.supabase.url_trailing_slash = url.endsWith("/");

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json(out);
  }

  // пробуем реальный запрос к Supabase
  try {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    // 1. селект таблицы users
    const sel = await sb.from("users").select("*").limit(1);
    if (sel.error) {
      out.supabase.table_users = "❌ " + sel.error.message;
    } else {
      out.supabase.table_users = "✅ exists, rows returned: " + (sel.data?.length ?? 0);
    }

    // 2. пробуем insert тестового юзера (потом удалим)
    const testId = 888888888 + Math.floor(Math.random() * 1000);
    const ins = await sb.from("users").insert({ user_id: testId, username: "diag_test" }).select().single();
    if (ins.error) {
      out.supabase.insert = "❌ " + ins.error.message;
    } else {
      out.supabase.insert = "✅ ok, balance: " + ins.data?.balance;
      // удалим за собой
      await sb.from("users").delete().eq("user_id", testId);
      out.supabase.cleanup = "✅ test row deleted";
    }

    // 3. проверим RPC play_upgrade существует
    const rpc = await sb.rpc("admin_stats");
    if (rpc.error) {
      out.supabase.rpc_admin_stats = "❌ " + rpc.error.message;
    } else {
      out.supabase.rpc_admin_stats = "✅ ok: " + JSON.stringify(rpc.data);
    }
  } catch (e: any) {
    out.supabase.error = e?.message || String(e);
  }

  res.status(200).json(out);
}
