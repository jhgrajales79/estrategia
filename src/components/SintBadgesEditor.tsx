"use client";

import { useState } from "react";
import type { Aspiration } from "@/lib/types";
import { ARCHETYPE_LABEL, aspClasses } from "@/lib/aspirationStyle";
import {
  BADGE_TIPOS,
  addBadge,
  addMeta,
  deleteBadge,
  deleteMeta,
  setBadgeAlerta,
  useNuevaMetaBadges,
  useNuevasMetas,
  type BadgeTipo,
  type NuevaMeta,
  type NuevaMetaBadge,
} from "@/lib/nuevasMetas";

// Sugerencias para el tipo de recurso — se puede escribir cualquier otro.
const RECURSO_SUGERENCIAS = ["Humano", "Tecnológico", "Financiero", "Infraestructura", "Alianzas", "Conocimiento"];

// Pestaña SINT de "Nuestro trabajo", exclusiva del facilitador (la página solo la monta para él):
// agrega/quita nuevas metas por aspiración y sus badges (foco estratégico, alternativa, tipo de
// recurso). Lo que se edita aquí solo se ve en el tablero /nuevas-metas.
export default function SintBadgesEditor({ aspirations }: { aspirations: Aspiration[] }) {
  const { metas, loaded } = useNuevasMetas();
  const badges = useNuevaMetaBadges();
  const nextOrden = metas.reduce((max, m) => Math.max(max, m.orden), 0) + 1;

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-foreground">SINT · Nuevas metas y sus badges</h2>
      <p className="mb-4 text-xs text-muted">
        Agrega o quita nuevas metas en cada aspiración y define su foco estratégico, alternativas y tipo de recursos
        necesarios. Se muestran en el tablero <a href="/nuevas-metas" className="text-brand-dark underline">Nuevas metas</a>.
      </p>
      {!loaded ? (
        <p className="text-sm text-muted">Cargando las nuevas metas…</p>
      ) : (
        <div className="space-y-6">
          {aspirations.map((a) => {
            const tone = aspClasses(a.number);
            return (
              <section key={a.id}>
                <h3 className={`mb-2 text-xs font-bold uppercase tracking-wide ${tone.text}`}>
                  Aspiración {a.number} · {ARCHETYPE_LABEL[a.number] ?? ""} — <span className="normal-case">{a.name}</span>
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {metas
                    .filter((m) => m.aspiracion === a.number)
                    .map((m) => (
                      <MetaCard key={m.key} meta={m} toneBorder={tone.border} badges={badges.filter((b) => b.meta_key === m.key)} />
                    ))}
                  <AddMetaForm aspiracion={a.number} orden={nextOrden} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddMetaForm({ aspiracion, orden }: { aspiracion: number; orden: number }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addMeta(aspiracion, value, orden);
      setText("");
    } catch (e) {
      console.error(e);
      setError("No se pudo agregar la meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col justify-center gap-1 rounded-lg border border-dashed border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nueva meta para esta aspiración…"
          aria-label={`Nueva meta para la aspiración ${aspiracion}`}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-brand-dark"
        />
        <button
          type="submit"
          disabled={!text.trim() || saving}
          className="shrink-0 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-dark disabled:opacity-40"
        >
          + Meta
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </form>
  );
}

function MetaCard({ meta, toneBorder, badges }: { meta: NuevaMeta; toneBorder: string; badges: NuevaMetaBadge[] }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={`rounded-lg border-l-4 ${toneBorder} border-y border-r border-y-border border-r-border bg-card p-3 shadow-sm`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{meta.texto}</p>
        {confirming ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px]">
            <span className="text-muted">¿Quitar meta{badges.length > 0 ? ` y sus ${badges.length} badges` : ""}?</span>
            <button
              type="button"
              className="rounded bg-red-600 px-1.5 py-0.5 font-semibold text-white"
              onClick={() =>
                deleteMeta(meta.key).catch((e) => {
                  console.error(e);
                  setError("No se pudo quitar la meta.");
                  setConfirming(false);
                })
              }
            >
              Sí
            </button>
            <button type="button" className="rounded bg-black/5 px-1.5 py-0.5 font-semibold" onClick={() => setConfirming(false)}>
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted hover:bg-red-50 hover:text-red-600"
          >
            Quitar
          </button>
        )}
      </div>
      {error && <p className="mb-1 text-[11px] text-red-600">{error}</p>}
      <div className="space-y-2">
        {BADGE_TIPOS.map((t) => (
          <BadgeRow
            key={t.tipo}
            metaKey={meta.key}
            tipo={t.tipo}
            label={`${t.icon} ${t.label}`}
            chip={t.chip}
            badges={badges.filter((b) => b.tipo === t.tipo)}
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
}: {
  metaKey: string;
  tipo: BadgeTipo;
  label: string;
  chip: string;
  badges: NuevaMetaBadge[];
}) {
  const [error, setError] = useState<string | null>(null);
  const roots = badges.filter((b) => b.parent_id === null);
  const fail = (msg: string) => (e: unknown) => {
    console.error(e);
    setError(msg);
  };

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-muted">{label}</p>
      <div className="space-y-1.5">
        {roots.map((b) => {
          const hijos = badges.filter((h) => h.parent_id === b.id);
          return (
            <div key={b.id}>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${chip}`}>
                {b.label}
                <button
                  type="button"
                  aria-label={`Quitar ${b.label}${hijos.length > 0 ? " y sus hijos" : ""}`}
                  title={hijos.length > 0 ? "Quita el badge y sus hijos" : "Quitar"}
                  className="leading-none opacity-60 hover:opacity-100"
                  onClick={() => deleteBadge(b.id).catch(fail("No se pudo quitar el badge."))}
                >
                  ×
                </button>
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-1 pl-4">
                {hijos.map((h) => (
                  <span
                    key={h.id}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                      h.alerta ? "border-red-600 bg-red-600 font-semibold text-white" : "border-border bg-card text-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={h.alerta}
                      title={h.alerta ? "Quitar la marca roja" : "Marcar en rojo"}
                      onClick={() => setBadgeAlerta(h.id, !h.alerta).catch(fail("No se pudo cambiar la marca."))}
                    >
                      ↳ {h.label}
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar ${h.label}`}
                      className="leading-none opacity-60 hover:opacity-100"
                      onClick={() => deleteBadge(h.id).catch(fail("No se pudo quitar el hijo."))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <AddInput
                  placeholder="Agregar hijo…"
                  ariaLabel={`Agregar hijo a ${b.label}`}
                  small
                  onAdd={(value) => addBadge(metaKey, tipo, value, b.id)}
                  onError={fail("No se pudo guardar el hijo.")}
                />
              </div>
            </div>
          );
        })}
        <AddInput
          placeholder="Agregar…"
          ariaLabel={`Agregar ${label}`}
          suggestions={tipo === "recurso" ? RECURSO_SUGERENCIAS : undefined}
          listId={`sint-${metaKey}-${tipo}`}
          onAdd={(value) => addBadge(metaKey, tipo, value)}
          onError={fail("No se pudo guardar el badge.")}
        />
      </div>
      {roots.some((b) => badges.some((h) => h.parent_id === b.id)) && (
        <p className="mt-1 text-[10px] text-muted">Haz clic en un hijo para marcarlo o desmarcarlo en rojo.</p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function AddInput({
  placeholder,
  ariaLabel,
  onAdd,
  onError,
  small,
  suggestions,
  listId,
}: {
  placeholder: string;
  ariaLabel: string;
  onAdd: (value: string) => Promise<void>;
  onError: (e: unknown) => void;
  small?: boolean;
  suggestions?: string[];
  listId?: string;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onAdd(value);
      setText("");
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
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
        list={suggestions ? listId : undefined}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`${small ? "w-28 text-[11px]" : "w-32 text-xs"} rounded-md border border-border bg-background px-2 py-0.5 outline-none focus:border-brand-dark`}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
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
  );
}
