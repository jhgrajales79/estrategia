import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Configura .env.local"
  );
}

// Fallback inválido solo para permitir el build sin credenciales; en tiempo de
// ejecución sin .env.local configurado las llamadas a Supabase fallarán.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key", {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
