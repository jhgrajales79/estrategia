// Homologación del radar de contexto: una evaluación independiente que gestiona solo el
// facilitador, en ningún momento leída ni escrita por la lógica del radar en vivo (señales/votos).
// Se guarda en content.homologacion, una clave separada dentro de la misma submission.
//
// Cada señal se mantiene SEPARADA (nunca se combinan varias en un solo texto): así se conserva
// la calificación (votos) propia de cada una, y el eje/anillo (la evaluación) no se toca.

export interface HomologacionSignal {
  id?: string;
  axis: string;
  ring: number;
  text: string;
  score?: number;
}

export function cellKey(axisKey: string, ring: number) {
  return `${axisKey}:${ring}`;
}

// Formato esperado:
// <homologacion><senal eje="politico" anillo="0" calificacion="3">Texto…</senal>...</homologacion>
// "eje" debe coincidir con la key del eje (config.axes[].key), "anillo" es el índice del anillo
// (0,1,2) y "calificacion" es opcional (por defecto 0).
export function parseHomologacionXml(xmlText: string): HomologacionSignal[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("El XML no es válido (no se pudo interpretar).");
  }
  const nodes = Array.from(doc.getElementsByTagName("senal"));
  const result: HomologacionSignal[] = [];
  for (const n of nodes) {
    const axis = n.getAttribute("eje")?.trim();
    const ringRaw = n.getAttribute("anillo");
    const ring = ringRaw !== null ? Number(ringRaw) : NaN;
    const text = (n.textContent ?? "").trim();
    if (!axis || Number.isNaN(ring) || ring < 0 || ring > 2 || !text) continue;
    const scoreRaw = n.getAttribute("calificacion");
    const score = scoreRaw !== null ? Number(scoreRaw) : 0;
    const id = n.getAttribute("id")?.trim() || undefined;
    result.push({ id, axis, ring, text, score: Number.isNaN(score) ? 0 : score });
  }
  if (result.length === 0) {
    throw new Error(
      'El XML no tiene señales válidas. Formato esperado: <homologacion><senal eje="politico" anillo="0" calificacion="0">Texto…</senal></homologacion>'
    );
  }
  return result;
}

interface RawSignal {
  id?: string;
  axis: string;
  ring: number;
  text: string;
}
interface RawVote {
  signal_id: string;
  points: number;
}

// Además del XML de homologación, se acepta el propio JSON de respaldo que exporta esta app
// (botón "⬇ Exportar" de la actividad): cada señal cruda del radar en vivo se trae SEPARADA
// (no se agrupan ni combinan varias en un eje+anillo), junto con su calificación real (la suma
// de votos que recibió en el radar en vivo). El eje y el anillo se conservan tal como quedaron
// registrados — la evaluación no se mueve ni se corrige aquí.
export function parseHomologacionSource(fileText: string, activityId: number): HomologacionSignal[] {
  const trimmed = fileText.trim();
  if (trimmed.startsWith("<")) return parseHomologacionXml(fileText);

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error("El archivo no es XML ni JSON válido.");
  }
  const rows = (data as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) {
    throw new Error("El JSON no tiene el formato esperado (falta 'rows'). ¿Es un respaldo exportado desde esta app?");
  }
  const row = rows.find((r) => (r as { activity_id?: number }).activity_id === activityId) as
    | { content?: { signals?: RawSignal[]; votes?: RawVote[] } }
    | undefined;
  const signals = row?.content?.signals;
  if (!Array.isArray(signals) || signals.length === 0) {
    throw new Error("El archivo no tiene señales del radar en vivo para esta actividad.");
  }
  const votes = row?.content?.votes ?? [];
  const voteTotal = new Map<string, number>();
  for (const v of votes) {
    if (typeof v.signal_id !== "string") continue;
    voteTotal.set(v.signal_id, (voteTotal.get(v.signal_id) ?? 0) + (Number(v.points) || 0));
  }

  return signals
    .filter((s) => typeof s.axis === "string" && typeof s.ring === "number" && typeof s.text === "string")
    .map((s) => ({
      id: s.id,
      axis: s.axis,
      ring: s.ring,
      text: s.text,
      score: voteTotal.get(s.id ?? "") ?? 0,
    }));
}
