"use client";

import { useEffect, useRef, useState } from "react";
import { btnPrimary, btnGhost } from "@/components/activities/shared";
import { useServerNow } from "@/lib/useServerClock";

export interface Rotation {
  round: number; // 1-based, hasta tableCount
  status: "idle" | "running" | "paused" | "done";
  endAt: string | null;
  remainingSeconds: number | null;
}

export const EMPTY_ROTATION: Rotation = { round: 1, status: "idle", endAt: null, remainingSeconds: null };

function formatMinSec(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function playRotationChime() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const startedAt = ctx.currentTime;
    [0, 0.18, 0.36].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 660 + i * 220;
      gain.gain.setValueAtTime(0.0001, startedAt + delay);
      gain.gain.exponentialRampToValueAtTime(0.28, startedAt + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + delay + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startedAt + delay);
      osc.stop(startedAt + delay + 0.34);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch (err) {
    console.error(err);
  }
}

// Igual técnica que ActivityTimer: la cuenta regresiva se deriva de una marca de tiempo
// absoluta (`endAt`), no de un contador local — así sigue siendo correcta para todos los que
// miran la pantalla aunque recarguen o se conecten a mitad de ronda.
function useRotationRemaining(rotation: Rotation, totalSeconds: number) {
  const nowMs = useServerNow();

  let remaining: number;
  if (rotation.status === "running" && rotation.endAt) {
    remaining = (new Date(rotation.endAt).getTime() - nowMs) / 1000;
  } else if (rotation.status === "paused") {
    remaining = rotation.remainingSeconds ?? totalSeconds;
  } else {
    remaining = totalSeconds;
  }
  remaining = Math.max(0, remaining);

  const isRunning = rotation.status === "running" && remaining > 0;
  const isWarning = isRunning && remaining <= Math.min(60, totalSeconds * 0.2);
  const isFinished = rotation.status === "running" && remaining <= 0;
  return { remaining, isRunning, isWarning, isFinished };
}

