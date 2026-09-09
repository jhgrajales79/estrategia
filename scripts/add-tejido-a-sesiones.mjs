// Migración de datos — agrega la actividad "El tejido de conexiones" (mural de fotos) a
// las sesiones S1-S7, que hasta ahora solo existía en S0. Se inserta como primera actividad
// de cada sesión (order_index 0), recorriendo el resto una posición hacia abajo, igual a como
// ya está montada en S0.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

const { data: sessions, error: sessionsError } = await supabase
  .from("sessions")
  .select("id, code")
  .neq("code", "S0")
  .order("order_index");
if (sessionsError) throw sessionsError;

for (const session of sessions) {
  const { data: existing, error: existingError } = await supabase
    .from("activities")
    .select("id, activity_type")
    .eq("session_id", session.id);
  if (existingError) throw existingError;

  if (existing.some((a) => a.activity_type === "tejido_conexiones")) {
    console.log(`${session.code}: ya tiene tejido_conexiones, se omite.`);
    continue;
  }

  const { data: toShift, error: shiftFetchError } = await supabase
    .from("activities")
    .select("id, order_index")
    .eq("session_id", session.id)
    .order("order_index");
  if (shiftFetchError) throw shiftFetchError;

  for (const a of toShift) {
    const { error: shiftError } = await supabase
      .from("activities")
      .update({ order_index: a.order_index + 1 })
      .eq("id", a.id);
    if (shiftError) throw shiftError;
  }

  const { error: insertError } = await supabase.from("activities").insert({
    session_id: session.id,
    title: "El tejido de conexiones",
    time_minutes: 15,
    description: null,
    materials: null,
    activity_type: "tejido_conexiones",
    config: {},
    order_index: 0,
    is_enabled: false,
  });
  if (insertError) throw insertError;
  console.log(`${session.code}: tejido_conexiones agregado (${toShift.length} actividades recorridas).`);
}

console.log("Listo.");
