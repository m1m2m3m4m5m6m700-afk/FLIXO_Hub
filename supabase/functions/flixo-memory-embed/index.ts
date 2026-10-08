import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODEL = "gte-small";
const DIMENSIONS = 384;

function decodeRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function configuredSecretKeys(): Set<string> {
  const keys = new Set<string>();
  const plural = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
  try {
    const parsed = JSON.parse(plural) as Record<string, unknown>;
    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.startsWith("sb_secret_")) keys.add(value);
    }
  } catch {
    // Legacy/local environments may not expose the plural JSON variable.
  }
  const single = Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
  if (single.startsWith("sb_secret_")) keys.add(single);
  return keys;
}

function authorized(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ") && decodeRole(authorization.slice(7)) === "service_role") {
    return true;
  }

  const apiKey = request.headers.get("apikey") ?? "";
  if (apiKey.startsWith("sb_secret_")) {
    return configuredSecretKeys().has(apiKey);
  }

  return false;
}

const model = new Supabase.ai.Session(MODEL);

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  if (!authorized(request)) return Response.json({ error: "SERVICE_ROLE_REQUIRED" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const value = (payload as { text?: unknown })?.text;
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < 10 || text.length > 12000) {
    return Response.json({ error: "TEXT_LENGTH_INVALID" }, { status: 400 });
  }

  const embedding = await model.run(text, { mean_pool: true, normalize: true });
  const values = Array.from(embedding as Iterable<number>);
  if (values.length !== DIMENSIONS || values.some((item) => !Number.isFinite(item))) {
    return Response.json({ error: "EMBEDDING_SHAPE_INVALID" }, { status: 500 });
  }

  return Response.json({ model: MODEL, dimensions: DIMENSIONS, embedding: values });
});
