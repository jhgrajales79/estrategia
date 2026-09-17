// Homologación automática de ideas cortas (Crazy 8): agrupa por parecido de palabras en vez
// de exigir texto idéntico. Es una heurística local (sin IA ni servicio externo) pensada como
// punto de partida — el facilitador revisa y ajusta los grupos sugeridos después.

const STOPWORDS = new Set([
  "de", "la", "el", "en", "para", "con", "del", "las", "los", "un", "una", "unos", "unas",
  "y", "o", "a", "que", "se", "su", "sus", "al", "es", "son", "como", "por", "lo", "mas",
  "más", "sin", "este", "esta", "estos", "estas", "ser", "hacer", "todo", "toda", "todos",
  "todas", "nuestro", "nuestra", "nuestros", "nuestras",
]);

// Quita tildes/diacríticos y puntuación, y descarta palabras muy cortas o vacías de
// contenido (stopwords), para que la comparación se centre en las palabras clave de la idea.
function normalizeWords(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.34;

// Agrupa ids por parecido de texto (unión de conjuntos transitiva: si A se parece a B y B a
// C, A/B/C quedan en el mismo grupo aunque A y C no se parezcan directamente entre sí).
// Devuelve solo los grupos con 2 o más miembros — los que quedan solos no se tocan.
export function clusterBySimilarity(
  items: { id: string; text: string }[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): string[][] {
  const parent = new Map(items.map((i) => [i.id, i.id]));
  function find(x: string): string {
    let cur = x;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    parent.set(x, cur);
    return cur;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const wordsById = new Map(items.map((i) => [i.id, normalizeWords(i.text)]));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = jaccard(wordsById.get(items[i].id)!, wordsById.get(items[j].id)!);
      if (sim >= threshold) union(items[i].id, items[j].id);
    }
  }

  const groups = new Map<string, string[]>();
  for (const i of items) {
    const root = find(i.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i.id);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
