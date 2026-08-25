"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredParticipant, clearStoredParticipant, StoredParticipant } from "@/lib/participant";

const LINKS = [
  { href: "/panel", label: "Panel en vivo" },
  { href: "/sesiones", label: "Sesiones" },
  { href: "/metas", label: "Metas" },
  { href: "/tablero", label: "Tablero" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [participant, setParticipant] = useState<StoredParticipant | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticipant(getStoredParticipant());
  }, [pathname]);

  if (pathname === "/" || pathname === "/ingresar") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/panel" className="flex items-center gap-2">
          <Image src="/socya-logo.png" alt="Socya" width={90} height={38} className="h-8 w-auto" priority />
          <span className="hidden text-sm font-semibold text-muted sm:inline">Ruta de Planeación Estratégica</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                pathname.startsWith(l.href) ? "bg-brand text-white" : "text-foreground hover:bg-black/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {participant ? (
            <>
              <span className="hidden text-muted sm:inline">{participant.name}</span>
              <button
                className="text-xs text-muted hover:text-foreground hover:underline"
                onClick={() => {
                  clearStoredParticipant();
                  router.push("/ingresar");
                }}
              >
                salir
              </button>
            </>
          ) : (
            <Link href="/ingresar" className="text-brand hover:underline">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
