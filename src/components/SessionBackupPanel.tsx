"use client";

import { useRef, useState } from "react";
import { downloadJson, exportSessionBackup, parseBackupFile, restoreRows, slugifyFilename, type BackupFile } from "@/lib/backup";
import { btnGhost } from "@/components/activities/shared";
import type { SessionRow } from "@/lib/types";

// Respaldo de una sola sesión: exporta/importa todo lo registrado en sus actividades sin
// tocar las demás sesiones — útil para guardar el trabajo de una sesión ya cerrada, o para
// reintentar una importación puntual sin arriesgar el resto del sistema (ver SystemBackupPanel
// para el respaldo completo).
export default function SessionBackupPanel({ session }: { session: SessionRow }) {
  const [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const backup = await exportSessionBackup(session);
      downloadJson(`respaldo_${slugifyFilename(session.code)}_${new Date().toISOString().slice(0, 10)}.json`, backup);
    } catch (err) {
      console.error(err);
      setProgress("No se pudo generar el respaldo de la sesión.");
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelected(file: File) {
    setProgress(null);
    try {
      const text = await file.text();
      const backup = parseBackupFile(text);
      if (backup.rows.length === 0) {
        setProgress("El archivo no contiene datos para importar.");
        return;
      }
      setPendingImport(backup);
    } catch (err) {
      setProgress(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    try {
      const { ok, failed } = await restoreRows(pendingImport.rows);
      setProgress(`Importado: ${ok} fila(s)${failed ? ` · ${failed} con error` : ""}. Recarga la página para ver los cambios.`);
    } catch (err) {
      console.error(err);
      setProgress("Ocurrió un error al importar.");
    } finally {
      setImporting(false);
      setPendingImport(null);
    }
  }

  // El respaldo puede traer session_id de otra sesión (alguien subió el archivo equivocado):
  // se avisa, pero no se bloquea — restoreRows igual filtra por activity_id, así que importar
  // el archivo de otra sesión aquí no mezcla datos, solo puede ser una acción sin sentido.
  const crossSession = pendingImport?.session_id !== undefined && pendingImport.session_id !== session.id;

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <button className={btnGhost} onClick={handleExport} disabled={exporting} title={`Exportar todo lo registrado en ${session.code}`}>
        {exporting ? "Generando…" : `⬇ Exportar ${session.code}`}
      </button>
      <button className={btnGhost} onClick={() => fileInputRef.current?.click()} title={`Importar un respaldo dentro de ${session.code}`}>
        ⬆ Importar a {session.code}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = "";
        }}
      />

      {progress && !pendingImport && (
        <div className="flex w-full items-center justify-between gap-2 rounded-md bg-black/[0.03] px-3 py-2 text-xs text-foreground">
          <span>{progress}</span>
          <button className="text-muted hover:text-foreground" onClick={() => setProgress(null)}>
            ✕
          </button>
        </div>
      )}

      {pendingImport && (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <span>
            {crossSession && (
              <strong className="mr-1 text-amber-900">
                ⚠ Este respaldo es de {pendingImport.session_code ?? "otra sesión"}, no de {session.code}.
              </strong>
            )}
            ¿Importar {pendingImport.rows.length} fila(s)? Esto sobrescribirá lo ya registrado en las actividades
            incluidas en el archivo. No se puede deshacer.
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-black/5"
              onClick={() => setPendingImport(null)}
              disabled={importing}
            >
              Cancelar
            </button>
            <button
              className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              onClick={confirmImport}
              disabled={importing}
            >
              {importing ? "Importando…" : "Sí, importar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
