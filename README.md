# Ruta de Planeación Estratégica Socya

Aplicación web para llevar en línea las 8 sesiones (S0–S7) de la Ruta de Planeación
Estratégica de Socya: cronograma, dinámicas digitales por sesión, equipos trabajando
por aspiración en paralelo, panel en vivo de avance y tablero de seguimiento.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Supabase (Postgres + Realtime) como base de datos
- Despliegue en Vercel

## Desarrollo local

1. Copia `.env.local.example` a `.env.local` y coloca la anon key del proyecto de Supabase.
2. `npm install`
3. `npm run dev`

## Base de datos

El esquema y los datos semilla (contenido real de las 8 sesiones) están en
`supabase/migrations/`. Para aplicarlos:

```
npx supabase login
npx supabase link --project-ref vskghscatzypibpggedr
npx supabase db push
```

## Estructura

- `src/app` — páginas (portada, ingreso, panel en vivo, sesiones, metas, tablero).
- `src/components/activities` — los 10 componentes genéricos y configurables que
  cubren todas las dinámicas del documento de planeación (post-its, matrices
  ponderadas, matrices de cuadrantes, ruedas de evaluación, votación con fichas,
  tarjetas estructuradas, mapa estratégico, tablero de proyectos y fichas KPI).
- `src/lib` — cliente de Supabase, tipos, autoguardado (`useSubmission`) y presencia
  en vivo (`usePresence`).
