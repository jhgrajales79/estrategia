// Homologación del radar de contexto: una evaluación independiente que gestiona solo el
// facilitador, en ningún momento leída ni escrita por la lógica del radar en vivo (señales/votos).
// Se guarda en content.homologacion, una clave separada dentro de la misma submission.

export interface HomologacionSignal {
  axis: string;
  ring: number;
  text: string;
}

export function cellKey(axisKey: string, ring: number) {
  return `${axisKey}:${ring}`;
}

// Formato esperado: <homologacion><senal eje="politico" anillo="0">Texto…</senal>...</homologacion>
// "eje" debe coincidir con la key del eje (config.axes[].key) y "anillo" es el índice del anillo (0,1,2).
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
    result.push({ axis, ring, text });
  }
  if (result.length === 0) {
    throw new Error(
      'El XML no tiene señales válidas. Formato esperado: <homologacion><senal eje="politico" anillo="0">Texto…</senal></homologacion>'
    );
  }
  return result;
}

interface RawSignal {
  axis: string;
  ring: number;
  text: string;
}

// Además del XML de homologación, se acepta el propio JSON de respaldo que exporta esta app
// (botón "⬇ Exportar" de la actividad): agrupa las señales crudas del radar en vivo por eje y
// anillo, y las deja como una lista numerada por celda — un punto de partida para homologar,
// sin perder ningún aporte y sin mover ninguna señal de anillo (la evaluación no cambia).
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
    | { content?: { signals?: RawSignal[] } }
    | undefined;
  const signals = row?.content?.signals;
  if (!Array.isArray(signals) || signals.length === 0) {
    throw new Error("El archivo no tiene señales del radar en vivo para esta actividad.");
  }

  const grouped = new Map<string, string[]>();
  for (const s of signals) {
    if (typeof s.axis !== "string" || typeof s.ring !== "number" || typeof s.text !== "string") continue;
    const key = cellKey(s.axis, s.ring);
    const list = grouped.get(key) ?? [];
    if (!list.includes(s.text)) list.push(s.text);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries()).map(([key, texts]) => {
    const [axis, ringStr] = key.split(":");
    return { axis, ring: Number(ringStr), text: texts.map((t, i) => `${i + 1}. ${t}`).join("\n") };
  });
}
