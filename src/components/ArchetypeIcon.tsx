export default function ArchetypeIcon({ number, className }: { number: number; className?: string }) {
  switch (number) {
    case 1:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path d="M12 20.5s-7.5-4.6-9.8-9.2C.7 7.8 2.3 4 6 4c2.1 0 3.6 1.2 4.5 2.6 1.6.2 3.1 1.1 3.9 2.6.5-1 1.5-2 3-2.2.5-3 3.1-4 4.9-1.9 1.6 1.8.7 5.3-1.6 8.4-2.5 3.4-8.7 7-8.7 7Z" />
        </svg>
      );
    case 2:
      // Especialista: precisión, foco (diana).
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 3:
      // Protectora: escudo.
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path d="M12 3l7 3v5.5c0 4.6-3 8.3-7 9.5-4-1.2-7-4.9-7-9.5V6l7-3Z" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}
