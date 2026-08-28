import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { type AudioRecorder, useAudioRecorder } from "expo-audio";
import {
  akademiRecordingOptions,
  prepareAudioRecording,
  requestMicrophonePermission,
  stopRecording,
  transcribeAudioUri,
} from "../services/voice";

interface UseVoiceComposerOptions {
  onTranscript: (transcript: string) => void;
  recordingName?: string;
  permissionMessage?: string;
  startErrorTitle?: string;
  stopErrorTitle?: string;
}

export const useVoiceComposer = ({
  onTranscript,
  recordingName = "voice-input.m4a",
  permissionMessage = "Allow microphone access so Akademi can capture your voice.",
  startErrorTitle = "Could not start recording",
  stopErrorTitle = "Voice input failed",
}: UseVoiceComposerOptions) => {
  const recorder = useAudioRecorder(akademiRecordingOptions);
  const [recording, setRecording] = useState<AudioRecorder | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stop().catch(() => undefined);
      }
    };
  }, [recording]);

  const toggleRecording = async () => {
    if (isTranscribing) return;

    if (recording) {
      setIsTranscribing(true);
      try {
        const activeRecording = recording;
        setRecording(null);
        const uri = await stopRecording(activeRecording);

        if (!uri) {
          throw new Error("Recording could not be saved.");
        }

        const transcript = await transcribeAudioUri(uri, recordingName);
        onTranscript(transcript);
      } catch (error: any) {
        Alert.alert(stopErrorTitle, error?.response?.data?.message || error?.message || "Please try again.");
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    try {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        Alert.alert("Microphone needed", permissionMessage);
        return;
      }

      const nextRecording = await prepareAudioRecording(recorder);
      setRecording(nextRecording);
    } catch (error: any) {
      Alert.alert(startErrorTitle, error?.message || "Please check microphone access and try again.");
    }
  };

  return {
    isRecording: Boolean(recording),
    isTranscribing,
    toggleRecording,
  };
};
