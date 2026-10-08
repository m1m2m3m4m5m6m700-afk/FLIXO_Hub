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

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && decodeRole(header.slice(7)) === "service_role";
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
