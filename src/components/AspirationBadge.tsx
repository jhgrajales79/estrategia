import { aspClasses, ARCHETYPE_LABEL } from "@/lib/aspirationStyle";
import ArchetypeIcon from "./ArchetypeIcon";

export function AspirationIconCircle({
  number,
  size = "h-9 w-9",
  iconSize = "h-4 w-4",
}: {
  number: number;
  size?: string;
  iconSize?: string;
}) {
  const cls = aspClasses(number);
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full ${cls.bgSoft}`}>
      <ArchetypeIcon number={number} className={`${iconSize} ${cls.text}`} />
    </div>
  );
}

export function AspirationLabel({ number, className = "" }: { number: number; className?: string }) {
  const cls = aspClasses(number);
  return (
    <span className={`text-xs font-bold uppercase tracking-wide ${cls.text} ${className}`}>
      Aspiración {number} · {ARCHETYPE_LABEL[number]}
    </span>
  );
}

export default function AspirationBadge({ number }: { number: number }) {
  return (
    <div className="flex items-center gap-2">
      <AspirationIconCircle number={number} size="h-7 w-7" iconSize="h-3.5 w-3.5" />
      <AspirationLabel number={number} />
    </div>
  );
}
