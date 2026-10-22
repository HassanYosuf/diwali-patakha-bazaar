import { allowedOrigin, clientIp, cors, ipHash } from "../_shared/http.ts";

export interface TrackDb {
  hit(key: string, windowS: number, max: number): Promise<boolean>;
  event(visit: string, campaign: string, kind: string, day: string): Promise<boolean>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENTS = 50, PER_MINUTE = 60;

type Ev = { c: string; t: "v" | "c" };
function parse(text: string): { visit: string; events: Ev[] } | null {
  let b: unknown;
  try { b = JSON.parse(text); } catch { return null; }
  if (!b || typeof b !== "object") return null;
  const { visit, events } = b as { visit?: unknown; events?: unknown };
  if (typeof visit !== "string" || visit.length < 8 || visit.length > 40 || !Array.isArray(events)) return null;
  for (const e of events) {
    if (!e || typeof e.c !== "string" || !UUID.test(e.c) || (e.t !== "v" && e.t !== "c")) return null;
  }
  return { visit, events: events as Ev[] };
}

// Views and clicks arrive as text/plain JSON (sendBeacon, no preflight). Capped requests get the same 204.
export async function handleTrack(req: Request, db: TrackDb, today: () => string): Promise<Response> {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(null, { status: 405, headers });
  if (!allowedOrigin(req.headers.get("origin"))) return new Response(null, { status: 403, headers });
  const body = parse(await req.text());
  if (!body) return new Response(null, { status: 400, headers });
  const events = body.events.slice(0, MAX_EVENTS);
  if (!(await db.hit("trk:" + (await ipHash(clientIp(req))), 60, PER_MINUTE))) return new Response(null, { status: 204, headers });
  const day = today();
  for (const e of events) await db.event(body.visit, e.c, e.t, day);
  return new Response(null, { status: 204, headers });
}
