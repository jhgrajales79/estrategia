"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { fetchAspirations } from "@/lib/data";
import type { Aspiration, ParticipantRole } from "@/lib/types";
import { setStoredParticipant, getStoredParticipant } from "@/lib/participant";
import { inputCls, btnPrimary } from "@/components/activities/shared";

const ROLES: { value: ParticipantRole; label: string }[] = [
  { value: "participante", label: "Participante" },
  { value: "lider_aspiracion", label: "Líder de aspiración" },
  { value: "comite", label: "Comité de planeación" },
  { value: "facilitador", label: "Facilitador" },
  { value: "relator", label: "Relator" },
  { value: "patrocinador", label: "Patrocinador (dirección ejecutiva)" },
];

export default function IngresarPage() {
  const router = useRouter();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState<ParticipantRole>("participante");
  const [aspirationId, setAspirationId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    const existing = getStoredParticipant();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(existing.name);
      setRole(existing.role);
      setAspirationId(existing.aspiration_id ? String(existing.aspiration_id) : "");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("participants")
      .insert({
        name: name.trim(),
        role,
        aspiration_id: aspirationId ? Number(aspirationId) : null,
      })
      .select("id")
      .single();
    setLoading(false);
    if (insertError || !data) {
      setError("No se pudo registrar. Intenta de nuevo.");
      return;
    }
    setStoredParticipant({
      id: data.id,
      name: name.trim(),
      role,
      aspiration_id: aspirationId ? Number(aspirationId) : null,
    });
    router.push("/panel");
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12">
      <Image src="/socya-logo.png" alt="Socya" width={140} height={58} className="mb-6" />
      <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Ingresa a la sesión</h1>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nombre completo</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María Pérez" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Rol</label>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as ParticipantRole)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {role === "facilitador" && (
            <p className="mt-1 text-xs text-brand-dark">🎤 Como facilitador tendrás los controles para habilitar sesiones y actividades.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Equipo / aspiración</label>
          <select className={inputCls} value={aspirationId} onChange={(e) => setAspirationId(e.target.value)}>
            <option value="">Transversal / comité (sin equipo fijo)</option>
            {aspirations.map((a) => (
              <option key={a.id} value={a.id}>
                Aspiración {a.number} — {a.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className={btnPrimary + " w-full justify-center"} disabled={loading}>
          {loading ? "Ingresando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
