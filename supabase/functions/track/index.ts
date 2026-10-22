import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { handleTrack } from "./handler.ts";
import { todayIST } from "../_shared/http.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const db = {
  async hit(key: string, windowS: number, max: number) {
    const { data, error } = await sb.rpc("rate_hit", { p_key: key, p_window_s: windowS, p_max: max });
    if (error) throw error;
    return data === true;
  },
  async event(visit: string, campaign: string, kind: string, day: string) {
    const { data, error } = await sb.rpc("track_event", { p_visit: visit, p_campaign: campaign, p_kind: kind, p_day: day });
    if (error) throw error;
    return data === true;
  },
};

Deno.serve(async (req) => {
  try {
    return await handleTrack(req, db, () => todayIST());
  } catch (e) {
    console.error(e);
    return new Response(null, { status: 500 });
  }
});
