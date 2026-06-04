export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export async function GET() {
  const startedAt = Date.now();
  console.info("[ask:ollama:status] Checking Ollama at", OLLAMA_BASE_URL);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    const text = await response.text();
    console.info("[ask:ollama:status] Complete", {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - startedAt,
    });

    return Response.json(
      {
        ok: response.ok,
        status: response.status,
        models: parseOllamaModels(text),
      },
      { status: response.ok ? 200 : 502 }
    );
  } catch (error) {
    console.warn("[ask:ollama:status] Failed", {
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        ok: false,
        status: 0,
        models: [],
        message: "Ollama is not reachable on localhost:11434.",
      },
      { status: 503 }
    );
  }
}

function parseOllamaModels(text: string): string[] {
  try {
    const data = JSON.parse(text) as { models?: Array<{ name?: string; model?: string }> };
    return (data.models ?? [])
      .map((model) => model.name ?? model.model ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}
