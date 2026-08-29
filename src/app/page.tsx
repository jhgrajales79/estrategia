"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchAspirations } from "@/lib/data";
import type { Aspiration } from "@/lib/types";
import { aspClasses } from "@/lib/aspirationStyle";
import ChessboardAnimation from "@/components/ChessboardAnimation";
import { AspirationIconCircle, AspirationLabel } from "@/components/AspirationBadge";

export default function HomePage() {
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="flex flex-col items-center text-center">
        <Image src="/socya-logo.png" alt="Socya" width={160} height={67} priority />
        <h1 className="mt-3 text-xl font-bold text-dark sm:text-2xl">Ruta de Planeación Estratégica</h1>
        <p className="mt-1.5 max-w-xl text-balance text-sm text-muted">
          &ldquo;Tejemos conexiones para incidir en el cuidado del ser humano y la naturaleza&rdquo;
        </p>
        <Link
          href="/ingresar"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-dark hover:bg-brand-hover"
        >
          Ingresar a la sesión
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div>
          <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-muted lg:text-left">
            Nuestras tres aspiraciones
          </h2>
          <div className="flex flex-col gap-3">
            {aspirations.map((a) => {
              const cls = aspClasses(a.number);
              return (
                <div
                  key={a.id}
                  className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`absolute inset-y-0 left-0 w-1.5 ${cls.bg}`} />
                  <AspirationIconCircle number={a.number} />
                  <div>
                    <AspirationLabel number={a.number} />
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{a.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-muted lg:text-left">
            Así avanza la estrategia: en equipo, paso a paso
          </h2>
          <ChessboardAnimation />
        </div>
      </div>
    </div>
  );
}
