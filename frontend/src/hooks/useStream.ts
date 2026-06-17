"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { useApi } from "@/hooks/useApi";

interface StreamState {
  status: "idle" | "connecting" | "active" | "error";
  error?: string;
}

export function useStream(cameraId: string, enabled: boolean) {
  const api = useApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const [state, setState] = useState<StreamState>({ status: "idle" });

  const stop = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (streamIdRef.current) {
      const sid = streamIdRef.current;
      streamIdRef.current = null;
      api("/api/monitoring/stream/stop/", {
        method: "POST",
        body: JSON.stringify({ stream_id: sid }),
      }).catch(() => {});
    }
    setState({ status: "idle" });
  }, [api]);

  useEffect(() => {
    if (!enabled || !cameraId) return;

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

        if (!videoRef.current) return;

        const fullUrl = hls_url.startsWith("http")
          ? hls_url
          : `${process.env.NEXT_PUBLIC_API_URL}${hls_url}`;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: false,
            manifestLoadingMaxRetry: 15,
            manifestLoadingRetryDelay: 2000,
            levelLoadingMaxRetry: 15,
            levelLoadingRetryDelay: 2000,
            fragLoadingMaxRetry: 15,
            fragLoadingRetryDelay: 2000,
            maxBufferLength: 10,
          });
          hlsRef.current = hls;

          hls.loadSource(fullUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoRef.current?.play().catch(() => {});
            setState({ status: "active" });
          });

          hls.on(Hls.Events.ERROR, (_event, err) => {
            if (err.fatal) {
              setState({ status: "error", error: "Stream failed to load" });
            }
          });
        } else if (
          videoRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          videoRef.current.src = fullUrl;
          videoRef.current.addEventListener("loadedmetadata", () =>
            setState({ status: "active" })
          );
          videoRef.current.addEventListener("error", () =>
            setState({ status: "error", error: "Stream failed to load" })
          );
          setState({ status: "active" });
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
      });

    return stop;
  }, [cameraId, enabled]);

  return { videoRef, state, stop };
}
