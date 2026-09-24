"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost, btnPrimary } from "@/components/activities/shared";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Un <audio> solo puede pasar por `createMediaElementSource` UNA vez en toda su vida — llamarlo
// de nuevo lanza "already connected to a different MediaElementSourceNode", incluso si el
// primer AudioContext ya se cerró. React reutiliza el mismo elemento real al remontar en modo
// estricto (dev) y al cambiar de `src` en producción (misma posición en el árbol = mismo nodo
// DOM), así que el grafo se arma una sola vez por elemento y se cachea aquí — nunca se recrea.
const wiredElements = new WeakMap<HTMLAudioElement, { ctx: AudioContext; analyser: AnalyserNode }>();

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds)) return "0:00";
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Reproductor con velocidad, avance/retroceso de 10s y espectro de frecuencias en vivo (Web
// Audio API: AnalyserNode leído a barras en un canvas mientras suena). El elemento <audio> se
// conecta una sola vez al grafo de Web Audio — reconectar en cada render lanzaría
// "already connected" — y ese grafo pasa a ser el único camino hacia los parlantes, por eso el
// analizador se re-conecta a `ctx.destination` (si no, el audio se enruta al grafo pero nunca
// suena).
export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let entry = wiredElements.get(audio);
    if (!entry) {
      const AudioCtxClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      entry = { ctx, analyser };
      wiredElements.set(audio, entry);
    }
    audioCtxRef.current = entry.ctx;
    analyserRef.current = entry.analyser;
  }, []);

  function drawSpectrum() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (!analyser || !canvas || !ctx2d) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    const barCount = 48;
    const step = Math.floor(data.length / barCount);
    const barWidth = canvas.width / barCount;
    for (let i = 0; i < barCount; i++) {
      const value = data[i * step] / 255;
      const barHeight = Math.max(2, value * canvas.height);
      ctx2d.fillStyle = `rgba(128, 198, 18, ${0.4 + value * 0.6})`;
      ctx2d.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 2, barHeight);
    }
    rafRef.current = requestAnimationFrame(drawSpectrum);
  }

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(drawSpectrum);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioCtxRef.current?.state === "suspended") await audioCtxRef.current.resume();
    if (playing) {
      audio.pause();
    } else {
      await audio.play();
    }
  }

  function skip(deltaSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + deltaSeconds), duration || audio.duration || Infinity);
  }

  function changeSpeed(next: number) {
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function seekTo(fraction: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = fraction * duration;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <audio
        ref={audioRef}
        src={src}
        crossOrigin="anonymous"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <canvas ref={canvasRef} width={600} height={56} className="h-14 w-full rounded-md bg-black/5" />
      <div
        className="mt-2 h-1.5 w-full cursor-pointer rounded-full bg-black/10"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekTo((e.clientX - rect.left) / rect.width);
        }}
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button className={btnGhost} title="Retroceder 10s" onClick={() => skip(-10)}>
            ⏪ 10s
          </button>
          <button className={btnPrimary} title={playing ? "Pausar" : "Reproducir"} onClick={togglePlay}>
            {playing ? "⏸ Pausar" : "▶ Reproducir"}
          </button>
          <button className={btnGhost} title="Adelantar 10s" onClick={() => skip(10)}>
            10s ⏩
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted tabular-nums">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          <select
            className="rounded-md border border-border bg-transparent px-2 py-1 text-xs font-semibold"
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            title="Velocidad de reproducción"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
