export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} ${n > 1 ? plural : singular}`;
}

/** Comparaison insensible à la casse et aux accents. */
export function searchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
