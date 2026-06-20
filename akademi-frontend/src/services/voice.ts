import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import api from "./api";

const AI_VOICE_ENABLED_KEY = "ai-voice-enabled";

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

export const speakAiText = async (content: string) => {
  const sanitized = sanitizeSpeechText(content);
  if (!sanitized) return;

  await Speech.stop();
  Speech.speak(sanitized, {
    rate: 0.95,
    pitch: 1,
    language: "en",
  });
};
