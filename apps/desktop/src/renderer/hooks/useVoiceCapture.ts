import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceSettings, VoiceTranscriptionResult } from "@adaptui/shared-types";

export function resampleFloat32(
  input: Float32Array,
  fromRate: number,
  toRate = 16000
): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const low = Math.floor(srcIdx);
    const high = Math.min(input.length - 1, low + 1);
    const frac = srcIdx - low;
    out[i] = (input[low] ?? 0) * (1 - frac) + (input[high] ?? 0) * frac;
  }
  return out;
}

function concatChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

export type VoiceCaptureState = "idle" | "listening" | "wake-listening" | "transcribing";

export interface UseVoiceCaptureOptions {
  settings: VoiceSettings;
  onResult: (result: VoiceTranscriptionResult, purpose: "command" | "dictation" | "wake-check") => void;
  onError: (message: string) => void;
}

export function useVoiceCapture({ settings, onResult, onError }: UseVoiceCaptureOptions) {
  const [captureState, setCaptureState] = useState<VoiceCaptureState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const speechDetectedRef = useRef(false);
  const lastVoiceTimeRef = useRef(0);
  const startedAtRef = useRef(0);
  const activePurposeRef = useRef<"command" | "dictation" | "wake-check">("command");
  const wakeModeActiveRef = useRef(false);
  const transcribingRef = useRef(false);
  const customCallbackRef = useRef<((res: VoiceTranscriptionResult) => void) | null>(null);

  const cleanupAudioGraph = useCallback(() => {
    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const flushAndTranscribe = useCallback(
    async (keepWakeListening: boolean) => {
      if (transcribingRef.current) return;
      const sampleRate = ctxRef.current?.sampleRate || 48000;
      const rawChunks = chunksRef.current;
      chunksRef.current = [];
      speechDetectedRef.current = false;

      if (!keepWakeListening) {
        cleanupAudioGraph();
      }

      const merged = concatChunks(rawChunks);
      if (merged.length === 0) {
        setCaptureState(keepWakeListening ? "wake-listening" : "idle");
        return;
      }

      const pcm16k = resampleFloat32(merged, sampleRate, 16000);
      transcribingRef.current = true;
      setCaptureState("transcribing");

      try {
        const purpose = activePurposeRef.current;
        const result = await window.adaptui.transcribeAudio({
          pcm16k: Array.from(pcm16k),
          sampleRate: 16000,
          purpose,
        });

        if (result.error) {
          onError(result.error);
        } else if (customCallbackRef.current) {
          const cb = customCallbackRef.current;
          customCallbackRef.current = null;
          cb(result);
        } else {
          onResult(result, purpose);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        transcribingRef.current = false;
        setCaptureState(keepWakeListening && wakeModeActiveRef.current ? "wake-listening" : "idle");
      }
    },
    [cleanupAudioGraph, onError, onResult]
  );

  const stopListening = useCallback(
    async (cancel = false) => {
      wakeModeActiveRef.current = false;
      if (cancel) {
        chunksRef.current = [];
        customCallbackRef.current = null;
        cleanupAudioGraph();
        setCaptureState("idle");
        return;
      }
      await flushAndTranscribe(false);
    },
    [cleanupAudioGraph, flushAndTranscribe]
  );

  const startListening = useCallback(
    async (options?: {
      purpose?: "command" | "dictation" | "wake-check";
      wakeContinuous?: boolean;
      onCustomResult?: (res: VoiceTranscriptionResult) => void;
    }) => {
      if (!settings.enabled) {
        onError("Voice recognition is disabled. Enable it in Settings -> Voice & Speech.");
        return;
      }
      if (captureState !== "idle") {
        await stopListening(false);
        return;
      }

      const purpose = options?.purpose ?? (options?.wakeContinuous ? "wake-check" : "command");
      activePurposeRef.current = purpose;
      wakeModeActiveRef.current = Boolean(options?.wakeContinuous);
      customCallbackRef.current = options?.onCustomResult ?? null;
      chunksRef.current = [];
      speechDetectedRef.current = false;
      startedAtRef.current = Date.now();
      lastVoiceTimeRef.current = Date.now();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AudioCtx();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        ctxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        const muteGain = ctx.createGain();
        muteGain.gain.value = 0;
        processorRef.current = processor;

        const autoStopOnSilence =
          !options?.wakeContinuous &&
          (settings.activationMode === "toggle" || purpose === "dictation");

        processor.onaudioprocess = (evt) => {
          if (transcribingRef.current) return;
          const inputData = evt.inputBuffer.getChannelData(0);
          const copy = new Float32Array(inputData.length);
          copy.set(inputData);

          let sumSq = 0;
          for (let i = 0; i < copy.length; i++) {
            const s = copy[i] ?? 0;
            sumSq += s * s;
          }
          const rms = Math.sqrt(sumSq / copy.length);
          setAudioLevel(Math.min(1, rms * 8));

          const now = Date.now();
          if (rms >= settings.silenceThreshold) {
            speechDetectedRef.current = true;
            lastVoiceTimeRef.current = now;
          }

          if (speechDetectedRef.current || !options?.wakeContinuous) {
            chunksRef.current.push(copy);
          }

          // Cap single utterance at 20 seconds to keep local Whisper responsive
          const elapsed = now - startedAtRef.current;
          if (elapsed > 20_000 && !options?.wakeContinuous) {
            void flushAndTranscribe(false);
            return;
          }

          // Auto-stop on silence once speech was detected
          if (
            autoStopOnSilence &&
            speechDetectedRef.current &&
            now - lastVoiceTimeRef.current >= settings.silenceStopMs
          ) {
            void flushAndTranscribe(false);
            return;
          }

          // In wake-word continuous mode, transcribe each completed speech utterance
          if (
            options?.wakeContinuous &&
            wakeModeActiveRef.current &&
            speechDetectedRef.current &&
            now - lastVoiceTimeRef.current >= Math.min(1400, settings.silenceStopMs)
          ) {
            void flushAndTranscribe(true);
          }
        };

        source.connect(processor);
        processor.connect(muteGain);
        muteGain.connect(ctx.destination);

        setCaptureState(options?.wakeContinuous ? "wake-listening" : "listening");
      } catch (err) {
        cleanupAudioGraph();
        setCaptureState("idle");
        onError(
          `Microphone access unavailable: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    [captureState, cleanupAudioGraph, flushAndTranscribe, onError, settings, stopListening]
  );

  useEffect(() => {
    return () => {
      wakeModeActiveRef.current = false;
      cleanupAudioGraph();
    };
  }, [cleanupAudioGraph]);

  return {
    captureState,
    audioLevel,
    startListening,
    stopListening,
  };
}
