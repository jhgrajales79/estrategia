import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Nuevas metas acordadas para cada aspiración — enunciados fijos (no salen de la Subasta ni de la
// tabla goals), enlazados por el NÚMERO de la aspiración, no por su id en la base de datos. La
// `key` es estable y es lo que guardan los badges (nueva_meta_badges.meta_key): si se corrige el
// texto de una meta, sus badges no se pierden.
export const NUEVAS_METAS: { key: string; aspiracion: number; texto: string }[] = [
  { key: "lineas-servicio", aspiracion: 2, texto: "Líneas de servicio" },
  { key: "capacidades-tendencias", aspiracion: 2, texto: "Capacidades y tendencias" },
  { key: "anticipacion-tendencias", aspiracion: 2, texto: "Anticipación tendencias / oportunidades" },
  { key: "gestion-conocimiento", aspiracion: 1, texto: "Gestión del conocimiento" },
  { key: "ia-tecnologia", aspiracion: 2, texto: "IA / tecnología al servicio de SOCYA" },
  { key: "optimizacion-organizacional", aspiracion: 3, texto: "Optimización organizacional → Competitividad (eficiencia operativa) ERP" },
  { key: "retencion-talento", aspiracion: 1, texto: "Retención talento Vs Rotación" },
  { key: "coworking", aspiracion: 2, texto: "Coworking" },
  { key: "posicionamiento-marca", aspiracion: 3, texto: "Posicionamiento de marca" },
  { key: "sostenibilidad-financiera", aspiracion: 3, texto: "Sostenibilidad financiera" },
];

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
