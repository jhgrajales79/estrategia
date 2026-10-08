import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";

export const maxDuration = 60;

// Redacta, con un modelo de lenguaje, el relato estratégico de "Relato estratégico y
// digitalización" a partir de un borrador mecánico ya armado por plantilla (ver
// buildRelatoTemplate en TarjetaEstructurada.tsx) recorriendo las cadenas causa-efecto del
// paredón — el mismo patrón plantilla+IA que /api/unificar-estrategia, pero aquí la IA no parte
// de datos crudos: solo convierte el borrador mecánico en prosa fluida, preservando el orden y
// el contenido exacto que ya se trazó en el mapa.
export async function POST(req: Request) {
  let draft: string;
  try {
    const body = await req.json();
    draft = typeof body?.draft === "string" ? body.draft.trim() : "";
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!draft) {
    return Response.json({ error: "No hay un borrador para redactar." }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "Falta configurar GROQ_API_KEY en el servidor. Agrega la variable de entorno en Vercel y vuelve a desplegar." },
      { status: 500 }
    );
  }

  try {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    const { text } = await generateText({
      model: groq("openai/gpt-oss-120b"),
      prompt:
        "Eres el director de planeación estratégica de una fundación social, presentando el mapa estratégico (Balanced Scorecard adaptado) a la junta directiva. " +
        `A continuación hay un borrador mecánico, armado automáticamente a partir de las cadenas causa-efecto del mapa (de abajo hacia arriba: Gente y cultura → Procesos internos → Territorios y comunidades → Autosostenibilidad):\n\n${draft}\n\n` +
        "Redacta el RELATO ESTRATÉGICO en español, en prosa fluida y en TONO ESTRATÉGICO: formal, ejecutivo, narrando la lógica causal de abajo hacia arriba tal como aparece en el borrador (no la reordenes ni la inviertas). Conserva una idea por cadena (un párrafo por cadena causal si el borrador trae varias, separados por un salto de línea). No inventes objetivos, cifras ni metas que no estén en el borrador; si el borrador trae una nota de '(ajustado tras la validación cruzada: ...)', intégrala de forma natural en la frase en vez de citarla entre paréntesis. Evita viñetas o numeración. Responde solo con el relato, sin título ni comentarios adicionales.",
    });
    return Response.json({ text: text.trim() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "No se pudo generar el relato con IA. Intenta de nuevo." }, { status: 502 });
  }
}
