"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Source_Serif_4, Archivo_Narrow } from "next/font/google";
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

const serifPress = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600", "800", "900"], style: ["normal", "italic"] });
const sansPress = Archivo_Narrow({ subsets: ["latin"], weight: ["400", "600", "700"] });

// Fotos por defecto del "Recorte de prensa": no se suben desde la sesión — son fijas, tomadas
// de una sesión real del equipo Socya (ver C:\Desarrollos\estrategia\Recorte), igual que pediría
// el diseño original en Recorte/Recorte de prensa.dc.html.
const FOTOS_POR_DEFECTO = ["/vision-2029/foto-1.jpg", "/vision-2029/foto-2.jpg"];

// Mención especial fija a Verónica de Vivero Acevedo, con las 4 fotos del equipo (Vero 1 a
// Vero 4) — Vero 4 va a ancho completo, como pidió el facilitador.
const VERO_FOTOS_FILA = ["/vision-2029/vero-1.jpg", "/vision-2029/vero-3.jpg", "/vision-2029/vero-6.jpg"];
const VERO_FOTO_ANCHA = "/vision-2029/vero-5.jpg";
// Foto(s) que no se usaron en la mención de honor — se alternan en las noticias del equipo
// (cada nota, según su posición en la lista, sección "Noticias de nuestro equipo").
const NOTICIAS_FOTOS_ALTERNAS = ["/vision-2029/vero-4.jpg"];

const MENCION_VERONICA = {
  kicker: "Mención especial · De parte de Socya",
  titulo: "El éxito del Plan Estratégico 2029 de la Fundación Socya: el fruto de la semilla que sembró Verónica de Vivero Acevedo",
  entradilla:
    "Al cierre del ciclo estratégico a 2029, la organización celebra el cumplimiento histórico de sus metas socioambientales, cimentado en la visión y hoja de ruta consolidadas por De Vivero Acevedo durante su gestión ejecutiva que culminó en octubre de 2026.",
  parrafos: [
    "MEDELLÍN, Colombia (Cierre de 2029) — Tras culminar con éxito la ejecución de su Plan Estratégico 2029, la Fundación Socya celebra hoy una transformación histórica en su impacto socioambiental. Al revisar el camino recorrido durante la última década, la institución destaca que el cumplimiento de estos hitos fue posible gracias a las bases estratégicas sembradas por Verónica de Vivero Acevedo, quien ejerció como Directora Ejecutiva hasta octubre de 2026.",
    "Aquella visión de futuro, que en su momento reorganizó los pilares operativos de la entidad y potenció su modelo de gestión territorial, permitió que la fundación no solo alcanzara, sino que superara cada una de las metas proyectadas para el horizonte 2029.",
  ],
  subtitulo2: "La semilla de 2026: el origen del impacto alcanzado",
  parrafo3:
    "Entre los años de su gestión y su salida en octubre de 2026, Verónica de Vivero Acevedo se enfocó en diseñar una estructura organizacional resiliente y adaptable. Bajo su liderazgo, se articuló una red de alianzas público-privadas y se aceleró la transición hacia modelos de economía circular aplicada, dejando listos los catalizadores que impulsarían el crecimiento de la fundación en los años posteriores.",
  cita:
    'Cuando proyectamos los objetivos al 2029, sabíamos que la clave no estaba solo en la meta final, sino en sembrar las capacidades operativas, humanas y financieras desde el primer día. Mirar atrás y ver cómo esa semilla rindió sus frutos para el bienestar de miles de comunidades reafirma el valor del liderazgo con propósito.',
  citaAtribucion: "Parte del legado conceptual que dejó De Vivero Acevedo al concluir su periodo directivo en 2026",
  subtitulo3: "Objetivos 2029: de la visión a los resultados logrados",
  hitosIntro: "Gracias a la hoja de ruta trazada en aquella gestión, la Fundación Socya presenta hoy un balance histórico con los siguientes logros consolidados al cierre de 2029:",
  hitos: [
    {
      etiqueta: "Consolidación del ecosistema de Economía Circular",
      texto:
        "La organización logró escalar sus modelos de Negocios Circulares a nivel nacional, reincorporando cientos de miles de toneladas de materiales al ciclo productivo e integrando a recicladores de oficio en cadenas de valor formalizadas.",
    },
    {
      etiqueta: "Transformación territorial y gestión del agua",
      texto: "Se garantizó la seguridad hídrica y el desarrollo comunitario en decenas de cuencas estratégicas de Colombia, mediante metodologías de conservación participativa que fueron diseñadas e impulsadas durante la gestión de Verónica.",
    },
    {
      etiqueta: "Red intersectorial consolidada",
      texto: "El modelo de alianzas con propósito logró vincular a los principales actores del sector privado, entidades territoriales y cooperación internacional, convirtiendo a Socya en el articulador socioambiental por excelencia del país.",
    },
    {
      etiqueta: "Sostenibilidad e innovación institucional",
      texto: "La solidez financiera y la modernización de procesos instauradas a partir de 2026 permitieron a la fundación mantener un crecimiento auto-sostenible y una ejecución transparente a lo largo de todo el periodo.",
    },
  ],
  cierreSubtitulo: "Un modelo de gestión para la historia",
  cierre:
    "El éxito alcanzado en este 2029 demuestra que los grandes logros institucionales se construyen con visión de largo plazo. La Fundación Socya inicia ahora una nueva etapa, respaldada por la certeza de que el liderazgo transformador de Verónica de Vivero Acevedo marcó un antes y un después en la historia del desarrollo sostenible en Colombia.",
};

