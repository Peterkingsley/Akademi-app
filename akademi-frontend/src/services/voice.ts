import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import api, { currentApiBaseUrl, refreshAccessToken } from "./api";
import { readAccessToken } from "./tokenStorage";

const AI_VOICE_ENABLED_KEY = "ai-voice-enabled";

type SpeechRecognitionResultEvent = {
  results?: string[];
  transcript?: string;
  isFinal?: boolean;
};

type SpeechRecognitionModuleLike = {
  requestPermissionsAsync?: () => Promise<{ granted: boolean }>;
  start: (options?: Record<string, unknown>) => void | Promise<void>;
  stop?: () => void | Promise<void>;
  abort?: () => void | Promise<void>;
  addListener: (
    eventName: string,
    listener: (event?: SpeechRecognitionResultEvent | { error?: string }) => void,
  ) => { remove: () => void };
};

let speechRecognitionBridgeCache:
  | {
      module: SpeechRecognitionModuleLike | null;
      isAvailable: boolean;
    }
  | null = null;
let activeAiSound: Audio.Sound | null = null;
let activeAiAudioUri: string | null = null;
let activeAiPlaybackResolver: (() => void) | null = null;

export const appendTranscript = (existing: string, transcript: string, multiline = false) => {
  const trimmed = transcript.trim();
  if (!trimmed) return existing;

  const current = existing.trim();
  if (!current) return trimmed;

  return multiline ? `${current}\n\n${trimmed}` : `${current} ${trimmed}`;
};

export const requestMicrophonePermission = async () => {
  const permission = await Audio.requestPermissionsAsync();
  return permission.granted;
};

export const prepareAudioRecording = async () => {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync({
    android: {
      extension: ".m4a",
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: ".m4a",
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {},
  });

  await recording.startAsync();
  return recording;
};

export const stopRecording = async (recording: Audio.Recording) => {
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  return recording.getURI();
};

export const transcribeAudioUri = async (uri: string, name = "voice-input.m4a") => {
  const formData = new FormData();
  formData.append("audio", {
    uri,
    name,
    type: "audio/mp4",
  } as any);

  const { data } = await api.post("/sessions/ingest/audio", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 90000,
  });

  return data?.transcript || "";
};

export const getAiVoiceEnabled = async () => {
  const stored = await AsyncStorage.getItem(AI_VOICE_ENABLED_KEY);
  if (stored === null) return true;
  return stored === "true";
};

export const setAiVoiceEnabled = async (enabled: boolean) => {
  await AsyncStorage.setItem(AI_VOICE_ENABLED_KEY, enabled ? "true" : "false");
};

