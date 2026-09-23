"use client";

import { useEffect, useState } from "react";

// Compartido entre pestañas de la misma sesión de navegador: la primera que sincroniza deja el
// desfase listo para las demás, así no todas esperan su propio round-trip al abrir.
let cachedOffsetMs = 0;

// Para usar fuera de un componente (p. ej. al calcular `endAt` en el momento de iniciar un
// temporizador) — misma corrección que `useServerNow`, pero como valor síncrono puntual en vez
// de un hook. Comparte el desfase ya sincronizado por cualquier `useServerNow` montado.
export function serverNow() {
  return Date.now() + cachedOffsetMs;
}

// Los temporizadores (RotationBoard, ActivityTimer) calculan el tiempo restante como
// `endAt - ahora`, y "ahora" salía de `Date.now()` del propio dispositivo. Si el reloj de un
// celular o laptop está desfasado frente al de quien inició el temporizador, cada pantalla
// arranca mostrando un conteo distinto aunque `endAt` sea idéntico para todos — no es un
// problema de sincronización de datos, es de reloj. Este hook estima el desfase contra
// /api/server-time (técnica tipo NTP: resta la mitad del round-trip) y lo aplica a `Date.now()`
// para que todos los dispositivos calculen el mismo "ahora", sin importar su hora local.
export function useServerNow(intervalMs = 250) {
  const [offsetMs, setOffsetMs] = useState(cachedOffsetMs);
  const [nowMs, setNowMs] = useState(() => Date.now() + cachedOffsetMs);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/server-time", { cache: "no-store" });
        const { now } = (await res.json()) as { now: number };
        const t1 = Date.now();
        const estimatedOffset = now + (t1 - t0) / 2 - t1;
        if (!cancelled) {
          cachedOffsetMs = estimatedOffset;
          setOffsetMs(estimatedOffset);
        }
      } catch {
        // Sin conexión momentánea: seguimos con el último desfase conocido (0 si es la primera vez).
      }
    }
    sync();
    // Los relojes de hardware se desvían con el tiempo — resincroniza cada pocos minutos para
    // sesiones largas, sin que el usuario note nada (el ajuste es de milisegundos).
    const resync = setInterval(sync, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(resync);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now() + offsetMs), intervalMs);
    return () => clearInterval(id);
  }, [offsetMs, intervalMs]);

  return nowMs;
}
