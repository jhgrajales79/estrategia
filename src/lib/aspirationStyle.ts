import type { Aspiration } from "./types";

export function aspClasses(number: number | null | undefined) {
  switch (number) {
    case 1:
      return { bg: "bg-asp-1", bgSoft: "bg-asp-1-soft", text: "text-asp-1", border: "border-asp-1" };
    case 2:
      return { bg: "bg-asp-2", bgSoft: "bg-asp-2-soft", text: "text-asp-2", border: "border-asp-2" };
    case 3:
      return { bg: "bg-asp-3", bgSoft: "bg-asp-3-soft", text: "text-asp-3", border: "border-asp-3" };
    default:
      return { bg: "bg-muted", bgSoft: "bg-black/5", text: "text-muted", border: "border-border" };
  }
}

export function findAspiration(aspirations: Aspiration[], id: number | null | undefined) {
  if (id === null || id === undefined) return null;
  return aspirations.find((a) => a.id === id) ?? null;
}
