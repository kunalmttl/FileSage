export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaRequest = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = (await request.json()) as Partial<OllamaRequest>;
  const model = body.model || "gemma3:1b";
  const messages = Array.isArray(body.messages) ? body.messages : [];

  console.info("[ask:ollama:chat] Start", {
    model,
    messages: messages.length,
    maxTokens: body.maxTokens,
    temperature: body.temperature,
  });

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: body.temperature ?? 0.1,
          num_predict: body.maxTokens ?? 512,
        },
      }),
      signal: request.signal,
      cache: "no-store",
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.warn("[ask:ollama:chat] Upstream failed", {
        status: response.status,
        ms: Date.now() - startedAt,
        errorText,
      });
      return Response.json(
        { message: errorText || `Ollama returned ${response.status}` },
        { status: 502 }
      );
    }

    let tokenCount = 0;
    const stream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(parseOllamaStream((delta) => {
        tokenCount += delta.length > 0 ? 1 : 0;
      }, () => {
        console.info("[ask:ollama:chat] Done", {
          model,
          tokenCount,
          ms: Date.now() - startedAt,
        });
      }))
      .pipeThrough(new TextEncoderStream());

    console.info("[ask:ollama:chat] Streaming");
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.warn("[ask:ollama:chat] Failed", {
      model,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { message: error instanceof Error ? error.message : "Ollama request failed." },
      { status: 502 }
    );
  }
}

function parseOllamaStream(
  onDelta: (delta: string) => void,
  onDone: () => void
): TransformStream<string, string> {
  let buffer = "";

  function emitLine(line: string, controller: TransformStreamDefaultController<string>): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as {
      message?: { content?: string };
      error?: string;
    };
    if (event.error) throw new Error(event.error);
    const delta = event.message?.content ?? "";
    if (delta) {
      onDelta(delta);
      controller.enqueue(delta);
    }
  }

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        try {
          emitLine(line, controller);
        } catch (error) {
          controller.error(error);
          return;
        }
      }
    },
    flush(controller) {
      try {
        emitLine(buffer, controller);
      } catch (error) {
        controller.error(error);
        return;
      }
      onDone();
    },
  });
}
