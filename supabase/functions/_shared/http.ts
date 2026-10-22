// Shared by track and enquire: origin checks, client IP, IP hashing and India's date.

// ALLOWED_ORIGINS is comma-separated; "http://localhost:*" allows any port on that host
export function allowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean).some((p) =>
    p.endsWith(":*") ? new RegExp("^" + p.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(:\\d+)?$").test(origin) : p === origin
  );
}

export function cors(req: Request): Headers {
  const h = new Headers({ "vary": "origin" });
  const origin = req.headers.get("origin");
  if (allowedOrigin(origin)) {
    h.set("access-control-allow-origin", origin!);
    h.set("access-control-allow-methods", "POST, OPTIONS");
    h.set("access-control-allow-headers", "content-type");
    h.set("access-control-max-age", "86400");
  }
  return h;
}

// Prefer headers the edge proxy sets itself; the first X-Forwarded-For entry can be written by the client.
export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? (h.get("x-forwarded-for") ?? "").split(",")[0]).trim() || "unknown";
}

export async function ipHash(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + (Deno.env.get("IP_SALT") ?? ""));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}
