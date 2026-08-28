"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchAspirations, fetchSessions } from "@/lib/data";
import type { Aspiration, SessionRow } from "@/lib/types";
import { aspClasses } from "@/lib/aspirationStyle";
import Cronograma from "@/components/Cronograma";

export default function HomePage() {
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
    fetchSessions().then(setSessions).catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <Image src="/socya-logo.png" alt="Socya" width={220} height={92} priority />
        <h1 className="mt-6 text-2xl font-bold text-dark sm:text-3xl">Ruta de Planeación Estratégica</h1>
        <p className="mt-3 max-w-xl text-balance text-muted">
          &ldquo;Tejemos conexiones para incidir en el cuidado del ser humano y la naturaleza&rdquo;
        </p>
        <p className="mt-1 text-sm text-muted">
          Metodología combinada Serna Gómez · Balanced Scorecard · Fred David — 8 sesiones en 12 semanas.
        </p>
        <Link href="/ingresar" className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-dark hover:bg-brand-hover">
          Ingresar a la sesión
        </Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {aspirations.map((a) => {
          const cls = aspClasses(a.number);
          return (
            <div key={a.id} className={`rounded-xl border-t-4 ${cls.border} bg-card p-4 shadow-sm`}>
              <p className={`text-xs font-bold uppercase tracking-wide ${cls.text}`}>Aspiración {a.number}</p>
              <p className="mt-2 text-sm text-foreground">{a.name}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-12">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Cronograma general</h2>
        <Cronograma sessions={sessions} />
      </div>
    </div>
  );
}
