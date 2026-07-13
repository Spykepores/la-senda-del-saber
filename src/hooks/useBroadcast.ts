import { useEffect, useRef, useCallback } from "react";

export function useBroadcast(channelName: string, onMessage: (data: unknown) => void) {
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel(channelName);
    bcRef.current = bc;
    bc.onmessage = (ev) => onMessage(ev.data);
    return () => bc.close();
  }, [channelName, onMessage]);

  const send = useCallback((data: unknown) => {
    bcRef.current?.postMessage(data);
  }, []);

  return { send };
}
