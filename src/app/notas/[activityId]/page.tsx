"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRequireParticipant } from "@/lib/useRequireParticipant";
import { isPresenter } from "@/lib/presenter";
import { fetchActivityById, fetchAspirations, fetchSessionById } from "@/lib/data";
import { useSubmission, effectiveAspirationId, fetchLatestContent } from "@/lib/useSubmission";
import NotesBoardView from "@/components/NotesBoardView";
import PriorityLevelChart from "@/components/PriorityLevelChart";
import RotationBoard, { Rotation, EMPTY_ROTATION } from "@/components/RotationBoard";
import { supabase } from "@/lib/supabase";
import { serverNow } from "@/lib/useServerClock";
import { aspAbbrev, aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import { POLARITY_META, type NotePolarity } from "@/components/activities/shared";
import { exportRotationNotesToExcel } from "@/lib/exportExcel";
import type { ActivityRow, Aspiration, SessionRow } from "@/lib/types";
import type { StoredParticipant } from "@/lib/participant";

interface Note {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: "alto" | "medio" | "bajo";
  polarity?: NotePolarity;
  highlighted?: boolean;
}
interface Content extends Record<string, unknown> {
  notes: Note[];
  showOnlyHighlighted: boolean;
  rotation?: Rotation;
}

export default function NotasFullscreenPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const participant = useRequireParticipant();
  const presenter = isPresenter(participant);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchActivityById(Number(activityId)).then((a) => {
      setActivity(a);
      if (a) fetchSessionById(a.session_id).then(setSession).catch(console.error);
    });
  }, [activityId]);

  if (!participant || !activity || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>
    );
  }

  if (!presenter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark px-4 text-center text-sm text-white/60">
        Solo el facilitador puede abrir esta vista ampliada.
      </div>
    );
  }

  // El POAM reutiliza este mismo activity_type ("notas") pero con un tablero de arrastrar y
  // soltar (ConsolidacionImpacto) en vez del flujo clásico de agregar texto — necesita su propia
  // vista ampliada de solo lectura (columnas de impacto + bandeja pendiente), no la de Mundo café.
  // Cada rama abajo llama su propio useSubmission — nunca ambas para la misma actividad, porque
  // Supabase no permite suscribir dos veces al mismo canal de realtime.
  if (activity.config.consolidationFrom) {
    return <ConsolidacionFullscreenBoard activity={activity} session={session} aspirations={aspirations} participant={participant} />;
  }
  // El Cierre también reutiliza "notas", pero con el escalafón de votación (SintesisEntorno) —
  // necesita su propia vista ampliada de solo lectura del ranking, no la de Mundo café.
  if (activity.config.topFrom) {
    return <SintesisFullscreenBoard activity={activity} session={session} aspirations={aspirations} participant={participant} />;
  }
  // "Visión Socya 2029" (y cualquier otra actividad con config.frontPage) usa su propia portada
  // de periódico a pantalla completa, con un botón de publicación que el facilitador dispara en
  // vivo — ver FrontPageBoard.
  if (activity.config.frontPage) {
    return <FrontPageBoard activity={activity} session={session} aspirations={aspirations} participant={participant} />;
  }
  return <MundoCafeFullscreenBoard activity={activity} session={session} aspirations={aspirations} participant={participant} presenter={presenter} />;
}

// Nota tal como la deja NotasColectivas (rama newsStyle) — misma forma, pero aquí además
// necesitamos `media` (fotos que el facilitador sube desde el panel "Fotos y panel visual") y el
// estado de publicación de la edición.
interface FrontPageNote {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  highlighted?: boolean;
}

interface FrontPageContent extends Record<string, unknown> {
  notes: FrontPageNote[];
  media: string[];
  showOnlyHighlighted: boolean;
  published: boolean;
  publishedAt: string | null;
}