// Tablero de "mesas que rotan" (Mundo café y similares): muestra en qué ronda va el grupo,
// cuánto falta para rotar, y una marca de agua a pantalla completa 1 minuto antes de cada
// cambio — compartido entre el tablero en vivo (NotasColectivas) y la vista ampliada/proyectada
// (/notas/[activityId]), que es la que de verdad se muestra a toda la sala durante un Mundo
// café en vivo. Todo se deriva de `content.rotation`, sincronizado en tiempo real.
export default function RotationBoard({
  rotation,
  minutesPerRound,
  tableCount,
  activeLabel,
  nextLabel,
  presenter,
  onStart,
  onPause,
  onResume,
  onNext,
  onReset,
  large = false,
  dark = false,
}: {
  rotation: Rotation;
  minutesPerRound: number;
  tableCount: number;
  activeLabel: string;
  nextLabel: string | null;
  presenter: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onReset: () => void;
  large?: boolean;
  dark?: boolean;
}) {
  const totalSeconds = minutesPerRound * 60;
  const { remaining, isRunning, isWarning, isFinished } = useRotationRemaining(rotation, totalSeconds);
  const wasFinished = useRef(false);
  const [flashOn, setFlashOn] = useState(false);
  useEffect(() => {
    if (isFinished && !wasFinished.current) {
      playRotationChime();
      // El flash dura 2s por su cuenta aunque la ronda cambie de inmediato (rotación
      // automática) — si dependiera de `isFinished` directamente, desaparecería apenas se
      // reinicia el conteo de la siguiente mesa y nadie alcanzaría a verlo.
      setFlashOn(true);
      setTimeout(() => setFlashOn(false), 2000);
      // La rotación automática solo la dispara quien facilita — evita que cada participante
      // conectado intente avanzar la ronda al mismo tiempo.
      if (presenter) onNext();
    }
    wasFinished.current = isFinished;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, presenter]);

  const fraction = rotation.status === "idle" ? 1 : remaining / totalSeconds;
  const R = 26;
  const circumference = 2 * Math.PI * R;
  const isDone = rotation.status === "done";
  const mutedColor = dark ? "rgba(255,255,255,0.55)" : undefined;

  return (
    <div
      className={`rounded-xl border p-4 ${dark ? "border-white/15 bg-white/5" : "border-border bg-gradient-to-b from-brand/5 to-transparent"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <svg width={large ? 76 : 60} height={large ? 76 : 60} viewBox="0 0 60 60" className="shrink-0 -rotate-90">
            <circle cx="30" cy="30" r={R} fill="none" stroke={dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"} strokeWidth="5" />
            <circle
              cx="30"
              cy="30"
              r={R}
              fill="none"
              stroke={isFinished ? "#dc2626" : isWarning ? "#ea580c" : "#80c612"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - (isDone ? 0 : fraction))}
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          </svg>
          <div>
            <p
              className={`font-bold uppercase tracking-wide ${large ? "text-sm" : "text-xs"}`}
              style={{ color: mutedColor }}
            >
              {isDone ? "Rotación completa" : `Ronda ${rotation.round} de ${tableCount}`}
            </p>
            <p
              className={`font-mono font-extrabold tabular-nums ${large ? "text-4xl" : "text-2xl"} ${
                isFinished ? "text-red-500" : isWarning ? "text-orange-500" : dark ? "text-white" : "text-foreground"
              } ${isWarning || isFinished ? "animate-pulse" : ""}`}
            >
              {isDone ? "✅" : formatMinSec(remaining)}
            </p>
            {!isDone && (
              <p className={large ? "text-lg" : "text-sm"} style={{ color: dark ? "white" : undefined }}>
                📍 {activeLabel}
              </p>
            )}
          </div>
        </div>

        {presenter && (
          <div className="flex flex-wrap items-center gap-1.5">
            {rotation.status === "idle" && (
              <button className={btnPrimary} onClick={onStart}>
                ▶ Iniciar rotación
              </button>
            )}
            {rotation.status === "running" && (
              <button className={btnGhost} onClick={onPause}>
                ⏸ Pausar
              </button>
            )}
            {rotation.status === "paused" && (
              <button className={btnPrimary} onClick={onResume}>
                ▶ Reanudar
              </button>
            )}
            {(rotation.status === "running" || rotation.status === "paused") && (
              <button className={isFinished ? btnPrimary : btnGhost} onClick={onNext}>
                {rotation.round < tableCount ? "⏭ Siguiente mesa" : "🏁 Cerrar rondas"}
              </button>
            )}
            {rotation.status !== "idle" && (
              <button className={btnGhost} onClick={onReset}>
                ↺ Reiniciar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Barra de progreso de rondas: un segmento por mesa, así se ve de un vistazo cuánto
          falta para llegar a la plenaria. */}
      <div className="mt-3 flex gap-1">
        {Array.from({ length: tableCount }, (_, i) => {
          const roundNum = i + 1;
          const isPast = isDone || roundNum < rotation.round;
          const isCurrent = !isDone && roundNum === rotation.round;
          return (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                isPast ? "bg-brand" : isCurrent ? "bg-brand/50" : dark ? "bg-white/10" : "bg-black/10"
              }`}
            />
          );
        })}
      </div>

      {isWarning && !isFinished && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${dark ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
          🔜 Falta un minuto — {nextLabel ? (
            <>
              prepárense: la siguiente mesa es <strong>{nextLabel}</strong>.
            </>
          ) : (
            "esta es la última mesa, prepárense para la plenaria."
          )}
        </p>
      )}
      {/* La misma advertencia, pero como marca de agua sobre toda la pantalla — así se ve
          incluso si alguien tiene el scroll lejos de esta tarjeta, o está proyectando el
          tablero completo. `pointer-events-none` para no bloquear clics debajo. */}
      {isWarning && !isFinished && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden">
          <div className="watermark-pulse rotate-[-8deg] select-none rounded-2xl bg-amber-400/10 px-10 py-8 text-center">
            <p className="text-[9vw] font-black uppercase leading-none text-amber-500/25 sm:text-6xl">🔜 1 min</p>
            <p className="mt-2 text-2xl font-extrabold uppercase leading-tight text-amber-600/40 sm:text-3xl">
              {nextLabel ? `Sigue: ${nextLabel}` : "Sigue: plenaria"}
            </p>
          </div>
        </div>
      )}
      {(isFinished || flashOn) && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${dark ? "bg-red-400/10 text-red-300" : "bg-red-50 text-red-700"}`}>
          ⏰ ¡Tiempo! Rotando a la siguiente mesa…
        </p>
      )}
      {isDone && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${dark ? "bg-brand/10 text-brand" : "bg-brand/10 text-brand-dark"}`}>
          Las {tableCount} mesas ya rotaron — continúen con la plenaria: cada anfitrión presenta sus 3 hallazgos clave.
          {presenter && " Se descargó automáticamente una copia en Excel con todas las notas."}
        </p>
      )}
      {flashOn && <div className="rotation-flash pointer-events-none fixed inset-0 z-[70]" />}
      <style>{`
        @keyframes rotation-flash-anim {
          0%, 100% { background: transparent; }
          15%, 35%, 55% { background: rgba(220, 38, 38, 0.14); }
          25%, 45%, 65% { background: transparent; }
        }
        .rotation-flash { animation: rotation-flash-anim 2s ease-in-out 1; }
        @keyframes watermark-pulse-anim {
          0%, 100% { opacity: 0.7; transform: rotate(-8deg) scale(1); }
          50% { opacity: 1; transform: rotate(-8deg) scale(1.04); }
        }
        .watermark-pulse { animation: watermark-pulse-anim 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
