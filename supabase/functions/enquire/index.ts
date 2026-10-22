import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { handleEnquire } from "./handler.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const db = {
  async hit(key: string, windowS: number, max: number) {
    const { data, error } = await sb.rpc("rate_hit", { p_key: key, p_window_s: windowS, p_max: max });
    if (error) throw error;
    return data === true;
  },
  async insert(row: { name: string; brand: string; contact: string; interest: string; message: string }) {
    const { error } = await sb.from("enquiries").insert(row);
    if (error) throw error;
  },
};

Deno.serve(async (req) => {
  try {
    return await handleEnquire(req, db);
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: "server" }, { status: 500 });
  }
});