// La portada de periódico completa: antes de publicar, el facilitador ve una "sala de
// redacción" a pantalla completa con un único botón — el momento de publicar es el que se
// proyecta a toda la sala, así que tiene que sentirse como un evento (destello + portada que
// "cae" en su lugar), no como un simple cambio de estado. Cada publicación nueva recibe su
// propio `publishedAt`, que se usa como `key` de la portada para que React la vuelva a montar
// (y así la animación se repita) cada vez que el facilitador saca una edición nueva.
function FrontPageBoard({
  activity,
  session,
  aspirations,
  participant,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirations: Aspiration[];
  participant: StoredParticipant;
}) {
  const submissionAspId = effectiveAspirationId(activity, participant);
  const emptyContent: FrontPageContent = { notes: [], media: [], showOnlyHighlighted: false, published: false, publishedAt: null };
  const { content, save, loaded } = useSubmission<FrontPageContent>(activity, session, submissionAspId, participant, emptyContent);
  const [flash, setFlash] = useState(false);

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  async function publish() {
    const latest = await fetchLatestContent<FrontPageContent>(activity.id, submissionAspId, emptyContent);
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    await save({ ...latest, published: true, publishedAt: new Date(serverNow()).toISOString() });
  }
  async function backToNewsroom() {
    const latest = await fetchLatestContent<FrontPageContent>(activity.id, submissionAspId, emptyContent);
    await save({ ...latest, published: false });
  }

  const notes = content.notes;
  const lead = notes.filter((n) => n.highlighted);
  const rest = notes.filter((n) => !n.highlighted);
  const dateLabel = content.publishedAt
    ? new Date(content.publishedAt).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  if (!content.published) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-dark px-6 text-center text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(128,198,18,0.14),transparent_60%)]" />
        <Image src="/socya-logo.png" alt="Socya" width={220} height={92} className="relative h-16 w-auto animate-pulse brightness-0 invert sm:h-20" />
        <div className="relative space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand">Sala de redacción</p>
          <h1 className="text-2xl font-bold sm:text-4xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name} · {notes.length} {notes.length === 1 ? "noticia lista" : "noticias listas"} para imprenta
          </p>
        </div>
        <button
          onClick={publish}
          disabled={notes.length === 0}
          className="relative mt-4 rounded-full bg-brand px-10 py-4 text-lg font-bold text-dark shadow-[0_0_40px_rgba(128,198,18,0.35)] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          title={notes.length === 0 ? "Aún no hay noticias para publicar" : "Publicar la edición para toda la sala"}
        >
          📰 Publicar edición
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark px-4 py-8 sm:px-8">
      {flash && <div className="animate-news-flash pointer-events-none fixed inset-0 z-50 bg-white" />}
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 pb-4 text-white/60">
        <span className="text-xs">
          {session.code} · {session.name}
        </span>
        <button
          onClick={backToNewsroom}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
        >
          ✏️ Volver a redacción
        </button>
      </div>

      <div key={content.publishedAt} className="animate-news-press mx-auto max-w-[1100px] rounded-sm border border-[#d8cfb4] bg-[#faf6ea] p-8 shadow-2xl sm:p-12">
        <div className="text-center">
          <Image src="/socya-logo.png" alt="Socya" width={72} height={30} className="mx-auto h-9 w-auto sm:h-11" />
          <p className="mt-3 font-serif text-4xl font-black uppercase tracking-[0.08em] text-[#2b2620] sm:text-6xl">Socya</p>
          <div className="animate-news-ink-sweep mx-auto mt-3 h-[4px] w-full bg-[#2b2620]" />
          <div className="mx-auto mt-1 h-px w-full bg-[#2b2620]" />
          <p className="mt-2 font-serif text-xs uppercase tracking-[0.25em] text-[#8a6d3b] sm:text-sm">
            Edición especial · {activity.title}
            {dateLabel && <> · {dateLabel}</>}
          </p>
        </div>

        {notes.length === 0 && (
          <p className="mt-10 text-center font-serif text-base italic text-[#8a7f66]">Esta edición salió sin noticias.</p>
        )}

        {lead.length > 0 && (
          <div className="mt-8 grid gap-6 border-b-2 border-[#2b2620] pb-6 sm:grid-cols-[1.3fr_1fr]">
            <div>
              {lead.map((n) => (
                <article key={n.id} className="mb-4">
                  <p className="mb-1 font-serif text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a6d3b]">📌 Portada</p>
                  <h2 className="font-serif text-2xl font-bold leading-tight text-[#2b2620] sm:text-4xl">{n.text}</h2>
                  <p className="mt-2 font-serif text-sm italic text-[#6b6151]">Por {n.author}</p>
                </article>
              ))}
            </div>
            {content.media.length > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.media[0]} alt="Foto de la sesión" className="h-full w-full rounded-sm border border-[#d8cfb4] object-cover" />
            )}
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-6 columns-1 gap-8 sm:columns-2 lg:columns-3" style={{ columnRule: "1px solid #d8cfb4" }}>
            {rest.map((n) => (
              <article key={n.id} className="mb-5 break-inside-avoid border-b border-[#e3dcc7] pb-4">
                <h3 className="font-serif text-lg font-bold leading-snug text-[#2b2620]">{n.text}</h3>
                <p className="mt-1 font-serif text-xs italic text-[#6b6151]">Por {n.author}</p>
              </article>
            ))}
          </div>
        )}

        {content.media.length > 1 && (
          <div className="mt-8 border-t border-[#d8cfb4] pt-6">
            <p className="mb-3 font-serif text-xs font-bold uppercase tracking-[0.14em] text-[#8a6d3b]">Galería de la sesión</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {content.media.slice(1).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Foto de la sesión" className="h-28 w-full rounded-sm border border-[#d8cfb4] object-cover" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MundoCafeFullscreenBoard({
  activity,
  session,
  aspirations,
  participant,
  presenter,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirations: Aspiration[];
  participant: StoredParticipant;
  presenter: boolean;
}) {
  const submissionAspId = effectiveAspirationId(activity, participant);
  const emptyContent: Content = { notes: [], showOnlyHighlighted: false };
  const { content, save, loaded } = useSubmission<Content>(activity, session, submissionAspId, participant, emptyContent);
  const categories = (activity.config.categories as { key: string; label: string }[]) ?? [];

  // Igual que en el tablero en vivo (NotasColectivas): al terminar la rotación no se borra
  // nada, pero si esta pantalla proyectada es la que el facilitador usa como control, también
  // se lleva su propia copia en Excel apenas la rotación llega a "done".
  const rotationStatus = content.rotation?.status ?? "idle";
  const autoExportedRef = useRef(false);
  useEffect(() => {
    if (!presenter) return;
    if (rotationStatus === "done") {
      if (!autoExportedRef.current) {
        autoExportedRef.current = true;
        exportRotationNotesToExcel({ activityTitle: activity.title, categories, notes: content.notes, aspirations });
      }
    } else {
      autoExportedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotationStatus, presenter]);

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  const impactLevels = Boolean(activity.config.impactLevels);
  const rotationMinutes = Number(activity.config.rotationMinutes) || 0;
  const totalNotes = content.notes.length;

  // Mismos controles que en el tablero en vivo (NotasColectivas) — esta vista ampliada es
  // justo la que se proyecta a toda la sala durante un Mundo café, así que necesita poder
  // arrancar/pausar/avanzar la rotación igual, no solo mostrarla. Igual que allá: vuelve a leer
  // el contenido más reciente antes de guardar, para no pisar notas que otros acaban de agregar
  // si esta pestaña (que suele quedar proyectada y sin interacción por buen rato) perdió por un
  // momento la suscripción de tiempo real.
  const rotation = content.rotation ?? EMPTY_ROTATION;
  async function saveRotation(next: Rotation) {
    const latest = await fetchLatestContent<Content>(activity.id, submissionAspId, emptyContent);
    await save({ ...latest, rotation: next });
  }
  function startRotationRound(round: number) {
    saveRotation({ round, status: "running", endAt: new Date(serverNow() + rotationMinutes * 60_000).toISOString(), remainingSeconds: null });
  }
  function pauseRotation() {
    const remaining = rotation.endAt ? Math.max(0, Math.round((new Date(rotation.endAt).getTime() - serverNow()) / 1000)) : rotationMinutes * 60;
    saveRotation({ ...rotation, status: "paused", endAt: null, remainingSeconds: remaining });
  }
  function resumeRotation() {
    const secs = rotation.remainingSeconds ?? rotationMinutes * 60;
    saveRotation({ ...rotation, status: "running", endAt: new Date(serverNow() + secs * 1000).toISOString(), remainingSeconds: null });
  }
  function nextTable() {
    if (rotation.round >= categories.length) {
      saveRotation({ ...rotation, status: "done", endAt: null, remainingSeconds: null });
    } else {
      startRotationRound(rotation.round + 1);
    }
  }
  function resetRotation() {
    saveRotation(EMPTY_ROTATION);
  }

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {totalNotes} {totalNotes === 1 ? "aporte" : "aportes"}
        </span>
      </div>

      <div className="mx-auto mt-6 max-w-[1400px]">
        {rotationMinutes > 0 && categories.length > 0 && (
          <RotationBoard
            rotation={rotation}
            minutesPerRound={rotationMinutes}
            tableCount={categories.length}
            activeLabel={categories[Math.min(rotation.round, categories.length) - 1]?.label ?? ""}
            nextLabel={categories[rotation.round]?.label ?? null}
            presenter={presenter}
            onStart={() => startRotationRound(1)}
            onPause={pauseRotation}
            onResume={resumeRotation}
            onNext={nextTable}
            onReset={resetRotation}
            large
            dark
          />
        )}
      </div>

      <div className="mx-auto mt-6 max-w-[1400px]">
        {totalNotes === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 py-24 text-center">
            <span className="text-3xl">🗒️</span>
            <p className="text-sm text-white/40">Aún no hay aportes registrados en esta actividad.</p>
          </div>
        ) : (
          <>
            {impactLevels && <PriorityLevelChart categories={categories} notes={content.notes} dark />}
            <NotesBoardView
              categories={categories}
              notes={content.notes}
              aspirations={aspirations}
              showOnlyHighlighted={content.showOnlyHighlighted}
              newsStyle={Boolean(activity.config.newsStyle)}
              large
              dark
            />
          </>
        )}
      </div>
    </div>
  );
}

// Nota cruda tal como la deja Mundo café — la misma forma que lee ConsolidacionImpacto.tsx
// (config.polarityTags + selectableAspiration).
interface SourceNote {
  id: string;
  text: string;
  author: string;
  polarity?: NotePolarity;
  aspiration_id: number | null;
}

interface ImpactNote {
  id: string;
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact: "alto" | "medio" | "bajo";
  polarity?: NotePolarity;
  sourceNoteId?: string;
}

interface ImpactContent extends Record<string, unknown> {
  notes: ImpactNote[];
}

const IMPACT_COLUMNS: { key: ImpactNote["impact"]; label: string }[] = [
  { key: "alto", label: "🔴 Impacto alto" },
  { key: "medio", label: "🟡 Impacto medio" },
  { key: "bajo", label: "⚪ Impacto bajo" },
];

// Vista de solo lectura del avance del POAM (o cualquier actividad que use el tablero de
// arrastrar y soltar): mismo dato que el tablero en vivo, pero proyectable en la sala sin
// controles de edición — así el grupo ve en tiempo real cuánto falta por clasificar.
function ConsolidacionFullscreenBoard({
  activity,
  session,
  aspirations,
  participant,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirations: Aspiration[];
  participant: StoredParticipant;
}) {
  const consolidationFrom = activity.config.consolidationFrom as number | undefined;
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, loaded } = useSubmission<ImpactContent>(activity, session, submissionAspId, participant, { notes: [] });
  const [sourceNotes, setSourceNotes] = useState<SourceNote[]>([]);
  const [activeAspId, setActiveAspId] = useState<number | "all">(() => aspirations[0]?.id ?? "all");
  const [activeTab, setActiveTab] = useState<NotePolarity>("oportunidad");

  useEffect(() => {
    if (!consolidationFrom) return;
    async function fetchSource() {
      const { data } = await supabase
        .from("submissions")
        .select("content")
        .eq("activity_id", consolidationFrom)
        .is("aspiration_id", null)
        .maybeSingle();
      setSourceNotes(((data?.content as { notes?: SourceNote[] } | null)?.notes) ?? []);
    }
    fetchSource();
    const channel = supabase
      .channel(`consolidacion-fullscreen-${consolidationFrom}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${consolidationFrom}` },
        () => fetchSource()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [consolidationFrom]);

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  const matchesAsp = (id: number | null) => activeAspId === "all" || id === activeAspId;
  const classifiedInAsp = content.notes.filter((n) => matchesAsp(n.aspiration_id));
  const classified = classifiedInAsp.filter((n) => (n.polarity ?? n.category) === activeTab);
  const classifiedSourceIds = new Set(classifiedInAsp.map((n) => n.sourceNoteId).filter(Boolean));
  const poolInAsp = sourceNotes.filter((n) => matchesAsp(n.aspiration_id) && !classifiedSourceIds.has(n.id));
  const pool = poolInAsp.filter((n) => (n.polarity ?? "oportunidad") === activeTab);
  const totalInAsp = classifiedInAsp.length + poolInAsp.length;

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {classifiedInAsp.length} de {totalInAsp} clasificados
        </span>
      </div>

      {aspirations.length > 0 && (
        <div className="mx-auto mt-6 flex max-w-[1400px] flex-wrap gap-2">
          <button
            onClick={() => setActiveAspId("all")}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              activeAspId === "all"
                ? "border-transparent bg-brand text-dark"
                : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            📊 Todas
          </button>
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setActiveAspId(a.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}

      <div className="mx-auto mt-3 flex max-w-[1400px] flex-wrap gap-2">
        {(Object.keys(POLARITY_META) as NotePolarity[]).map((key) => {
          const meta = POLARITY_META[key];
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                active ? meta.selectedCls + " border-transparent" : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
              }`}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-6 max-w-[1400px]">
        <PriorityLevelChart
          categories={[
            { key: "oportunidad", label: "Oportunidades" },
            { key: "amenaza", label: "Amenazas" },
          ]}
          notes={classifiedInAsp}
          dark
        />
      </div>

      <div className="mx-auto mt-2 grid max-w-[1400px] gap-4 md:grid-cols-3">
        {IMPACT_COLUMNS.map((col) => {
          const notesInCol = classified.filter((n) => n.impact === col.key);
          return (
            <div key={col.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 text-sm font-semibold text-white/80">
                {col.label} ({notesInCol.length})
              </p>
              <div className="flex flex-col gap-2">
                {notesInCol.length === 0 && <p className="text-xs text-white/30">Sin elementos.</p>}
                {notesInCol.map((n) => (
                  <div key={n.id} className="rounded-md border border-white/10 bg-white/[0.04] p-2.5 text-sm">
                    <p className="break-words text-white/90">{n.text}</p>
                    <p className="mt-1 text-[11px] text-white/40">
                      {aspAbbrev(aspirations, n.aspiration_id) ?? "—"} · {n.author}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {pool.length > 0 && (
        <div className="mx-auto mt-6 max-w-[1400px] rounded-2xl border border-dashed border-white/15 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Por clasificar ({pool.length})</p>
          <div className="flex flex-wrap gap-2">
            {pool.map((n) => (
              <span key={n.id} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/60">
                {n.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Nota clasificada del POAM con impact "alto" — mismo dato que lee SintesisEntorno.tsx.
interface PoamNote {
  id: string;
  text: string;
  author: string;
  category: string;
  impact?: "alto" | "medio" | "bajo";
  aspiration_id: number | null;
}

interface Vote {
  participant_id: string;
  candidate_id: string;
}

interface SintesisContent extends Record<string, unknown> {
  votes: Vote[];
}

const PLURAL_LABEL: Record<NotePolarity, string> = { oportunidad: "Oportunidades", amenaza: "Amenazas" };

// Vista de solo lectura del escalafón del Cierre: mismo dato y mismo criterio de desempate que
// SintesisEntorno.tsx (empates en la frontera del top N se muestran todos con 🏆), pero
// proyectable en la sala sin los botones de votar.
function SintesisFullscreenBoard({
  activity,
  session,
  aspirations,
  participant,
}: {
  activity: ActivityRow;
  session: SessionRow;
  aspirations: Aspiration[];
  participant: StoredParticipant;
}) {
  const topFrom = activity.config.topFrom as number | undefined;
  const topN = (activity.config.topN as number) || 3;
  const submissionAspId = effectiveAspirationId(activity, participant);
  const { content, loaded } = useSubmission<SintesisContent>(activity, session, submissionAspId, participant, { votes: [] });
  const [source, setSource] = useState<PoamNote[]>([]);
  const [activeAspId, setActiveAspId] = useState<number | "all">(() => aspirations[0]?.id ?? "all");

  useEffect(() => {
    if (!topFrom) return;
    async function fetchSource() {
      const { data } = await supabase
        .from("submissions")
        .select("content")
        .eq("activity_id", topFrom)
        .is("aspiration_id", null)
        .maybeSingle();
      const notes = ((data?.content as { notes?: PoamNote[] } | null)?.notes) ?? [];
      setSource(notes.filter((n) => n.impact === "alto"));
    }
    fetchSource();
    const channel = supabase
      .channel(`sintesis-fullscreen-${topFrom}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `activity_id=eq.${topFrom}` },
        () => fetchSource()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [topFrom]);

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-dark text-sm text-white/60">Cargando…</div>;
  }

  const matchesAsp = (id: number | null) => activeAspId === "all" || id === activeAspId;

  function Column({ categoryKey }: { categoryKey: NotePolarity }) {
    const meta = POLARITY_META[categoryKey];
    // El corte de top 3 se calcula sobre el universo completo de la categoría (las tres
    // aspiraciones), igual que en SintesisEntorno.tsx — así el trofeo coincide siempre con el
    // top 3 real, sin importar qué pestaña de aspiración se esté mirando.
    const allInCategory = source.filter((n) => n.category === categoryKey);
    const globalRanked = allInCategory
      .map((c) => ({ c, votes: content.votes.filter((v) => v.candidate_id === c.id).length }))
      .sort((a, b) => b.votes - a.votes);
    const cutoffVotes = allInCategory.length > topN ? globalRanked[topN - 1]?.votes ?? 0 : 0;
    const isWinner = (votes: number) => votes > 0 && votes >= cutoffVotes;

    const candidates = allInCategory.filter((n) => matchesAsp(n.aspiration_id));
    const ranked = candidates
      .map((c) => ({ c, votes: content.votes.filter((v) => v.candidate_id === c.id).length }))
      .sort((a, b) => b.votes - a.votes);

    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 text-sm font-semibold text-white/80">
          {meta.icon} {PLURAL_LABEL[categoryKey]}
        </p>
        {candidates.length === 0 ? (
          <p className="text-xs text-white/30">Aún no hay {PLURAL_LABEL[categoryKey].toLowerCase()} de alto impacto para esta vista.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ranked.map(({ c, votes }) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.04] p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="break-words text-white/90">
                    {isWinner(votes) ? "🏆 " : ""}
                    {c.text}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {c.author}
                    {activeAspId === "all" && (
                      <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/60">
                        {aspAbbrev(aspirations, c.aspiration_id) ?? "—"}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-brand">
                  {votes} {votes === 1 ? "voto" : "votos"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(circle_at_50%_0%,rgba(128,198,18,0.08),transparent_60%)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <Image src="/socya-logo.png" alt="Socya" width={100} height={42} className="h-9 w-auto brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          <p className="text-sm text-white/50">
            {session.code} · {session.name}
          </p>
        </div>
      </div>

      {aspirations.length > 0 && (
        <div className="mx-auto mt-6 flex max-w-[1400px] flex-wrap gap-2">
          <button
            onClick={() => setActiveAspId("all")}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              activeAspId === "all"
                ? "border-transparent bg-brand text-dark"
                : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            📊 Todas
          </button>
          {aspirations.map((a) => {
            const cls = aspClasses(a.number);
            const active = activeAspId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setActiveAspId(a.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? `border-transparent ${cls.bg} text-dark` : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
                }`}
              >
                Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
              </button>
            );
          })}
        </div>
      )}

      <div className="mx-auto mt-6 grid max-w-[1400px] gap-4 md:grid-cols-2">
        <Column categoryKey="oportunidad" />
        <Column categoryKey="amenaza" />
      </div>
    </div>
  );
}
