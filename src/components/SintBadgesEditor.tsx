"use client";

import { useState } from "react";
import type { Aspiration } from "@/lib/types";
import { ARCHETYPE_LABEL, aspClasses } from "@/lib/aspirationStyle";
import {
  NUEVAS_METAS,
  BADGE_TIPOS,
  addBadge,
  deleteBadge,
  useNuevaMetaBadges,
  type BadgeTipo,
  type NuevaMetaBadge,
} from "@/lib/nuevasMetas";

// Sugerencias para el tipo de recurso — se puede escribir cualquier otro.
const RECURSO_SUGERENCIAS = ["Humano", "Tecnológico", "Financiero", "Infraestructura", "Alianzas", "Conocimiento"];

// Pestaña SINT de "Nuestro trabajo": agrega/quita badges (foco estratégico, alternativa, tipo de
// recurso) a cada nueva meta. Lo que se edita aquí solo se ve en el tablero /nuevas-metas.
export default function SintBadgesEditor({ aspirations, canEdit }: { aspirations: Aspiration[]; canEdit: boolean }) {
  const badges = useNuevaMetaBadges();

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-foreground">SINT · Badges de las nuevas metas</h2>
      <p className="mb-4 text-xs text-muted">
        Define el foco estratégico, las alternativas y el tipo de recursos necesarios de cada nueva meta. Se muestran en
        el tablero <a href="/nuevas-metas" className="text-brand-dark underline">Nuevas metas</a>.
        {!canEdit && " Solo el facilitador puede agregar o quitar badges."}
      </p>
      <div className="space-y-6">
        {aspirations.map((a) => {
          const metas = NUEVAS_METAS.filter((m) => m.aspiracion === a.number);
          if (metas.length === 0) return null;
          const tone = aspClasses(a.number);
          return (
            <section key={a.id}>
              <h3 className={`mb-2 text-xs font-bold uppercase tracking-wide ${tone.text}`}>
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number] ?? ""} — <span className="normal-case">{a.name}</span>
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {metas.map((m) => (
                  <MetaCard
                    key={m.key}
                    metaKey={m.key}
                    texto={m.texto}
                    toneBorder={tone.border}
                    badges={badges.filter((b) => b.meta_key === m.key)}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MetaCard({
  metaKey,
  texto,
  toneBorder,
  badges,
  canEdit,
}: {
  metaKey: string;
  texto: string;
  toneBorder: string;
  badges: NuevaMetaBadge[];
  canEdit: boolean;
}) {
  return (
    <div className={`rounded-lg border-l-4 ${toneBorder} border-y border-r border-y-border border-r-border bg-card p-3 shadow-sm`}>
      <p className="mb-2 text-sm font-semibold text-foreground">{texto}</p>
      <div className="space-y-2">
        {BADGE_TIPOS.map((t) => (
          <BadgeRow
            key={t.tipo}
            metaKey={metaKey}
            tipo={t.tipo}
            label={`${t.icon} ${t.label}`}
            chip={t.chip}
            badges={badges.filter((b) => b.tipo === t.tipo)}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

function BadgeRow({
  metaKey,
  tipo,
  label,
  chip,
  badges,
  canEdit,
}: {
  metaKey: string;
  tipo: BadgeTipo;
  label: string;
  chip: string;
  badges: NuevaMetaBadge[];
  canEdit: boolean;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = `sint-${metaKey}-${tipo}`;

  async function submit() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addBadge(metaKey, tipo, value);
      setText("");
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el badge.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {badges.map((b) => (
          <span key={b.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${chip}`}>
            {b.label}
            {canEdit && (
              <button
                type="button"
                aria-label={`Quitar ${b.label}`}
                className="leading-none opacity-60 hover:opacity-100"
                onClick={() => deleteBadge(b.id).catch(() => setError("No se pudo quitar el badge."))}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {badges.length === 0 && !canEdit && <span className="text-xs text-muted">—</span>}
        {canEdit && (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              list={tipo === "recurso" ? listId : undefined}
              placeholder="Agregar…"
              className="w-32 rounded-md border border-border bg-background px-2 py-0.5 text-xs outline-none focus:border-brand-dark"
            />
            {tipo === "recurso" && (
              <datalist id={listId}>
                {RECURSO_SUGERENCIAS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            <button
              type="submit"
              disabled={!text.trim() || saving}
              className="rounded-md bg-brand px-2 py-0.5 text-xs font-semibold text-dark disabled:opacity-40"
            >
              +
            </button>
          </form>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
