import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import api from "./api";

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
  await Speech.stop();
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

  await Speech.stop();
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    Speech.speak(sanitized, {
      rate: 0.95,
      pitch: 1,
      language: "en",
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  });
};
