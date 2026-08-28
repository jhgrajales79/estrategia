"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SessionRow } from "@/lib/types";
import { btnGhost, btnPrimary } from "./activities/shared";

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const startedAt = ctx.currentTime;
    [0, 0.35, 0.7].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, startedAt + delay);
      gain.gain.exponentialRampToValueAtTime(0.3, startedAt + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + delay + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startedAt + delay);
      osc.stop(startedAt + delay + 0.3);
    });
    setTimeout(() => ctx.close(), 1300);
  } catch (err) {
    console.error(err);
  }
}

export default function SessionTimer({
  session,
  totalSeconds,
  presenter,
}: {
  session: SessionRow;
  totalSeconds: number;
  presenter: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const finishedFired = useRef(false);
  const prevFinished = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const status = session.timer_status ?? "idle";

  let remaining: number;
  if (status === "running" && session.timer_end_at) {
    remaining = (new Date(session.timer_end_at).getTime() - nowMs) / 1000;
  } else if (status === "paused") {
    remaining = session.timer_remaining_seconds ?? totalSeconds;
  } else if (status === "finished") {
    remaining = 0;
  } else {
    remaining = totalSeconds;
  }
  remaining = Math.max(0, remaining);

  const isRunning = status === "running" && remaining > 0;
  const isWarning = isRunning && remaining <= 120;
  const isFinished = status === "finished" || (status === "running" && remaining <= 0);

  useEffect(() => {
    if (status === "running" && remaining <= 0 && presenter && !finishedFired.current) {
      finishedFired.current = true;
      supabase.from("sessions").update({ timer_status: "finished", timer_end_at: null, timer_remaining_seconds: 0 }).eq("id", session.id);
    }
    if (status !== "running") finishedFired.current = false;
  }, [status, remaining, presenter, session.id]);

  useEffect(() => {
    if (isFinished && !prevFinished.current) playBeep();
    prevFinished.current = isFinished;
  }, [isFinished]);

  async function start() {
    const secs = status === "paused" ? session.timer_remaining_seconds ?? totalSeconds : totalSeconds;
    const endAt = new Date(Date.now() + secs * 1000).toISOString();
    await supabase
      .from("sessions")
      .update({ timer_status: "running", timer_end_at: endAt, timer_remaining_seconds: null })
      .eq("id", session.id);
  }
  async function pause() {
    const remainingNow = Math.max(0, Math.round(remaining));
    await supabase
      .from("sessions")
      .update({ timer_status: "paused", timer_end_at: null, timer_remaining_seconds: remainingNow })
      .eq("id", session.id);
  }
  async function reset() {
    await supabase
      .from("sessions")
      .update({ timer_status: "idle", timer_end_at: null, timer_remaining_seconds: null })
      .eq("id", session.id);
  }

  if (totalSeconds <= 0) return null;

  return (
    <div
      className={`relative rounded-lg border p-3 transition-colors ${
        isFinished ? "border-red-400 bg-red-50" : isWarning ? "border-orange-400 bg-orange-50" : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`timer-digits font-mono text-2xl font-bold tabular-nums ${
              isFinished ? "text-red-600" : isWarning ? "text-orange-600" : "text-dark"
            } ${isWarning ? "timer-pulse-fast" : isRunning ? "timer-pulse" : ""}`}
          >
            {isFinished ? "00:00" : formatTime(remaining)}
          </span>
          <span className="text-xs text-muted">
            {isFinished
              ? "⏰ ¡Tiempo terminado!"
              : isRunning
                ? isWarning
                  ? "¡Últimos 2 minutos!"
                  : "Tiempo corriendo…"
                : status === "paused"
                  ? "En pausa"
                  : "Tiempo propuesto de la sesión"}
          </span>
        </div>
        {presenter && (
          <div className="flex items-center gap-2">
            {status === "idle" && (
              <button className={btnPrimary} onClick={start}>
                ▶ Iniciar
              </button>
            )}
            {status === "running" && (
              <>
                <button className={btnGhost} onClick={pause}>
                  ⏸ Pausar
                </button>
                <button className={btnGhost} onClick={reset}>
                  ↺ Reiniciar
                </button>
              </>
            )}
            {status === "paused" && (
              <>
                <button className={btnPrimary} onClick={start}>
                  ▶ Reanudar
                </button>
                <button className={btnGhost} onClick={reset}>
                  ↺ Reiniciar
                </button>
              </>
            )}
            {status === "finished" && (
              <button className={btnGhost} onClick={reset}>
                ↺ Reiniciar
              </button>
            )}
          </div>
        )}
      </div>
      {isFinished && <div className="timer-flash pointer-events-none fixed inset-0 z-40" />}
      <style>{`
        @keyframes timer-pulse-anim { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .timer-pulse { animation: timer-pulse-anim 2s ease-in-out infinite; }
        .timer-pulse-fast { animation: timer-pulse-anim 0.6s ease-in-out infinite; }
        @keyframes timer-flash-anim {
          0%, 100% { background: transparent; }
          15%, 35%, 55% { background: rgba(220, 38, 38, 0.16); }
          25%, 45%, 65% { background: transparent; }
        }
        .timer-flash { animation: timer-flash-anim 2s ease-in-out 1; }
      `}</style>
    </div>
  );
}
