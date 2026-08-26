/**
 * No se importa en tiempo de ejecución. Existe únicamente para que el
 * escaneo de contenido de Tailwind detecte las clases usadas dentro de
 * carpetas de ruta de Next.js con corchetes (p. ej. app/sesiones/[code],
 * app/radar/[activityId]) — su detector de contenido no las recorre
 * correctamente porque interpreta los corchetes como sintaxis glob, así
 * que cualquier clase usada *solo* dentro de esas carpetas no se genera.
 * Repetir aquí esas clases (en un archivo de ruta normal) evita el problema.
 */
export const TAILWIND_ROUTE_SAFELIST = `
  mx-auto max-w-4xl px-4 py-8 text-sm text-muted
  mb-6 rounded-xl border border-border bg-card p-5 shadow-sm
  flex flex-wrap items-center justify-between gap-2
  text-xl font-bold text-foreground
  flex items-center gap-3
  rounded-md border border-border bg-card px-2 py-1 text-xs
  rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-muted
  mt-1 text-xs text-muted
  mt-3 text-sm text-foreground
  mt-2 text-xs italic text-muted
  flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center
  space-y-3
  mt-8
  mb-3 text-sm font-semibold uppercase tracking-wide text-muted
  mb-2 text-xs text-muted
  space-y-2 rounded-xl border border-border bg-card p-4
  flex items-start gap-2 text-sm
  cursor-default
  mt-0.5 disabled:cursor-default
  text-muted line-through
  ml-auto shrink-0 text-xs font-medium
  flex min-h-screen items-center justify-center text-sm text-muted
  flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted
  flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6
  text-2xl font-bold text-foreground
  min-h-screen bg-background p-8
  mb-8 text-center text-3xl font-bold text-foreground
  grid gap-4 overflow-hidden bg-background p-8
  text-center text-3xl font-bold text-foreground
  min-h-0 min-w-0
`;
