"use client";

import { useRef, useState } from "react";
import { downloadJson, exportAllBackup, parseBackupFile, restoreRows, type BackupFile } from "@/lib/backup";
import { btnGhost } from "@/components/activities/shared";

export default function SystemBackupPanel() {
  const [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExportAll() {
    setExporting(true);
    try {
      const backup = await exportAllBackup();
      downloadJson(`respaldo_estrategia_socya_${new Date().toISOString().slice(0, 10)}.json`, backup);
    } catch (err) {
      console.error(err);
      setProgress("No se pudo generar el respaldo.");
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

  async function confirmImportAll() {
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

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">🗄️ Datos de todo el sistema</h2>
      <p className="mt-1 text-xs text-muted">
        Exporta el trabajo registrado en todas las actividades y sesiones a un archivo, o restaura uno previamente
        exportado.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btnGhost} onClick={handleExportAll} disabled={exporting}>
          {exporting ? "Generando…" : "⬇ Exportar todo (JSON)"}
        </button>
        <button className={btnGhost} onClick={() => fileInputRef.current?.click()}>
          ⬆ Importar respaldo
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
      </div>

      {progress && !pendingImport && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-black/[0.03] px-3 py-2 text-xs text-foreground">
          <span>{progress}</span>
          <button className="text-muted hover:text-foreground" onClick={() => setProgress(null)}>
            ✕
          </button>
        </div>
      )}

      {pendingImport && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <span>
            ¿Importar {pendingImport.rows.length} fila(s) de todas las actividades? Esto sobrescribirá lo ya
            registrado en las actividades y aspiraciones incluidas en el archivo. No se puede deshacer.
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
              onClick={confirmImportAll}
              disabled={importing}
            >
              {importing ? "Importando…" : "Sí, importar todo"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
