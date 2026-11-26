import { createClient } from "@supabase/supabase-js";

export const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export async function ensureUser(id: number, username: string | null) {
  const found = await sb.from("users").select("*").eq("user_id", id).maybeSingle();
  if (found.data) return { user: found.data, isNew: false };
  const ins = await sb.from("users").insert({ user_id: id, username }).select().single();
  if (ins.error) {
    const again = await sb.from("users").select("*").eq("user_id", id).single();
    return { user: again.data, isNew: false };
  }
  return { user: ins.data, isNew: true };
}

export async function changeBalance(uid: number, amount: number): Promise<number | null> {
  const { data, error } = await sb.rpc("change_balance", { p_user: uid, p_amount: amount });
  if (error) throw error;
  return data;
}
