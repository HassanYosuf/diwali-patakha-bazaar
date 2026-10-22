import { allowedOrigin, clientIp, cors, ipHash } from "../_shared/http.ts";

export interface EnquireDb {
  hit(key: string, windowS: number, max: number): Promise<boolean>;
  insert(row: { name: string; brand: string; contact: string; interest: string; message: string }): Promise<void>;
}

const INTERESTS = ["hoarding", "premium_stall", "basic_stall", "not_sure"];
// field, min, max (after trimming)
const TEXT: [string, number, number][] = [["name", 1, 80], ["brand", 1, 80], ["contact", 3, 120], ["message", 0, 1000]];

// "Advertise with us" form. A filled decoy field gets a normal-looking success and is dropped.
export async function handleEnquire(req: Request, db: EnquireDb): Promise<Response> {
  const headers = cors(req);
  const reply = (status: number, body?: unknown) =>
    body === undefined ? new Response(null, { status, headers }) : Response.json(body, { status, headers });
  if (req.method === "OPTIONS") return reply(204);
  if (req.method !== "POST") return reply(405);
  if (!allowedOrigin(req.headers.get("origin"))) return reply(403);
  let b: Record<string, unknown>;
  try {
    b = await req.json();
    if (!b || typeof b !== "object") throw 0;
  } catch {
    return reply(400, { ok: false, error: "body" });
  }
  const row: Record<string, string> = {};
  for (const [k, min, max] of TEXT) {
    const v = b[k] ?? (min === 0 ? "" : undefined);
    if (typeof v !== "string") return reply(400, { ok: false, error: k });
    const t = v.trim();
    if (t.length < min || t.length > max) return reply(400, { ok: false, error: k });
    row[k] = t;
  }
  if (!INTERESTS.includes(b.interest as string)) return reply(400, { ok: false, error: "interest" });
  row.interest = b.interest as string;
  if (typeof b.website === "string" && b.website.trim()) return reply(200, { ok: true });
  if (!(await db.hit("enq:" + (await ipHash(clientIp(req))), 3600, 3))) return reply(429, { ok: false, error: "rate" });
  await db.insert({ name: row.name, brand: row.brand, contact: row.contact, interest: row.interest, message: row.message });
  return reply(200, { ok: true });
}
