import { generateText } from "ai";

export const maxDuration = 60;

interface StrategyInput {
  aspiracion: string;
  estrategia: string;
}

// Redacta, con un modelo de lenguaje (vía Vercel AI Gateway — sin clave propia, usa la
// autenticación nativa de la plataforma), un único párrafo de estrategia corporativa que
// sintetiza las estrategias ya ratificadas por consenso en "Cierre" (una por aspiración, o más).
// No guarda nada: el cliente decide si conserva el texto generado.
export async function POST(req: Request) {
  let strategies: StrategyInput[];
  try {
    const body = await req.json();
    strategies = Array.isArray(body?.strategies) ? body.strategies : [];
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  strategies = strategies.filter((s) => s?.estrategia?.trim());
  if (strategies.length === 0) {
    return Response.json({ error: "No hay estrategias para unificar." }, { status: 400 });
  }

  const listado = strategies
    .map((s, i) => `${i + 1}. [${s.aspiracion || "Sin aspiración"}] ${s.estrategia.trim()}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5",
      prompt:
        `Eres un consultor de planeación estratégica. A continuación hay ${strategies.length} estrategias corporativas, cada una ratificada por consenso para una aspiración distinta de una fundación social:\n\n${listado}\n\n` +
        "Redacta un ÚNICO párrafo en español (120-180 palabras), en prosa fluida y natural (no uses listas, viñetas ni numeración), que unifique estas estrategias en una sola narrativa estratégica corporativa coherente — mostrando cómo se complementan y refuerzan entre sí hacia un propósito común. No inventes datos ni metas que no estén en el listado. Responde solo con el párrafo, sin título ni comentarios adicionales.",
    });
    return Response.json({ text: text.trim() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "No se pudo generar el texto con IA. Intenta de nuevo." }, { status: 502 });
  }
}
