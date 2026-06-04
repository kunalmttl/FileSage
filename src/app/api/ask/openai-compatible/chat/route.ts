export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAICompatibleRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = (await request.json()) as Partial<OpenAICompatibleRequest>;
  const baseUrl = normalizeBaseUrl(body.baseUrl ?? "");
  const model = body.model ?? "";
  const messages = Array.isArray(body.messages) ? body.messages : [];

  console.info("[ask:openai-compatible:chat] Start", {
    baseUrl,
    model,
    messages: messages.length,
    hasApiKey: Boolean(body.apiKey),
  });

  if (!baseUrl || !body.apiKey || !model) {
    return Response.json(
      { message: "OpenAI-compatible provider requires base URL, API key, and model." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${body.apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FileSage",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: body.temperature ?? 0.1,
        max_tokens: body.maxTokens ?? 512,
      }),
      signal: request.signal,
      cache: "no-store",
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.warn("[ask:openai-compatible:chat] Upstream failed", {
        status: response.status,
        ms: Date.now() - startedAt,
        errorText,
      });
      return Response.json(
        { message: errorText || `Provider returned ${response.status}` },
        { status: 502 }
      );
    }

    let tokenCount = 0;
    const stream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(parseSseStream((delta) => {
        tokenCount += delta.length > 0 ? 1 : 0;
      }, () => {
        console.info("[ask:openai-compatible:chat] Done", {
          model,
          tokenCount,
          ms: Date.now() - startedAt,
        });
      }))
      .pipeThrough(new TextEncoderStream());

    console.info("[ask:openai-compatible:chat] Streaming");
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.warn("[ask:openai-compatible:chat] Failed", {
      baseUrl,
      model,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { message: error instanceof Error ? error.message : "Provider request failed." },
      { status: 502 }
    );
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
}

function parseSseStream(
  onDelta: (delta: string) => void,
  onDone: () => void
): TransformStream<string, string> {
  let buffer = "";

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const line of event.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string | null } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              onDelta(delta);
              controller.enqueue(delta);
            }
          } catch (error) {
            controller.error(error);
            return;
          }
        }
      }
    },
    flush() {
      onDone();
    },
  });
}
