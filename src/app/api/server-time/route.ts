import { NextResponse } from "next/server";

// Reloj de referencia para los temporizadores (RotationBoard, ActivityTimer): si el reloj del
// dispositivo de un participante está desfasado frente al del facilitador, el conteo regresivo
// (que se deriva de una marca de tiempo absoluta `endAt`) arranca mostrando un tiempo distinto
// en cada pantalla. Este endpoint no depende del reloj del cliente, así que sirve como ancla
// para corregir ese desfase — ver useServerClock.ts.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ now: Date.now() });
}
