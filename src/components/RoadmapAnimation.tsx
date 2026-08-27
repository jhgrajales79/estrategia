"use client";

const PATH_D = "M 20 108 C 80 108, 80 48, 140 52 C 200 56, 200 18, 260 22 C 305 25, 320 10, 372 14";

const MILESTONES = [
  { cx: 100, cy: 74, delay: 1.1 },
  { cx: 180, cy: 46, delay: 1.65 },
  { cx: 250, cy: 22, delay: 2.2 },
];

export default function RoadmapAnimation() {
  return (
    <div className="mb-6 w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
      <svg viewBox="0 0 392 130" className="h-auto w-full" role="img" aria-label="Mapa de ruta: del punto A (situación actual) al punto B (visión)">
        <path d={PATH_D} fill="none" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 10" />
        <path d={PATH_D} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" pathLength={100} className="roadmap-draw" />

        {MILESTONES.map((m, i) => (
          <circle
            key={i}
            cx={m.cx}
            cy={m.cy}
            r="5"
            fill="var(--brand)"
            stroke="var(--card)"
            strokeWidth="2"
            className="roadmap-milestone"
            style={{ animationDelay: `${m.delay}s` }}
          />
        ))}

        <circle cx="20" cy="108" r="7" fill="var(--brand-dark)" stroke="var(--card)" strokeWidth="2" />
        <circle cx="372" cy="14" r="8" fill="var(--brand)" stroke="var(--card)" strokeWidth="2" />
        <circle r="6" fill="#ffffff" stroke="var(--brand-dark)" strokeWidth="2" className="roadmap-traveler" />

        <text x="20" y="124" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--muted)">
          Punto A
        </text>
        <text x="372" y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--brand-dark)">
          Punto B
        </text>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
        <span>Situación actual</span>
        <span>Visión Socya</span>
      </div>

      <style>{`
        .roadmap-draw {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: roadmap-draw-anim 2.2s ease-out forwards;
        }
        @keyframes roadmap-draw-anim {
          to { stroke-dashoffset: 0; }
        }
        .roadmap-milestone {
          opacity: 0;
          transform-origin: center;
          transform: scale(0.4);
          animation: roadmap-milestone-anim 0.5s ease-out forwards;
        }
        @keyframes roadmap-milestone-anim {
          to { opacity: 1; transform: scale(1); }
        }
        .roadmap-traveler {
          offset-path: path("${PATH_D}");
          animation: roadmap-travel-anim 4.5s ease-in-out infinite;
        }
        @keyframes roadmap-travel-anim {
          0% { offset-distance: 0%; opacity: 0; }
          8% { opacity: 1; }
          90% { offset-distance: 100%; opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .roadmap-draw, .roadmap-milestone, .roadmap-traveler {
            animation: none !important;
          }
          .roadmap-draw { stroke-dashoffset: 0; }
          .roadmap-milestone { opacity: 1; transform: scale(1); }
          .roadmap-traveler { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
