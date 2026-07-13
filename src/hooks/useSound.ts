import { useCallback, useRef } from "react";

export function useSound() {
  const sounds = useRef<Record<string, HTMLAudioElement>>({});

  const play = useCallback((name: string) => {
    try {
      if (!sounds.current[name]) {
        sounds.current[name] = new Audio(`/sounds/${name}.mp3`);
      }
      const audio = sounds.current[name];
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // Ignore audio errors
    }
  }, []);

  return { play };
}
