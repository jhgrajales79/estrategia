"use client";

import type { CSSProperties } from "react";

const SIZE = 8;
const LIGHT_SQUARE = "#f2ead9"; // marfil cálido, look de tablero real
const DARK_SQUARE = "#4c7a52"; // verde profundo de la marca, con más contraste que las fichas
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function pct(n: number) {
  return `${((n + 0.5) / SIZE) * 100}%`;
}

interface Square {
  col: number;
  row: number;
}

// Duración de una "ronda" completa de jugadas del equipo (más larga = más pausa entre movimientos).
const PIECE_DURATION = 14;
const START_PCT = 4;
const END_PCT = 92;

interface TeamPiece {
  glyph: string;
  color: string;
  size: number;
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
    color: "#00a0df",
    size: 18,
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
    color: "#087062",
    size: 16,
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

const ORIGIN: Square = { col: 0, row: 7 };
const GOAL: Square = { col: 7, row: 0 };
const RIVAL_COLOR = "#7d8590";

// Instante (0-100%, en el reloj maestro de PIECE_DURATION) en que una pieza propia llega a una casilla
// de su ruta. Como todas las piezas comparten la misma duración de animación, un obstáculo colocado en
// esa casilla puede "caer" exactamente en ese instante: la captura queda sincronizada con el movimiento real.
function arrivalPct(piece: TeamPiece, waypointIndex: number) {
  const segments = piece.waypoints.length - 1;
  const local = START_PCT + ((END_PCT - START_PCT) * waypointIndex) / segments;
  const delayPct = (piece.delay / PIECE_DURATION) * 100;
  return Number((((local + delayPct) % 100) + 100) % 100);
}

interface Obstacle {
  square: Square;
  capturePct: number;
}

// Cada pieza propia "captura" un obstáculo de la competencia en un punto intermedio de su propio camino.
const OBSTACLES: Obstacle[] = [
  { square: TEAM_PIECES[3].waypoints[2], capturePct: arrivalPct(TEAM_PIECES[3], 2) }, // peón verde
  { square: TEAM_PIECES[4].waypoints[2], capturePct: arrivalPct(TEAM_PIECES[4], 2) }, // peón morado
  { square: TEAM_PIECES[0].waypoints[2], capturePct: arrivalPct(TEAM_PIECES[0], 2) }, // caballo
  { square: TEAM_PIECES[1].waypoints[1], capturePct: arrivalPct(TEAM_PIECES[1], 1) }, // alfil
  { square: TEAM_PIECES[2].waypoints[1], capturePct: arrivalPct(TEAM_PIECES[2], 1) }, // torre
].sort((a, b) => a.capturePct - b.capturePct);

// Una jugada descrita a la vez: el avance del equipo se cuenta como una historia con desenlace.
const CAPTIONS: { text: string; start: number; end: number }[] = [
  { text: "♞ El caballo anticipa el terreno y neutraliza un obstáculo con un salto en L.", start: 0, end: 2.2 },
  { text: "♝ El alfil avanza en diagonal, superando a la competencia en el camino.", start: 2.2, end: 4.4 },
  { text: "♜ La torre despeja el paso en línea recta hacia la meta.", start: 4.4, end: 6.6 },
  { text: "♟ El peón verde abre el frente, paso a paso.", start: 6.6, end: 8.8 },
  { text: "♟ El peón morado refuerza el avance y cierra filas.", start: 8.8, end: 11 },
  { text: "♛ El equipo llega a la meta, protegiendo los recursos (♚) con la ventaja asegurada.", start: 11, end: PIECE_DURATION },
];

function squareStyle(s: Square): CSSProperties {
  return { left: pct(s.col), top: pct(s.row), transform: "translate(-50%, -50%)" };
}

function buildPieceKeyframes(name: string, waypoints: Square[]) {
  const segments = waypoints.length - 1;
  const frame = (p: number, s: Square, extra?: string) =>
    `${p}% { left: ${pct(s.col)}; top: ${pct(s.row)}; transform: translate(-50%, -50%);${extra ? ` ${extra}` : ""} }`;

  const lines: string[] = [];
  lines.push(frame(0, waypoints[0], "opacity: 0;"));
  lines.push(frame(START_PCT, waypoints[0], "opacity: 1;"));
  for (let i = 1; i <= segments; i++) {
    const arrival = START_PCT + ((END_PCT - START_PCT) * i) / segments;
    lines.push(frame(Number(arrival.toFixed(2)), waypoints[i]));
    if (i < segments) {
      // Pausa deliberada en cada casilla, como si el equipo evaluara la jugada antes de continuar.
      const pause = Math.min(arrival + 6, END_PCT - 0.5);
      lines.push(frame(Number(pause.toFixed(2)), waypoints[i]));
    }
  }
  lines.push(frame(END_PCT, waypoints[segments], "opacity: 1;"));
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

// Cada obstáculo espera en su casilla, recibe un destello justo antes de ser superado
// y desaparece exactamente cuando la pieza propia llega a esa casilla (ver arrivalPct).
function buildObstacleKeyframes(name: string, capturePct: number) {
  const flash = Math.max(0.3, Number((capturePct - 1.4).toFixed(2)));
  const gone = Math.min(99.5, Number((capturePct + 0.4).toFixed(2)));
  const t = (p: number, opacity: number, scale: number, glow: number) =>
    `${p}% { opacity: ${opacity}; transform: translate(-50%, -50%) scale(${scale}); filter: drop-shadow(0 0 ${glow}px rgba(255,255,255,${glow ? 0.95 : 0})); }`;
  return `@keyframes ${name} {\n${[
    t(0, 1, 1, 0),
    t(flash, 1, 1.35, 9),
    t(capturePct, 0, 0.2, 0),
    t(gone, 0, 0.2, 0),
    t(100, 0, 0.2, 0),
  ].join("\n")}\n}`;
}

// El punto de "ventaja" se enciende en el mismo instante en que su obstáculo cae, para leerse
// como un marcador en vivo del avance del equipo.
function buildBadgeKeyframes(name: string, capturePct: number) {
  const pop = Math.min(99.5, Number((capturePct + 0.4).toFixed(2)));
  const settle = Math.min(99.8, Number((capturePct + 2.5).toFixed(2)));
  return `@keyframes ${name} {
0% { transform: scale(1); background: transparent; }
${capturePct}% { transform: scale(1); background: transparent; }
${pop}% { transform: scale(1.5); background: var(--brand-dark); }
${settle}% { transform: scale(1); background: var(--brand-dark); }
100% { transform: scale(1); background: var(--brand-dark); }
}`;
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
    <div className="mb-4 w-full max-w-md rounded-xl border border-border bg-gradient-to-b from-card to-black/[0.02] p-3 shadow-sm">
      <div className="mx-auto w-full max-w-[320px]">
        <div className="flex">
          {/* Columna de rangos (8..1): ancho fijo, fuera del espacio de coordenadas del tablero. */}
          <div className="flex w-3.5 shrink-0 flex-col" aria-hidden>
            {FILES.map((_, i) => (
              <span key={i} className="flex flex-1 items-center justify-end pr-1 text-[8px] font-semibold leading-none text-muted">
                {SIZE - i}
              </span>
            ))}
          </div>

          {/* Esta capa (tablero + fichas) es el único marco de referencia para las coordenadas en % de las piezas. */}
          <div className="relative flex-1">
            <div
              className="grid overflow-hidden rounded-md shadow-[inset_0_0_0_3px_var(--brand-dark),0_2px_8px_rgba(0,0,0,0.12)]"
              style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)`, aspectRatio: "1 / 1" }}
              role="img"
              aria-label="Tablero de ajedrez animado: el equipo avanza en conjunto, captura los obstáculos de la competencia en el camino y protege los recursos hasta llegar a la meta"
            >
              {squares}
            </div>

            <div
              className="chess-home-glow pointer-events-none absolute rounded-full"
              style={{ ...squareStyle(ORIGIN), width: 26, height: 26, background: "radial-gradient(circle, rgba(8,112,98,0.35), rgba(8,112,98,0) 70%)" }}
            />
            <div className="pointer-events-none absolute text-[15px] leading-none drop-shadow-sm" style={{ ...squareStyle(ORIGIN), color: "var(--brand-dark)" }}>
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
            <div className="chess-goal pointer-events-none absolute text-[16px] leading-none drop-shadow-sm" style={{ ...squareStyle(GOAL), color: "#c99a2e" }}>
              ♛
            </div>

            {OBSTACLES.map((o, i) => (
              <div
                key={i}
                className={`chess-obstacle chess-obstacle-${i} pointer-events-none absolute text-[14px] leading-none`}
                style={{ ...squareStyle(o.square), color: RIVAL_COLOR }}
              >
                ♟
              </div>
            ))}

            {TEAM_PIECES.map((p, i) => (
              <div
                key={i}
                className={`chess-team-piece chess-team-piece-${i} pointer-events-none absolute leading-none drop-shadow-sm`}
                style={{ ...squareStyle(p.waypoints[0]), fontSize: p.size, color: p.color }}
              >
                {p.glyph}
              </div>
            ))}
          </div>
        </div>

        {/* Fila de columnas (a..h), alineada bajo la capa del tablero (excluye la columna de rangos). */}
        <div className="mt-0.5 flex pl-3.5">
          {FILES.map((f) => (
            <span key={f} className="flex-1 text-center text-[8px] font-semibold leading-none text-muted">
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        <span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-muted">Ventaja del equipo</span>
        {OBSTACLES.map((_, i) => (
          <span key={i} className={`chess-badge chess-badge-${i} inline-block h-2 w-2 rounded-full border border-brand-dark`} />
        ))}
      </div>

      <div className="relative mt-2 min-h-[46px] px-1 text-center text-[11px] leading-relaxed text-muted">
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
            `.chess-team-piece-${i} { animation: chess-team-move-${i} ${PIECE_DURATION}s ease-in-out infinite; animation-delay: ${p.delay}s; }`
        ).join("\n")}
        ${OBSTACLES.map((o, i) => buildObstacleKeyframes(`chess-obstacle-move-${i}`, o.capturePct)).join("\n")}
        ${OBSTACLES.map((_, i) => `.chess-obstacle-${i} { animation: chess-obstacle-move-${i} ${PIECE_DURATION}s linear infinite; }`).join("\n")}
        ${OBSTACLES.map((o, i) => buildBadgeKeyframes(`chess-badge-move-${i}`, o.capturePct)).join("\n")}
        ${OBSTACLES.map((_, i) => `.chess-badge-${i} { animation: chess-badge-move-${i} ${PIECE_DURATION}s linear infinite; }`).join("\n")}
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
        .chess-home-glow {
          animation: chess-home-glow-anim 3.2s ease-in-out infinite;
        }
        @keyframes chess-home-glow-anim {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.25); }
        }
        @media (prefers-reduced-motion: reduce) {
          .chess-team-piece, .chess-goal, .chess-obstacle, .chess-goal-glow, .chess-home-glow, .chess-badge { animation: none !important; opacity: 1 !important; }
          ${TEAM_PIECES.map((p, i) => {
            const last = p.waypoints[p.waypoints.length - 1];
            return `.chess-team-piece-${i} { left: ${pct(last.col)}; top: ${pct(last.row)}; transform: translate(-50%, -50%); }`;
          }).join("\n")}
          .chess-obstacle { display: none !important; }
          .chess-badge { background: var(--brand-dark) !important; }
          .chess-caption { animation: none !important; opacity: 1 !important; position: static !important; display: block; margin-bottom: 4px; }
        }
      `}</style>
    </div>
  );
}
