# AI Provider Configuration Guide (`@adaptui/ai-core` & `@adaptui/ai-providers`)

AdaptUI uses a provider-neutral AI orchestration layer (`HybridAIRouter`) so local models, cloud models, and deterministic offline fallbacks can be swapped without modifying semantic modeling, UI reconstruction, or command execution.

## Routing Modes

1. **`local-only` (Default)**
   - Uses only your local inference endpoint (e.g., Ollama) and deterministic fallback.
   - Structurally guarantees zero website data is sent to remote APIs.
2. **`cloud-only`**
   - Uses your configured cloud adapter (requires `allowRemotePageContent: true` in Privacy Settings to transmit sanitized page metadata).
3. **`hybrid`**
   - Routes tasks based on `hybridPolicy.preferLocalForAnalysis`, `preferLocalForCommands`, and `allowCloudFallback`, always respecting privacy flags.

## Local Inference (Ollama-Compatible)

- **Default endpoint:** `http://127.0.0.1:11434`
- **API endpoints used:** `GET /api/tags` (health check & local model discovery) and `POST /api/chat` (`format: "json"`, `stream: false`).
- **Setup:** Install [Ollama](https://ollama.com/), pull a JSON-capable model (e.g., `ollama pull llama3.2`), open AdaptUI -> **AI & Privacy** -> click **Check Provider Health** to verify connectivity and discovered models.
- **Capability Validation:** Models lacking structured JSON capability are skipped safely rather than producing unvalidated output.

## Cloud Providers

Open **AI & Privacy** -> enable **Cloud Provider Adapter** -> select:
- **OpenAI-Compatible** (`https://api.openai.com/v1`, e.g., `gpt-4o-mini`, or any OpenAI-compatible gateway)
- **Anthropic** (`https://api.anthropic.com`, e.g., `claude-3-5-haiku-latest`)
- **Google Gemini** (`https://generativelanguage.googleapis.com`, e.g., `gemini-2.0-flash`)

API keys are encrypted via the operating system's credential store (`Electron safeStorage`) and are never exposed to website JavaScript or logs.

## Reliability Controls

- Zod schema validation on every structured response
- Configurable per-provider timeouts (`AbortController`) and cancellation
- Bounded retry count (`maxRetries`, capped at 3)
- Context length cap (`maxContextChars`)
- Automatic PII/key redaction in local AI invocation logs
- Deterministic fallback when no live LLM is configured or when a model fails
