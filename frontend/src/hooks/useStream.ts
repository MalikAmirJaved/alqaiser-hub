"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { useApi } from "@/hooks/useApi";

interface StreamState {
  status: "idle" | "connecting" | "active" | "error";
  error?: string;
}

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useStream(cameraId: string, enabled: boolean) {
  const api = useApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startStreamRef = useRef<(() => void) | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<StreamState>({ status: "idle" });

  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (streamIdRef.current) {
      const sid = streamIdRef.current;
      streamIdRef.current = null;
      api("/api/monitoring/stream/stop/", {
        method: "POST",
        body: JSON.stringify({ stream_id: sid }),
      }).catch(() => {});
    }
  }, [api]);

  const stop = useCallback(() => {
    cleanupHls();
    stopStream();
    setState({ status: "idle" });
    reconnectAttemptRef.current = 0;
  }, [cleanupHls, stopStream]);

  const startStream = useCallback(() => {
    if (!cameraId || !enabled) return;

    setState({ status: "connecting" });

    api("/api/monitoring/stream/start/", {
      method: "POST",
      body: JSON.stringify({ camera_id: cameraId }),
    })
      .then((data: unknown) => {
        const { stream_id, hls_url } = data as {
          stream_id: string;
          hls_url: string;
        };
        streamIdRef.current = stream_id;
        reconnectAttemptRef.current = 0; // Reset on success

        if (!videoRef.current) return;

        const fullUrl = hls_url.startsWith("http")
          ? hls_url
          : `${process.env.NEXT_PUBLIC_API_URL}${hls_url}`;

        if (Hls.isSupported()) {
          cleanupHls();

          const hls = new Hls({
            enableWorker: true,
            // Live streaming optimizations
            lowLatencyMode: true,
            backBufferLength: 4,
            maxBufferLength: 6,
            maxMaxBufferLength: 12,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
            manifestLoadingMaxRetry: 20,
            manifestLoadingRetryDelay: 1000,
            levelLoadingMaxRetry: 20,
            levelLoadingRetryDelay: 1000,
            fragLoadingMaxRetry: 20,
            fragLoadingRetryDelay: 1000,
          });
          hlsRef.current = hls;

          hls.loadSource(fullUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoRef.current?.play().catch(() => {});
          });

          hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
            // Mark active once we have loaded at least one level (playlist)
            if (data.details.live) {
              setState({ status: "active" });
            }
          });

          hls.on(Hls.Events.ERROR, (_event, err) => {
            if (err.fatal) {
              hls.destroy();
              hlsRef.current = null;
              setState({ status: "error", error: "Stream failed to load" });
              // Attempt reconnection
              attemptReconnect();
            }
          });
        } else if (
          videoRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          videoRef.current.src = fullUrl;
          videoRef.current.addEventListener("loadedmetadata", () =>
            setState({ status: "active" })
          );
          videoRef.current.addEventListener("error", () => {
            setState({ status: "error", error: "Stream failed to load" });
            attemptReconnect();
          });
        } else {
          setState({
            status: "error",
            error: "HLS not supported in this browser",
          });
        }
      })
      .catch((err: Error) => {
        setState({
          status: "error",
          error: err.message || "Unable to start stream",
        });
        attemptReconnect();
      });
  }, [cameraId, enabled, api, cleanupHls]);

  // Store startStream in ref so attemptReconnect can call it without circular deps
  startStreamRef.current = startStream;

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) return;
    if (reconnectTimerRef.current) return; // Already scheduled

    reconnectAttemptRef.current += 1;
    const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttemptRef.current, 5);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      // Clean up old stream before reconnecting
      stopStream();
      startStreamRef.current?.();
    }, delay);
  }, [stopStream]);

  useEffect(() => {
    if (!enabled || !cameraId) {
      stop();
      return;
    }

    startStream();

    return () => {
      stop();
    };
  }, [cameraId, enabled, startStream, stop]);

  // Clean up reconnect timer on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []);

  return { videoRef, state, stop };
}
