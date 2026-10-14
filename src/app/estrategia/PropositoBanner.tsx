// Refuerza que las 5 visuales parten del mismo propósito superior — las que no lo representan
// como un nodo propio del árbol (cascada, mapa de impacto, roadmap) lo muestran aquí arriba.
export default function PropositoBanner({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-brand bg-brand/10 px-4 py-3">
      <span className="text-lg leading-none" aria-hidden>
        🧭
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark">Propósito superior</p>
        <p className="text-sm font-medium text-foreground">{text}</p>
      </div>
    </div>
  );
}
