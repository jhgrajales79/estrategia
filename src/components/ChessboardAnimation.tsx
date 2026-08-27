"use client";

import type { CSSProperties } from "react";

const SIZE = 8;
const LIGHT_SQUARE = "#eef1ea";
const DARK_SQUARE = "#5f8f4f"; // verde más suave que el brand-dark, para que las fichas resalten

function pct(n: number) {
  return `${((n + 0.5) / SIZE) * 100}%`;
}

interface Square {
  col: number;
  row: number;
}

// Duración de una "ronda" completa de jugadas del equipo (más larga = más pausa entre movimientos).
const PIECE_DURATION = 14;

interface TeamPiece {
  glyph: string;
  color: string;
  size: number;
  duration: number;
  delay: number;
  waypoints: Square[];
}

// Cinco piezas del equipo, cada una con un tipo de movimiento distinto (L, diagonal, recto, avance),
// que avanzan escalonadas y convergen en una misma línea de formación cerca del objetivo:
// la estrategia se logra en equipo, no con una sola jugada.
const TEAM_PIECES: TeamPiece[] = [
  {
    glyph: "♞",
    color: "var(--brand)",
    size: 18,
    duration: PIECE_DURATION,
    delay: 0,
    // Movimientos reales de caballo en "L" (2+1 casillas en perpendicular).
    waypoints: [
      { col: 0, row: 7 },
      { col: 1, row: 5 },
      { col: 3, row: 4 },
      { col: 4, row: 2 },
      { col: 6, row: 1 },
    ],
  },
  {
    glyph: "♝",
    color: "#2f6fb0",
    size: 18,
    duration: PIECE_DURATION,
    delay: 2.2,
    // Movimientos diagonales de alfil.
    waypoints: [
      { col: 1, row: 7 },
      { col: 4, row: 4 },
      { col: 7, row: 1 },
    ],
  },
  {
    glyph: "♜",
    color: "#a3541f",
    size: 18,
    duration: PIECE_DURATION,
    delay: 4.4,
    // Movimientos rectos de torre.
    waypoints: [
      { col: 0, row: 4 },
      { col: 0, row: 1 },
      { col: 5, row: 1 },
    ],
  },
  {
    glyph: "♟",
    color: "#4c8c3f",
    size: 16,
    duration: PIECE_DURATION,
    delay: 6.6,
    // Avance recto de peón, columna por columna.
    waypoints: [
      { col: 2, row: 7 },
      { col: 2, row: 5 },
      { col: 2, row: 3 },
      { col: 2, row: 1 },
    ],
  },
  {
    glyph: "♟",
    color: "#6b5b95",
    size: 16,
    duration: PIECE_DURATION,
    delay: 8.8,
    // Avance recto de peón, columna por columna.
    waypoints: [
      { col: 3, row: 6 },
      { col: 3, row: 4 },
      { col: 3, row: 2 },
      { col: 3, row: 1 },
    ],
  },
];

const COMPETITORS: (Square & { delay: number })[] = [
  { col: 5, row: 5, delay: 0 },
  { col: 2, row: 2, delay: 1.2 },
  { col: 6, row: 3, delay: 2.4 },
  { col: 5, row: 6, delay: 3.6 },
];

const ORIGIN: Square = { col: 0, row: 7 };
const GOAL: Square = { col: 7, row: 0 };

// Una jugada descrita a la vez, sincronizada con el turno de cada pieza (no todo el texto de golpe).
const CAPTIONS: { text: string; start: number; end: number }[] = [
  { text: "♞ El caballo anticipa el terreno con saltos calculados en L.", start: 0, end: 2.2 },
  { text: "♝ El alfil avanza en diagonal, aprovechando cada oportunidad.", start: 2.2, end: 4.4 },
  { text: "♜ La torre ejecuta con determinación, en línea recta hacia la meta.", start: 4.4, end: 6.6 },
  { text: "♟ El peón verde sostiene el frente, paso a paso.", start: 6.6, end: 8.8 },
  { text: "♟ El peón morado refuerza el avance del equipo.", start: 8.8, end: 11 },
  { text: "♛ El equipo converge en el objetivo, protegiendo los recursos (♚) y vigilando a la competencia (♟).", start: 11, end: PIECE_DURATION },
];

function squareStyle(s: Square): CSSProperties {
  return { left: pct(s.col), top: pct(s.row), transform: "translate(-50%, -50%)" };
}

function buildPieceKeyframes(name: string, waypoints: Square[]) {
  const startPct = 4;
  const endPct = 92;
  const segments = waypoints.length - 1;
  const frame = (p: number, s: Square, extra?: string) =>
    `${p}% { left: ${pct(s.col)}; top: ${pct(s.row)}; transform: translate(-50%, -50%);${extra ? ` ${extra}` : ""} }`;

  const lines: string[] = [];
  lines.push(frame(0, waypoints[0], "opacity: 0;"));
  lines.push(frame(startPct, waypoints[0], "opacity: 1;"));
  for (let i = 1; i <= segments; i++) {
    const arrival = startPct + ((endPct - startPct) * i) / segments;
    lines.push(frame(Number(arrival.toFixed(2)), waypoints[i]));
    if (i < segments) {
      // Pausa deliberada en cada casilla, como si el equipo evaluara la jugada antes de continuar.
      const pause = Math.min(arrival + 6, endPct - 0.5);
      lines.push(frame(Number(pause.toFixed(2)), waypoints[i]));
    }
  }
  lines.push(frame(endPct, waypoints[segments], "opacity: 1;"));
  lines.push(frame(97, waypoints[segments], "opacity: 0;"));
  lines.push(frame(100, waypoints[segments], "opacity: 0;"));

  return `@keyframes ${name} {\n${lines.join("\n")}\n}`;
}