export const stopAiSpeech = async () => {
  activeAiPlaybackResolver?.();
  activeAiPlaybackResolver = null;
  if (activeAiSound) {
    const sound = activeAiSound;
    activeAiSound = null;
    await sound.stopAsync().catch(() => undefined);
    await sound.unloadAsync().catch(() => undefined);
  }
  if (activeAiAudioUri) {
    const uri = activeAiAudioUri;
    activeAiAudioUri = null;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
};

const sanitizeSpeechText = (content: string) =>
  content
    .replace(/\\\[(.*?)\\\]/gs, "$1")
    .replace(/\\\((.*?)\\\)/gs, "$1")
    .replace(/\$\$(.*?)\$\$/gs, "$1")
    .replace(/\$(.*?)\$/gs, "$1")
    .replace(/[`*_#>-]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const getSpeechRecognitionBridge = () => {
  if (speechRecognitionBridgeCache) {
    return speechRecognitionBridgeCache;
  }

  try {
    const speech = require("expo-speech-recognition");
    const module =
      (speech?.ExpoSpeechRecognitionModule as SpeechRecognitionModuleLike | undefined) || null;
    const isAvailable =
      !!module &&
      (typeof speech?.isRecognitionAvailable === "function"
        ? Boolean(speech.isRecognitionAvailable())
        : true);

    speechRecognitionBridgeCache = {
      module,
      isAvailable,
    };
  } catch {
    speechRecognitionBridgeCache = {
      module: null,
      isAvailable: false,
    };
  }

  return speechRecognitionBridgeCache;
};

export const getLiveRecognitionAvailability = () => {
  return getSpeechRecognitionBridge().isAvailable;
};

export const requestLiveRecognitionPermission = async () => {
  const bridge = getSpeechRecognitionBridge();
  if (!bridge.module?.requestPermissionsAsync) return false;
  const result = await bridge.module.requestPermissionsAsync();
  return !!result.granted;
};

export const startLiveRecognition = async (options?: Record<string, unknown>) => {
  const bridge = getSpeechRecognitionBridge();
  if (!bridge.module) {
    throw new Error("Live voice recognition is unavailable in this build.");
  }
  await bridge.module.start({
    lang: "en-US",
    interimResults: true,
    continuous: true,
    maxAlternatives: 1,
    addsPunctuation: true,
    iosVoiceProcessingEnabled: true,
    ...options,
  });
};

export const stopLiveRecognition = async () => {
  const bridge = getSpeechRecognitionBridge();
  await bridge.module?.stop?.();
};

export const abortLiveRecognition = async () => {
  const bridge = getSpeechRecognitionBridge();
  await bridge.module?.abort?.();
};

export const addLiveRecognitionListener = (
  eventName: string,
  listener: (event?: SpeechRecognitionResultEvent | { error?: string }) => void,
) => {
  const bridge = getSpeechRecognitionBridge();
  if (!bridge.module) {
    return {
      remove: () => undefined,
    };
  }

  return bridge.module.addListener(eventName, listener);
};

export const estimateSpeechDurationMs = (content: string) => {
  const sanitized = sanitizeSpeechText(content);
  const wordCount = sanitized ? sanitized.split(/\s+/).length : 0;
  return Math.max(1400, Math.round(wordCount * 380));
};

export const sanitizeAiSpeechText = (content: string) => sanitizeSpeechText(content);

export const speakAiText = async (content: string) => {
  const sanitized = sanitizeSpeechText(content);
  if (!sanitized) return;

  await stopAiSpeech();

  try {
    const { data } = await api.post<{
      audioBase64: string;
      mimeType: string;
      provider: string;
    }>("/sessions/voice/tts", { text: sanitized }, { timeout: 90000 });

    if (!data?.audioBase64) {
      throw new Error("No AI voice audio was returned.");
    }

    const cacheRoot = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheRoot) {
      throw new Error("No writable cache directory is available for AI voice.");
    }

    const uri = `${cacheRoot}ai-tutor-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(uri, data.audioBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    activeAiAudioUri = uri;
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      {
        shouldPlay: true,
        volume: 1,
      },
    );
    activeAiSound = sound;

    await new Promise<void>((resolve) => {
      activeAiPlaybackResolver = resolve;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          resolve();
          return;
        }
        if (status.didJustFinish) {
          resolve();
        }
      });
    });
  } catch (error) {
    console.warn("tts_unavailable", { source: "speakAiText", error });
  } finally {
    activeAiPlaybackResolver = null;
    if (activeAiSound) {
      const sound = activeAiSound;
      activeAiSound = null;
      await sound.unloadAsync().catch(() => undefined);
    }
    if (activeAiAudioUri) {
      const uri = activeAiAudioUri;
      activeAiAudioUri = null;
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }
};

