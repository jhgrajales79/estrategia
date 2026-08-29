"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchAspirations } from "@/lib/data";
import type { Aspiration } from "@/lib/types";
import { aspClasses } from "@/lib/aspirationStyle";
import ChessboardAnimation from "@/components/ChessboardAnimation";

const ARCHETYPE_LABEL: Record<number, string> = {
  1: "Humana",
  2: "Protectora",
  3: "Especialista",
};

function ArchetypeIcon({ number, className }: { number: number; className?: string }) {
  switch (number) {
    case 1:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path d="M12 20.5s-7.5-4.6-9.8-9.2C.7 7.8 2.3 4 6 4c2.1 0 3.6 1.2 4.5 2.6 1.6.2 3.1 1.1 3.9 2.6.5-1 1.5-2 3-2.2.5-3 3.1-4 4.9-1.9 1.6 1.8.7 5.3-1.6 8.4-2.5 3.4-8.7 7-8.7 7Z" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path d="M12 3l7 3v5.5c0 4.6-3 8.3-7 9.5-4-1.2-7-4.9-7-9.5V6l7-3Z" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

export default function HomePage() {
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);

  useEffect(() => {
    fetchAspirations().then(setAspirations).catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
      <div className="flex flex-col items-center text-center">
        <Image src="/socya-logo.png" alt="Socya" width={220} height={92} priority />
        <h1 className="mt-6 text-2xl font-bold text-dark sm:text-3xl">Ruta de Planeación Estratégica</h1>
        <p className="mt-3 max-w-xl text-balance text-muted">
          &ldquo;Tejemos conexiones para incidir en el cuidado del ser humano y la naturaleza&rdquo;
        </p>
        <Link
          href="/ingresar"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-dark hover:bg-brand-hover"
        >
          Ingresar a la sesión
        </Link>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div>
          <h2 className="mb-5 text-center text-sm font-bold uppercase tracking-wide text-muted lg:text-left">
            Nuestras tres aspiraciones
          </h2>
          <div className="flex flex-col gap-4">
            {aspirations.map((a) => {
              const cls = aspClasses(a.number);
              return (
                <div
                  key={a.id}
                  className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`absolute inset-y-0 left-0 w-1.5 ${cls.bg}`} />
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${cls.bgSoft}`}>
                    <ArchetypeIcon number={a.number} className={`h-5 w-5 ${cls.text}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${cls.text}`}>
                      Aspiración {a.number} · {ARCHETYPE_LABEL[a.number]}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">{a.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-5 text-center text-sm font-bold uppercase tracking-wide text-muted lg:text-left">
            Así avanza la estrategia: en equipo, paso a paso
          </h2>
          <ChessboardAnimation />
        </div>
      </div>
    </div>
  );
}
