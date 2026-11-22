# Local Speech Recognition & Voice Commands (`@adaptui/speech-core`)

AdaptUI supports **100% local, privacy-preserving Whisper speech recognition** for natural-language browser control and form field dictation. Raw microphone audio never leaves your machine.

## Local Backends

Configure your backend in **Settings -> Voice & Speech**:

1. **Built-in ONNX Whisper (`onnx-local`, Default):**
   - Powered by `@huggingface/transformers` running quantized Whisper ONNX models directly inside the Electron main process.
   - Zero Python or `ffmpeg` setup required; models download once to `<userData>/whisper-models` and run completely offline thereafter.
2. **Python `faster-whisper` (`faster-whisper-python`):**
   - Uses a local Python installation (`pip install faster-whisper`) with `auto`, NVIDIA `cuda`, or `cpu` compute device selection — ideal for `whisper-large-v3-turbo` on GPU systems.
3. **Local Whisper HTTP Server (`whisper-http`):**
   - Connects to a locally running `whisper.cpp` server or OpenAI-compatible local `/v1/audio/transcriptions` server.
   - **Privacy boundary:** Strictly enforces loopback addresses (`localhost` / `127.0.0.1` / `::1`); non-local URLs are blocked.

## Selectable Whisper Models

- `whisper-tiny` (~75 MB, Multilingual) — fastest startup
- `whisper-base.en` (~110 MB, English-only) — snappy English commands
- `whisper-base` (~120 MB, Multilingual)
- `whisper-small.en` (~260 MB, English-only)
- `whisper-small` (~280 MB, Multilingual — Default) — balanced accuracy & speed
- `whisper-medium` (~780 MB, Multilingual) — higher accuracy for accented/dysarthric speech
- `whisper-large-v3-turbo` (~1.1 GB, Multilingual) — maximum accuracy

## Activation & Execution Modes

- **Activation Modes:**
  - `toggle`: Start/Stop button or global shortcut `Ctrl+Shift+V` with configurable silence auto-stop.
  - `push-to-talk`: Hold button (pointer, Space, or Enter) while speaking; release to transcribe.
  - `wake-word`: Continuous local listening that triggers only when your configurable wake phrase (default `"adaptui"` / `"hey adaptui"`) is heard.
  - `manual`: Manual start/stop dictation into the command box without automatic execution.
- **Execution Modes:**
  - `auto-execute`: Runs safe commands automatically; **consequential actions (payments, deletions, form submissions, etc.) always pause for explicit user confirmation**.
  - `review-before-run`: Populates the command box with the transcript so you can edit or verify before pressing **Run Command**.
- **Form Field Dictation:** Non-sensitive inputs display a **Dictate** button (disabled on password/payment fields).