function buildCaptionKeyframes(name: string, startSec: number, endSec: number, fadeSec = 0.3) {
  const toPct = (s: number) => Number(((s / PIECE_DURATION) * 100).toFixed(2));
  const startPct = toPct(startSec);
  const endPct = toPct(endSec);
  const fadePct = toPct(fadeSec);
  const lines: string[] = [];

  if (startPct <= 0) {
    lines.push(`0% { opacity: 1; }`);
  } else {
    lines.push(`0% { opacity: 0; }`);
    const fadeInStart = Math.max(startPct - fadePct, 0);
    if (fadeInStart > 0) lines.push(`${fadeInStart}% { opacity: 0; }`);
    lines.push(`${startPct}% { opacity: 1; }`);
  }

  const fadeOutStart = Math.max(endPct - fadePct, startPct);
  if (fadeOutStart > startPct) lines.push(`${fadeOutStart}% { opacity: 1; }`);
  const clampedEnd = Math.min(endPct, 100);
  lines.push(`${clampedEnd}% { opacity: 0; }`);
  if (clampedEnd < 100) lines.push(`100% { opacity: 0; }`);

  return `@keyframes ${name} {\n${lines.join("\n")}\n}`;
}

export default function ChessboardAnimation() {
  const squares = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const dark = (row + col) % 2 === 1;
      squares.push(<div key={`${row}-${col}`} style={{ background: dark ? DARK_SQUARE : LIGHT_SQUARE }} />);
    }
  }

  return (
    <div className="mb-6 w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="relative mx-auto w-full max-w-[260px]">
        <div
          className="grid overflow-hidden rounded-md border border-border"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)`, aspectRatio: "1 / 1" }}
          role="img"
          aria-label="Tablero de ajedrez animado: el equipo avanza en conjunto, evalúa a la competencia y protege los recursos para alcanzar el objetivo de negocio"
        >
          {squares}
        </div>

        <div className="pointer-events-none absolute text-[15px] leading-none" style={{ ...squareStyle(ORIGIN), color: "var(--brand-dark)" }}>
          ♚
        </div>

        <div
          className="chess-goal-glow pointer-events-none absolute rounded-full"
          style={{
            ...squareStyle(GOAL),
            width: 30,
            height: 30,
            background: "radial-gradient(circle, rgba(201,154,46,0.6), rgba(201,154,46,0) 72%)",
          }}
        />

        <div className="chess-goal pointer-events-none absolute text-[16px] leading-none" style={{ ...squareStyle(GOAL), color: "#c99a2e" }}>
          ♛
        </div>

        {COMPETITORS.map((c, i) => (
          <div
            key={i}
            className="chess-competitor pointer-events-none absolute text-[14px] leading-none"
            style={{ ...squareStyle(c), color: "var(--asp-1)", animationDelay: `${c.delay}s` }}
          >
            ♟
          </div>
        ))}

        {TEAM_PIECES.map((p, i) => (
          <div
            key={i}
            className={`chess-team-piece chess-team-piece-${i} pointer-events-none absolute leading-none`}
            style={{ ...squareStyle(p.waypoints[0]), fontSize: p.size, color: p.color }}
          >
            {p.glyph}
          </div>
        ))}
      </div>

      <div className="relative mt-3 min-h-[46px] px-1 text-center text-[11px] leading-relaxed text-muted">
        {CAPTIONS.map((c, i) => (
          <p key={i} className={`chess-caption chess-caption-${i} absolute inset-0 flex items-center justify-center`}>
            {c.text}
          </p>
        ))}
      </div>

      <style>{`
        ${CAPTIONS.map((c, i) => buildCaptionKeyframes(`chess-caption-move-${i}`, c.start, c.end)).join("\n")}
        ${CAPTIONS.map((c, i) => `.chess-caption-${i} { opacity: 0; animation: chess-caption-move-${i} ${PIECE_DURATION}s linear infinite; }`).join(
          "\n"
        )}
        ${TEAM_PIECES.map((p, i) => buildPieceKeyframes(`chess-team-move-${i}`, p.waypoints)).join("\n")}
        ${TEAM_PIECES.map(
          (p, i) =>
            `.chess-team-piece-${i} { animation: chess-team-move-${i} ${p.duration}s ease-in-out infinite; animation-delay: ${p.delay}s; }`
        ).join("\n")}
        .chess-goal {
          animation: chess-goal-pulse 2.2s ease-in-out infinite;
        }
        @keyframes chess-goal-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3); }
        }
        .chess-goal-glow {
          animation: chess-goal-glow-anim ${PIECE_DURATION}s ease-out infinite;
        }
        @keyframes chess-goal-glow-anim {
          0%, 76% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          90% { opacity: 1; transform: translate(-50%, -50%) scale(2.1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.4); }
        }
        .chess-competitor {
          animation: chess-competitor-pulse 3.4s ease-in-out infinite;
        }
        @keyframes chess-competitor-pulse {
          0%, 60%, 100% { opacity: 0.5; }
          80% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .chess-team-piece, .chess-goal, .chess-competitor, .chess-goal-glow { animation: none !important; opacity: 1 !important; }
          ${TEAM_PIECES.map((p, i) => {
            const last = p.waypoints[p.waypoints.length - 1];
            return `.chess-team-piece-${i} { left: ${pct(last.col)}; top: ${pct(last.row)}; transform: translate(-50%, -50%); }`;
          }).join("\n")}
          .chess-caption { animation: none !important; opacity: 1 !important; position: static !important; display: block; margin-bottom: 4px; }
        }
      `}</style>
    </div>
  );
}
