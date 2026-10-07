import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";

export const maxDuration = 60;

interface StrategyInput {
  aspiracion: string;
  estrategia: string;
}

// Redacta, con un modelo de lenguaje, un único párrafo de estrategia corporativa que sintetiza
// las estrategias ya ratificadas por consenso en "Cierre" (una por aspiración, o más). Usa Groq
// directo (GROQ_API_KEY) en vez del AI Gateway de Vercel — Groq es gratis sin tarjeta de crédito,
// a diferencia del Gateway que la exige incluso para el crédito gratuito. No guarda nada: el
// cliente decide si conserva el texto generado.
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

  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "Falta configurar GROQ_API_KEY en el servidor. Agrega la variable de entorno en Vercel y vuelve a desplegar." },
      { status: 500 }
    );
  }

  const listado = strategies
    .map((s, i) => `${i + 1}. [${s.aspiracion || "Sin aspiración"}] ${s.estrategia.trim()}`)
    .join("\n");

  try {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    const { text } = await generateText({
      model: groq("openai/gpt-oss-120b"),
      prompt:
        `Eres el director de planeación estratégica de una fundación social. A continuación hay ${strategies.length} estrategias corporativas, cada una ratificada por consenso para una aspiración distinta:\n\n${listado}\n\n` +
        "Redacta un ÚNICO párrafo en español (120-180 palabras) que unifique estas estrategias en una sola declaración de estrategia corporativa, en TONO ESTRATÉGICO: formal, ejecutivo y orientado a la acción — como el que abre un plan estratégico corporativo o un informe a junta directiva. Usa verbos en futuro/infinitivo de corte institucional (consolidará, fortalecerá, integrará, orientará sus esfuerzos a...), vocabulario propio de planeación estratégica (sinergia, propuesta de valor, ventaja competitiva, sostenibilidad, cierre de brechas), y una estructura de causa-efecto clara entre las estrategias. Evita metáforas, lenguaje poético o emotivo, y evita listas, viñetas o numeración: debe ser un párrafo corrido. No inventes datos ni metas que no estén en el listado. Responde solo con el párrafo, sin título ni comentarios adicionales.",
    });
    return Response.json({ text: text.trim() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "No se pudo generar el texto con IA. Intenta de nuevo." }, { status: 502 });
  }
}
