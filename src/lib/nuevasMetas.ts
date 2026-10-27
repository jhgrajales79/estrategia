import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Nuevas metas de cada aspiración (tabla nuevas_metas), enlazadas por el NÚMERO de la aspiración,
// no por su id en la base de datos. Las agrega o quita el facilitador en la pestaña SINT de
// "Nuestro trabajo"; `key` es lo que guardan sus badges (nueva_meta_badges.meta_key).
export interface NuevaMeta {
  key: string;
  aspiracion: number;
  texto: string;
  orden: number;
}

export type BadgeTipo = "foco" | "alternativa" | "recurso";

// Orden, nombre y color de cada tipo de badge — el mismo en el editor SINT y en el tablero.
export const BADGE_TIPOS: { tipo: BadgeTipo; label: string; icon: string; chip: string }[] = [
  { tipo: "foco", label: "Foco estratégico", icon: "🎯", chip: "bg-brand/15 text-brand-dark" },
  { tipo: "alternativa", label: "Alternativa", icon: "🔀", chip: "bg-sky-100 text-sky-800" },
  { tipo: "recurso", label: "Recursos necesarios (tipo)", icon: "🧰", chip: "bg-amber-100 text-amber-800" },
];

export interface NuevaMetaBadge {
  id: number;
  meta_key: string;
  tipo: BadgeTipo;
  label: string;
  created_at: string;
}

async function fetchBadges(): Promise<NuevaMetaBadge[]> {
  const { data, error } = await supabase.from("nueva_meta_badges").select("*").order("created_at");
  if (error) {
    console.error(error);
    return [];
  }
  return data as NuevaMetaBadge[];
}

async function fetchMetas(): Promise<NuevaMeta[]> {
  const { data, error } = await supabase.from("nuevas_metas").select("key,aspiracion,texto,orden").order("orden").order("created_at");
  if (error) {
    console.error(error);
    return [];
  }
  return data as NuevaMeta[];
}

// Nuevas metas en vivo — el tablero se actualiza solo cuando el facilitador agrega o quita una.
export function useNuevasMetas(): { metas: NuevaMeta[]; loaded: boolean } {
  const [metas, setMetas] = useState<NuevaMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetchMetas().then((rows) => {
      setMetas(rows);
      setLoaded(true);
    });
    const channel = supabase
      .channel("nuevas-metas")
      .on("postgres_changes", { event: "*", schema: "public", table: "nuevas_metas" }, () => fetchMetas().then(setMetas))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return { metas, loaded };
}

export async function addMeta(aspiracion: number, texto: string, orden: number) {
  const { error } = await supabase.from("nuevas_metas").insert({ aspiracion, texto, orden });
  if (error) throw error;
}

// Sus badges se borran en cascada (FK de nueva_meta_badges.meta_key).
export async function deleteMeta(key: string) {
  const { error } = await supabase.from("nuevas_metas").delete().eq("key", key);
  if (error) throw error;
}

// Badges en vivo — el tablero de nuevas metas se actualiza solo mientras se editan en SINT.
export function useNuevaMetaBadges(): NuevaMetaBadge[] {
  const [badges, setBadges] = useState<NuevaMetaBadge[]>([]);
  useEffect(() => {
    fetchBadges().then(setBadges);
    const channel = supabase
      .channel("nueva-meta-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "nueva_meta_badges" }, () => fetchBadges().then(setBadges))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return badges;
}

export async function addBadge(meta_key: string, tipo: BadgeTipo, label: string) {
  const { error } = await supabase.from("nueva_meta_badges").insert({ meta_key, tipo, label });
  if (error) throw error;
}

export async function deleteBadge(id: number) {
  const { error } = await supabase.from("nueva_meta_badges").delete().eq("id", id);
  if (error) throw error;
}
