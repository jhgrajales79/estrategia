"use client";

const SIZE = 8;
const LIGHT_SQUARE = "#eef1ea";

const WAYPOINTS = [
  { col: 0, row: 7 }, // origen: recursos que se protegen
  { col: 1, row: 5 },
  { col: 3, row: 4 },
  { col: 5, row: 2 },
  { col: 7, row: 0 }, // objetivo: la meta de negocio
];

function pct(n: number) {
  return `${((n + 0.5) / SIZE) * 100}%`;
}

export default function ChessboardAnimation() {
  const squares = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const dark = (row + col) % 2 === 1;
      squares.push(<div key={`${row}-${col}`} style={{ background: dark ? "var(--brand-dark)" : LIGHT_SQUARE }} />);
    }
  }

  const origin = WAYPOINTS[0];
  const goal = WAYPOINTS[WAYPOINTS.length - 1];
  const competitor = { col: 5, row: 5 };

  return (
    <div className="mb-6 w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="relative mx-auto w-full max-w-[240px]">
        <div
          className="grid overflow-hidden rounded-md border border-border"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)`, aspectRatio: "1 / 1" }}
          role="img"
          aria-label="Tablero de ajedrez animado: anticipar movimientos, analizar a la competencia y avanzar hacia el objetivo de negocio"
        >
          {squares}
        </div>

        <div
          className="pointer-events-none absolute text-[15px] leading-none"
          style={{ left: pct(origin.col), top: pct(origin.row), transform: "translate(-50%, -50%)", color: "var(--brand-dark)" }}
        >
          ♚
        </div>

        <div
          className="chess-goal pointer-events-none absolute text-[15px] leading-none"
          style={{ left: pct(goal.col), top: pct(goal.row), transform: "translate(-50%, -50%)", color: "#c99a2e" }}
        >
          ♛
        </div>

        <div
          className="chess-competitor pointer-events-none absolute text-[15px] leading-none"
          style={{ left: pct(competitor.col), top: pct(competitor.row), transform: "translate(-50%, -50%)", color: "var(--asp-1)" }}
        >
          ♟
        </div>

        <div className="chess-piece pointer-events-none absolute text-[17px] leading-none" style={{ color: "var(--brand)" }}>
          ♞
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>♚ Recursos protegidos</span>
        <span>♟ Movimientos de la competencia</span>
        <span>♛ Objetivo de negocio</span>
      </div>

      <style>{`
        .chess-piece {
          animation: chess-move-anim 7s ease-in-out infinite;
        }
        @keyframes chess-move-anim {
          0%   { left: ${pct(WAYPOINTS[0].col)}; top: ${pct(WAYPOINTS[0].row)}; transform: translate(-50%, -50%); opacity: 0; }
          4%   { opacity: 1; }
          20%  { left: ${pct(WAYPOINTS[1].col)}; top: ${pct(WAYPOINTS[1].row)}; transform: translate(-50%, -50%); }
          24%  { left: ${pct(WAYPOINTS[1].col)}; top: ${pct(WAYPOINTS[1].row)}; transform: translate(-50%, -50%); }
          44%  { left: ${pct(WAYPOINTS[2].col)}; top: ${pct(WAYPOINTS[2].row)}; transform: translate(-50%, -50%); }
          48%  { left: ${pct(WAYPOINTS[2].col)}; top: ${pct(WAYPOINTS[2].row)}; transform: translate(-50%, -50%); }
          68%  { left: ${pct(WAYPOINTS[3].col)}; top: ${pct(WAYPOINTS[3].row)}; transform: translate(-50%, -50%); }
          72%  { left: ${pct(WAYPOINTS[3].col)}; top: ${pct(WAYPOINTS[3].row)}; transform: translate(-50%, -50%); }
          92%  { left: ${pct(WAYPOINTS[4].col)}; top: ${pct(WAYPOINTS[4].row)}; transform: translate(-50%, -50%); opacity: 1; }
          97%  { opacity: 0; }
          100% { left: ${pct(WAYPOINTS[4].col)}; top: ${pct(WAYPOINTS[4].row)}; transform: translate(-50%, -50%); opacity: 0; }
        }
        .chess-goal {
          animation: chess-goal-pulse 2.2s ease-in-out infinite;
        }
        @keyframes chess-goal-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3); }
        }
        .chess-competitor {
          animation: chess-competitor-pulse 3.4s ease-in-out infinite;
        }
        @keyframes chess-competitor-pulse {
          0%, 60%, 100% { opacity: 0.5; }
          80% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .chess-piece, .chess-goal, .chess-competitor { animation: none !important; }
          .chess-piece { left: ${pct(goal.col)}; top: ${pct(goal.row)}; transform: translate(-50%, -50%); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
