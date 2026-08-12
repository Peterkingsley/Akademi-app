import { useEffect, useState } from "react";
import { getAiVoiceEnabled, setAiVoiceEnabled as persistAiVoiceEnabled, speakAiText, stopAiSpeech } from "../services/voice";

type AiVoicePlaybackOptions = {
  initialEnabled?: boolean;
  persistPreference?: boolean;
};

export const useAiVoicePlayback = ({ initialEnabled = true, persistPreference = true }: AiVoicePlaybackOptions = {}) => {
  const [aiVoiceEnabled, setAiVoiceEnabledState] = useState(initialEnabled);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!persistPreference) {
      setAiVoiceEnabledState(initialEnabled);
      setReady(true);
      return () => { mounted = false; };
    }

    getAiVoiceEnabled()
      .then((enabled) => {
        if (!mounted) return;
        setAiVoiceEnabledState(enabled);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAiVoiceEnabledState(initialEnabled);
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [initialEnabled, persistPreference]);

  const setAiVoiceEnabled = async (enabled: boolean) => {
    setAiVoiceEnabledState(enabled);
    if (persistPreference) await persistAiVoiceEnabled(enabled);
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
