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