const getAccessToken = async () => {
  return readAccessToken();
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type FailureInfo = {
  status: number | null;
  reason?: string;
  limitScope?: string;
  resetSeconds?: number;
};

// The Audio.Sound request below hits the raw stream URL directly and never
// goes through axios, so a 429 (rate limited), 503 (backend/upstream busy),
// or 404 (stream record missing/expired on this replica) never gets the
// retry/refresh treatment axios calls get automatically. This does a
// lightweight status probe so we can react to those specific cases before
// giving up on streamed voice - the backend's re-read window (see
// elevenlabs-stream.service.ts) is what makes probing the same URL safe to
// do without breaking the real playback fetch.
const probeStreamAudioStatus = async (url: string, token: string): Promise<FailureInfo> => {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    let reason: string | undefined;
    let limitScope: string | undefined;

    if (!response.ok) {
      // Error responses are always small JSON bodies ({ message, reason,
      // limitScope? }) - safe to fully read.
      try {
        const body = await response.json();
        reason = body?.reason;
        limitScope = body?.limitScope;
      } catch {
        // status code alone still drives retry logic below
      }
    } else {
      try {
        await response.body?.cancel?.();
      } catch {
        // best effort only; not every RN fetch polyfill supports stream cancellation
      }
    }

    const resetHeader = response.headers.get("RateLimit-Reset") || response.headers.get("Retry-After");
    const resetSeconds = resetHeader ? Number(resetHeader) : undefined;

    return {
      status: response.status,
      reason,
      limitScope,
      resetSeconds: Number.isFinite(resetSeconds) ? resetSeconds : undefined,
    };
  } catch {
    return { status: null };
  }
};

// axios rejects with error.response for non-2xx, carrying the same JSON body
// and rate-limit headers the raw fetch probe above reads for Audio.Sound
// failures - unify both into the same shape so the retry loop doesn't need
// to know which path a failure came from.
const extractAxiosFailureInfo = (error: any): FailureInfo => {
  const response = error?.response;
  if (!response) return { status: null };
  const resetHeader = response.headers?.["ratelimit-reset"] || response.headers?.["retry-after"];
  const resetSeconds = resetHeader ? Number(resetHeader) : undefined;
  return {
    status: response.status ?? null,
    reason: response.data?.reason,
    limitScope: response.data?.limitScope,
    resetSeconds: Number.isFinite(resetSeconds) ? resetSeconds : undefined,
  };
};

// Retrying against a 15-minute rate-limit window with a few seconds of
// backoff is pointless - it only burns more requests from the same bucket.
// Only worth retrying when the limiter is about to reset anyway.
const RATE_LIMIT_RETRY_THRESHOLD_SECONDS = 10;

export type TtsResult = { ok: true } | { ok: false; reason: string; statusCode?: number };

// ElevenLabs is the only tutor voice - there is no device-voice fallback.
// A retry is worth one of these delays only when the previous failure looks
// transient (upstream busy, network blip); a stale/missing stream record
// (404/409) is retried immediately with a freshly minted stream instead.
const RETRY_BACKOFF_MS = [1000, 2000, 4000];

