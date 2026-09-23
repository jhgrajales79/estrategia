import * as XLSX from "xlsx";
import { aspAbbrev } from "./aspirationStyle";
import { POLARITY_META, type NotePolarity } from "@/components/activities/shared";
import type { Aspiration } from "./types";
import { slugifyFilename } from "./backup";

interface RotationNoteLike {
  category: string;
  aspiration_id: number | null;
  author: string;
  text: string;
  impact?: string;
  polarity?: NotePolarity;
  highlighted?: boolean;
}

// Copia completa de una actividad de mesas rotativas (Mundo café y similares) en Excel, para que
// el facilitador se lleve un respaldo legible apenas termina la rotación — sin que eso implique
// borrar nada del tablero: las notas siguen viviendo en `content.notes` tal cual, este archivo es
// solo una exportación adicional.
export function exportRotationNotesToExcel(params: {
  activityTitle: string;
  categories: { key: string; label: string }[];
  notes: RotationNoteLike[];
  aspirations: Aspiration[];
}) {
  const { activityTitle, categories, notes, aspirations } = params;
  const labelByKey = new Map(categories.map((c) => [c.key, c.label]));

  const rows = notes.map((n) => ({
    Mesa: labelByKey.get(n.category) ?? n.category,
    Aspiración: aspAbbrev(aspirations, n.aspiration_id) ?? "",
    Autor: n.author,
    Nota: n.text,
    Polaridad: n.polarity ? POLARITY_META[n.polarity].label : "",
    Impacto: n.impact ?? "",
    Destacada: n.highlighted ? "Sí" : "",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 60 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Notas");

  const filename = `${slugifyFilename(activityTitle)}_copia_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
