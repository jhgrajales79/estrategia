"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { ActivityRow } from "@/lib/types";

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

function useActivityRemaining(activity: ActivityRow, totalSeconds: number) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const status = activity.timer_status ?? "idle";
  let remaining: number;
  if (status === "running" && activity.timer_end_at) {
    remaining = (new Date(activity.timer_end_at).getTime() - nowMs) / 1000;
  } else if (status === "paused") {
    remaining = activity.timer_remaining_seconds ?? totalSeconds;
  } else if (status === "finished") {
    remaining = 0;
  } else {
    remaining = totalSeconds;
  }
  remaining = Math.max(0, remaining);

  const isRunning = status === "running" && remaining > 0;
  const isWarning = isRunning && remaining <= 120;
  const isFinished = status === "finished" || (status === "running" && remaining <= 0);

  return { status, remaining, isRunning, isWarning, isFinished };
}

const iconBtnCls =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[11px] text-foreground hover:bg-black/5";

// Se usa dentro del título de la actividad (encabezado): fichas de icono compactas, sin
// depender de estilos de botón grandes, y siempre evitando que el clic abra/cierre la tarjeta.
export default function ActivityTimer({
  activity,
  totalSeconds,
  presenter,
}: {
  activity: ActivityRow;
  totalSeconds: number;
  presenter: boolean;
}) {
  const { status, remaining, isRunning, isWarning, isFinished } = useActivityRemaining(activity, totalSeconds);
  const finishedFired = useRef(false);
  const prevFinished = useRef(false);

  useEffect(() => {
    if (status === "running" && remaining <= 0 && presenter && !finishedFired.current) {
      finishedFired.current = true;
      supabase.from("activities").update({ timer_status: "finished", timer_end_at: null, timer_remaining_seconds: 0 }).eq("id", activity.id);
    }
    if (status !== "running") finishedFired.current = false;
  }, [status, remaining, presenter, activity.id]);

  useEffect(() => {
    if (isFinished && !prevFinished.current) playBeep();
    prevFinished.current = isFinished;
  }, [isFinished]);

  async function start(e: MouseEvent) {
    e.stopPropagation();
    const secs = status === "paused" ? activity.timer_remaining_seconds ?? totalSeconds : totalSeconds;
    const endAt = new Date(Date.now() + secs * 1000).toISOString();
    await supabase
      .from("activities")
      .update({ timer_status: "running", timer_end_at: endAt, timer_remaining_seconds: null })
      .eq("id", activity.id);
  }
  async function pause(e: MouseEvent) {
    e.stopPropagation();
    const remainingNow = Math.max(0, Math.round(remaining));
    await supabase
      .from("activities")
      .update({ timer_status: "paused", timer_end_at: null, timer_remaining_seconds: remainingNow })
      .eq("id", activity.id);
  }
  async function reset(e: MouseEvent) {
    e.stopPropagation();
    await supabase
      .from("activities")
      .update({ timer_status: "idle", timer_end_at: null, timer_remaining_seconds: null })
      .eq("id", activity.id);
  }

  if (totalSeconds <= 0) return null;

  if (status === "idle") {
    return (
      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted">{Math.round(totalSeconds / 60)} min</span>
        {presenter && (
          <button className={iconBtnCls} onClick={start} title="Iniciar temporizador">
            ▶
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <span
        title={
          isFinished ? "¡Tiempo terminado!" : isWarning ? "¡Últimos 2 minutos!" : status === "paused" ? "En pausa" : "Tiempo corriendo…"
        }
        className={`activity-timer-digits rounded-full px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${
          isFinished
            ? "bg-red-100 text-red-600"
            : isWarning
              ? "bg-orange-100 text-orange-600"
              : status === "paused"
                ? "bg-black/5 text-muted"
                : "bg-brand/10 text-brand-dark"
        } ${isWarning ? "timer-pulse-fast" : isRunning ? "timer-pulse" : ""}`}
      >
        {isFinished ? "00:00" : formatTime(remaining)}
      </span>
      {presenter && (
        <>
          {status === "running" && (
            <button className={iconBtnCls} onClick={pause} title="Pausar">
              ⏸
            </button>
          )}
          {status === "paused" && (
            <button className={iconBtnCls} onClick={start} title="Reanudar">
              ▶
            </button>
          )}
          <button className={iconBtnCls} onClick={reset} title="Reiniciar temporizador">
            ↺
          </button>
        </>
      )}
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