export const speakAiTextStream = async (sessionId: string, content: string): Promise<TtsResult> => {
  const sanitized = sanitizeSpeechText(content);
  if (!sanitized) return { ok: true };

  console.log("ai_message_received", {
    sessionId,
    contentLength: sanitized.length,
    timestamp: new Date().toISOString(),
  });

  await stopAiSpeech();

  const requestStream = async () => {
    const { data } = await api.post<{
      streamId: string;
      path: string;
      mimeType: string;
      provider: string;
    }>(`/sessions/${sessionId}/voice/stream`, { text: sanitized }, { timeout: 30000 });
    return data;
  };

  const playStream = async (streamUrl: string, token: string) => {
    let firstChunkLogged = false;
    let playbackStartedLogged = false;

    const { sound } = await Audio.Sound.createAsync(
      {
        uri: streamUrl,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      {
        shouldPlay: true,
        volume: 1,
      },
    );
    activeAiSound = sound;

    await new Promise<void>((resolve) => {
      activeAiPlaybackResolver = resolve;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if ((status as any).error) {
            console.warn("tts_stream_failed", (status as any).error);
          }
          resolve();
          return;
        }

        if (!firstChunkLogged && status.isPlaying) {
          firstChunkLogged = true;
          console.log("tts_first_audio_chunk", {
            sessionId,
            positionMillis: status.positionMillis,
          });
        }

        if (!playbackStartedLogged && status.isPlaying) {
          playbackStartedLogged = true;
          console.log("tts_playback_started", {
            sessionId,
            positionMillis: status.positionMillis,
          });
        }

        if (status.didJustFinish) {
          console.log("tts_playback_finished", {
            sessionId,
            durationMillis: status.durationMillis ?? null,
          });
          resolve();
        }
      });
    });
  };

  let lastReason = "unknown_error";
  let lastStatusCode: number | undefined;
  let lastStage: "create_stream" | "probe" | "playback" = "create_stream";
  let skipNextBackoff = false;
  // A 429 with a long reset window means the bucket won't clear within our
  // retry budget - burning the remaining attempts against it only makes the
  // next request's wait longer, so stop the loop immediately instead.
  let stopRetrying = false;
  const maxAttempts = RETRY_BACKOFF_MS.length + 1; // 1 initial attempt + 3 retries

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1 && !skipNextBackoff) {
        await sleep(RETRY_BACKOFF_MS[attempt - 2]);
      }
      skipNextBackoff = false;

      console.log("tts_ws_connect_start", {
        sessionId,
        attempt,
        timestamp: new Date().toISOString(),
      });

      let streamUrl: string;
      let token: string;
      try {
        const data = await requestStream();
        const freshToken = await getAccessToken();
        if (!data?.path || !freshToken) {
          throw new Error("Streaming voice setup failed.");
        }
        streamUrl = `${currentApiBaseUrl}${data.path}`;
        token = freshToken;
      } catch (error) {
        const failure = extractAxiosFailureInfo(error);
        lastStage = "create_stream";
        lastStatusCode = failure.status ?? undefined;

        if (failure.status === 429) {
          lastReason = failure.reason || "rate_limited";
          if (failure.resetSeconds !== undefined && failure.resetSeconds > RATE_LIMIT_RETRY_THRESHOLD_SECONDS) {
            stopRetrying = true;
          }
        } else {
          lastReason = "stream_setup_failed";
        }

        console.warn("tts_stream_retry", { sessionId, attempt, status: lastStatusCode, reason: lastReason, error });
        if (stopRetrying) break;
        continue;
      }

      try {
        await playStream(streamUrl, token);
        return { ok: true };
      } catch (playError) {
        const failure = await probeStreamAudioStatus(streamUrl, token);
        lastStatusCode = failure.status ?? undefined;
        lastStage = failure.status === null ? "probe" : "playback";

        if (failure.status === 401) {
          const refreshed = await refreshAccessToken().catch(() => null);
          if (refreshed?.accessToken) {
            try {
              await playStream(streamUrl, refreshed.accessToken);
              return { ok: true };
            } catch {
              lastReason = "auth_failed";
            }
          } else {
            lastReason = "auth_failed";
          }
        } else if (failure.status === 404) {
          lastReason = failure.reason || "stream_not_found";
          skipNextBackoff = true;
        } else if (failure.status === 409) {
          lastReason = failure.reason || "stream_consumed";
          skipNextBackoff = true;
        } else if (failure.status === 429) {
          lastReason = failure.reason || "rate_limited";
          if (failure.resetSeconds !== undefined && failure.resetSeconds > RATE_LIMIT_RETRY_THRESHOLD_SECONDS) {
            stopRetrying = true;
          }
        } else if (failure.status === 503) {
          lastReason = "upstream_unavailable";
        } else {
          lastReason = failure.status ? `http_${failure.status}` : "network_error";
        }

        console.warn("tts_stream_retry", {
          sessionId,
          attempt,
          status: lastStatusCode,
          reason: lastReason,
          error: playError,
        });
        if (stopRetrying) break;
      }
    }

    console.warn("tts_pipeline_failed", {
      sessionId,
      stage: lastStage,
      status: lastStatusCode,
      reason: lastReason,
    });
    return { ok: false, reason: lastReason, statusCode: lastStatusCode };
  } finally {
    activeAiPlaybackResolver = null;
    if (activeAiSound) {
      const sound = activeAiSound;
      activeAiSound = null;
      await sound.unloadAsync().catch(() => undefined);
    }
  }
};