// La portada de periódico completa: antes de publicar, el facilitador ve una "sala de
// redacción" a pantalla completa con un único botón — el momento de publicar es el que se
// proyecta a toda la sala, así que tiene que sentirse como un evento (destello + portada que
// "cae" en su lugar), no como un simple cambio de estado. Cada publicación nueva recibe su
// propio `publishedAt`, que se usa como `key` de la portada para que React la vuelva a montar
// (y así la animación se repita) cada vez que el facilitador saca una edición nueva.
//
// El maquetado de la edición publicada sigue el diseño de "Recorte de prensa" que ya se había
// construido aparte (Recorte/Recorte de prensa.dc.html): masthead con el logo de Socya,
// recuadro "destacado" arriba a la derecha, titular principal con dos fotos fijas, y el resto de
// noticias en una cuadrícula tipo columnas de diario — reimplementado aquí en React/Tailwind en
// vez del formato de mockup (x-dc/sc-if/sc-for) en el que se diseñó originalmente.
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
  // La nota destacada (📌) es el titular principal de portada; la siguiente sin destacar hace
  // de "destacado" en el recuadro superior; el resto llena la cuadrícula de noticias.
  const lead = notes.find((n) => n.highlighted) ?? notes[0];
  const others = notes.filter((n) => n.id !== lead?.id);
  const destacado = others[0];
  const noticias = others.slice(1);
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
    <div className="min-h-screen bg-[#e9e6df] px-4 py-8 sm:px-8">
      {flash && <div className="animate-news-flash pointer-events-none fixed inset-0 z-50 bg-white" />}
      <div className="mx-auto flex max-w-[980px] items-center justify-between gap-3 pb-4 text-[#6b665b]">
        <span className={`${sansPress.className} text-xs`}>
          {session.code} · {session.name}
        </span>
        <button
          onClick={backToNewsroom}
          className={`${sansPress.className} rounded-full border border-[#c9c3b3] px-3 py-1.5 text-xs font-semibold text-[#4a463c] hover:bg-black/5`}
        >
          ✏️ Volver a redacción
        </button>
      </div>

      <article
        key={content.publishedAt}
        lang="es"
        className={`${serifPress.className} animate-news-press mx-auto box-border max-w-[980px] bg-[#fbfaf6] p-6 text-[#161616] shadow-2xl sm:p-10`}
      >
        {/* Encabezado: logo de Socya a la izquierda, recuadro "destacado" a la derecha —
            mismo maquetado de dos columnas de Recorte/Recorte de prensa.dc.html. */}
        <header className="grid gap-4 sm:grid-cols-[220px_1fr] sm:gap-6">
          <div className="flex flex-col justify-end gap-2">
            <div className="flex items-end gap-2">
              <Image src="/socya-logo.png" alt="Socya" width={220} height={92} className="h-16 w-auto sm:h-20" />
              <span className="mb-1 h-3 w-3 rounded-full bg-brand" />
            </div>
            <p className={`${sansPress.className} text-lg font-bold uppercase leading-none tracking-wide text-[#161616] sm:text-2xl`}>
              Visión 2029
            </p>
          </div>
          <div className="grid grid-cols-1 border border-[#d9d4c8] bg-[#efece4] sm:grid-cols-[1fr_150px]">
            <div className="flex min-w-0 flex-col gap-1.5 p-3">
              <div className={`${sansPress.className} leading-tight`}>
                <div className="text-sm font-bold uppercase">{dateLabel || "Edición especial"}</div>
                <div className="text-sm">{session.code} · {session.name}</div>
              </div>
              {destacado ? (
                <>
                  <h2 className="m-0 text-lg font-semibold leading-tight text-[#1f3b57]" style={{ textWrap: "pretty" }}>
                    {destacado.text}
                  </h2>
                  <p className={`${sansPress.className} m-0 text-[11px] leading-tight`}>Por {destacado.author}</p>
                </>
              ) : (
                <h2 className="m-0 text-lg font-semibold leading-tight text-[#1f3b57]">
                  {notes.length} {notes.length === 1 ? "noticia publicada" : "noticias publicadas"} desde el futuro
                </h2>
              )}
            </div>
            <div className="hidden bg-dark sm:flex sm:items-center sm:justify-center">
              <Image src="/socya-logo.png" alt="" width={72} height={30} className="h-8 w-auto brightness-0 invert opacity-80" />
            </div>
          </div>
        </header>

        {/* Mención especial: contenido fijo de la organización, presente en toda edición sin
            importar lo que el grupo escriba en la actividad — con las 4 fotos del equipo en
            medio del artículo, Vero 4 a ancho completo. */}
        <section className="mt-5 border-b-2 border-[#1f3b57] pb-5">
          <p className={`${sansPress.className} m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b3261e]`}>
            ★ {MENCION_VERONICA.kicker}
          </p>
          <h2 className="m-0 mt-1.5 text-2xl font-bold leading-tight text-[#161616] sm:text-3xl" style={{ textWrap: "pretty" }}>
            {MENCION_VERONICA.titulo}
          </h2>
          <p className={`${sansPress.className} m-0 mt-2 text-base leading-snug text-[#1f3b57]`} style={{ textWrap: "pretty" }}>
            {MENCION_VERONICA.entradilla}
          </p>

          <div className="mt-3 text-sm leading-snug" style={{ textAlign: "justify", hyphens: "auto" }}>
            {MENCION_VERONICA.parrafos.map((p, i) => (
              <p key={i} className="m-0 mb-3">
                {p}
              </p>
            ))}
          </div>

          {/* Vero 1 a Vero 3, en medio del artículo. */}
          <div className="my-4 grid grid-cols-3 gap-2">
            {VERO_FOTOS_FILA.map((src) => (
              <div key={src} className="relative aspect-[4/3] overflow-hidden bg-[#cfc9bb]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Equipo Socya" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <p className={`${sansPress.className} m-0 mb-4 text-xs italic text-[#6b6151]`}>Fotos: equipo Socya, sesiones de planeación estratégica.</p>

          <h3 className={`${sansPress.className} m-0 mb-2 text-base font-bold uppercase tracking-wide text-[#1f3b57]`}>
            {MENCION_VERONICA.subtitulo2}
          </h3>
          <p className="m-0 mb-3 text-sm leading-snug" style={{ textAlign: "justify", hyphens: "auto" }}>
            {MENCION_VERONICA.parrafo3}
          </p>

          <blockquote className="m-0 mb-4 border-l-4 border-[#b3261e] pl-4 text-base italic leading-snug text-[#1f3b57]">
            “{MENCION_VERONICA.cita}”
            <footer className={`${sansPress.className} mt-1.5 text-xs not-italic text-[#6b6151]`}>— {MENCION_VERONICA.citaAtribucion}</footer>
          </blockquote>

          {/* Vero 4, a ancho completo. */}
          <div className="relative my-4 aspect-[16/9] w-full overflow-hidden bg-[#cfc9bb]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={VERO_FOTO_ANCHA} alt="Equipo Socya en sesión de planeación" className="absolute inset-0 h-full w-full object-cover" />
          </div>

          <h3 className={`${sansPress.className} m-0 mb-2 text-base font-bold uppercase tracking-wide text-[#1f3b57]`}>
            {MENCION_VERONICA.subtitulo3}
          </h3>
          <p className="m-0 mb-2 text-sm leading-snug">{MENCION_VERONICA.hitosIntro}</p>
          <ul className="m-0 mb-4 list-none space-y-2 pl-0 text-sm leading-snug">
            {MENCION_VERONICA.hitos.map((h) => (
              <li key={h.etiqueta} className="border-l-2 border-[#b3261e] pl-2.5">
                <b className="text-[#1f3b57]">{h.etiqueta}:</b> {h.texto}
              </li>
            ))}
          </ul>

          <h3 className={`${sansPress.className} m-0 mb-2 text-base font-bold uppercase tracking-wide text-[#1f3b57]`}>
            {MENCION_VERONICA.cierreSubtitulo}
          </h3>
          <p className="m-0 text-sm leading-snug" style={{ textAlign: "justify", hyphens: "auto" }}>
            {MENCION_VERONICA.cierre}
          </p>
        </section>

        {notes.length === 0 ? (
          <p className={`${sansPress.className} mt-6 text-center text-base italic text-[#8a7f66]`}>
            Aún no hay noticias del equipo en esta edición.
          </p>
        ) : (
          <>
            <p className={`${sansPress.className} mt-6 mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a6d3b]`}>
              Noticias de nuestro equipo
            </p>
            {/* Titular principal: la noticia destacada (📌), con las dos fotos fijas del
                equipo Socya y una entradilla de contexto — no un dato inventado, es la
                introducción fija de esta actividad. */}
            <section className="mt-4 grid gap-4 border-b border-[#161616] pb-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:gap-5 sm:pb-5">
              <div className="flex flex-col gap-2.5">
                <h1 className="m-0 text-4xl font-black leading-[1.02] tracking-tight text-[#161616] sm:text-6xl" style={{ textWrap: "balance" }}>
                  {lead?.text}
                </h1>
                <div className="grid grid-cols-2 gap-1">
                  {FOTOS_POR_DEFECTO.map((src) => (
                    <div key={src} className="relative aspect-[4/5] overflow-hidden bg-[#cfc9bb]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="Equipo Socya" className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
                <p className={`${sansPress.className} m-0 text-xs leading-tight text-[#333]`}>
                  Fotos: equipo Socya <b className="uppercase">· Por {lead?.author}</b>
                </p>
              </div>
              <aside className="flex flex-col gap-3">
                <p className={`${sansPress.className} m-0 text-lg leading-snug text-[#1f3b57]`} style={{ textWrap: "pretty" }}>
                  Así imaginó nuestro equipo a Socya en 2029, con las tres aspiraciones cumplidas.
                </p>
                <p className="m-0 text-sm leading-snug" style={{ textAlign: "justify", hyphens: "auto" }}>
                  <span className="float-left mr-1.5 mt-0.5 text-[38px] font-extrabold leading-[0.85] text-[#1f3b57]">
                    {(lead?.author ?? "S").charAt(0).toUpperCase()}
                  </span>
                  Una visión propuesta durante el ejercicio de imaginación guiada de la sesión {session.code}: cada
                  persona escribió cómo se vería la Fundación con su futuro ya cumplido.
                </p>
              </aside>
            </section>

            {/* Resto de noticias: cuadrícula tipo columnas de diario, tantas como haya —
                sin el límite fijo de 3 del mockup original. */}
            {noticias.length > 0 && (
              <section className="mt-4 grid gap-x-4 gap-y-4 border-b border-[#161616] pb-4 sm:grid-cols-2 lg:grid-cols-3">
                {noticias.map((n, i) => {
                  const foto = NOTICIAS_FOTOS_ALTERNAS.length > 0 ? NOTICIAS_FOTOS_ALTERNAS[i % NOTICIAS_FOTOS_ALTERNAS.length] : null;
                  return (
                    <div
                      key={n.id}
                      className="flex flex-col gap-1.5"
                      style={{ borderLeft: i % 3 === 0 ? "none" : "1px solid #d9d4c8", paddingLeft: i % 3 === 0 ? 0 : 14 }}
                    >
                      {foto && (
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#cfc9bb]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={foto} alt="Equipo Socya" className="absolute inset-0 h-full w-full object-cover" />
                        </div>
                      )}
                      <h3 className="m-0 text-xl font-semibold leading-tight" style={{ textWrap: "pretty" }}>
                        {n.text}
                      </h3>
                      <p className={`${sansPress.className} m-0 text-xs italic`}>Por {n.author}</p>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </article>
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
