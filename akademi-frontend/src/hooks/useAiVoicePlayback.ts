import { useEffect, useState } from "react";
import { getAiVoiceEnabled, setAiVoiceEnabled as persistAiVoiceEnabled, speakAiText, stopAiSpeech } from "../services/voice";

export const useAiVoicePlayback = () => {
  const [aiVoiceEnabled, setAiVoiceEnabledState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    getAiVoiceEnabled()
      .then((enabled) => {
        if (!mounted) return;
        setAiVoiceEnabledState(enabled);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAiVoiceEnabledState(true);
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setAiVoiceEnabled = async (enabled: boolean) => {
    setAiVoiceEnabledState(enabled);
    await persistAiVoiceEnabled(enabled);
    if (!enabled) {
      await stopAiSpeech();
    }
  };

  const toggleAiVoice = async () => {
    await setAiVoiceEnabled(!aiVoiceEnabled);
  };

  const speakIfEnabled = async (content: string) => {
    if (!ready || !aiVoiceEnabled) return;
    await speakAiText(content);
  };

  return {
    aiVoiceEnabled,
    ready,
    setAiVoiceEnabled,
    toggleAiVoice,
    speakIfEnabled,
    stopAiSpeech,
  };
};
