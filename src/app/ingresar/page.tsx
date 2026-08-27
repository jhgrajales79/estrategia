"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { ParticipantRole } from "@/lib/types";
import { setStoredParticipant, getStoredParticipant } from "@/lib/participant";
import { inputCls, btnPrimary } from "@/components/activities/shared";
import RoadmapAnimation from "@/components/RoadmapAnimation";

const FACILITADOR_PASSWORD = "therion01";

export default function IngresarPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<ParticipantRole>("participante");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = getStoredParticipant();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(existing.name);
      setRole(existing.role);
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (role === "facilitador" && password !== FACILITADOR_PASSWORD) {
      setError("Clave de facilitador incorrecta.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("participants")
      .insert({
        name: name.trim(),
        role,
        aspiration_id: null,
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
      aspiration_id: null,
    });
    router.push("/panel");
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12">
      <Image src="/socya-logo.png" alt="Socya" width={140} height={58} className="mb-4" />
      <RoadmapAnimation />
      <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Ingresa a la sesión</h1>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nombre completo</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María Pérez" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Rol</label>
          <select
            className={inputCls}
            value={role}
            onChange={(e) => {
              setRole(e.target.value as ParticipantRole);
              setPassword("");
              setError(null);
            }}
          >
            <option value="participante">Participante</option>
            <option value="facilitador">Facilitador</option>
          </select>
          {role === "facilitador" && (
            <p className="mt-1 text-xs text-brand-dark">🎤 Como facilitador tendrás los controles para habilitar sesiones y actividades.</p>
          )}
        </div>
        {role === "facilitador" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Clave de facilitador</label>
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className={btnPrimary + " w-full justify-center"} disabled={loading}>
          {loading ? "Ingresando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
