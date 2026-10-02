/** Alphabet sans caractères ambigus : ni O/0, ni I/1/L. */
export const SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SHARE_CODE_LENGTH = 6;

export function generateShareCode(): string {
  // Rejet des octets ≥ 248 pour une distribution uniforme sur 31 symboles.
  const out: string[] = [];
  while (out.length < SHARE_CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(12))) {
      if (byte < 248 && out.length < SHARE_CODE_LENGTH) {
        out.push(SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length]);
      }
    }
  }
  return out.join("");
}

/** Met en forme une saisie (« abc 23k » → « ABC23K ») ; `null` si le code est invalide. */
export function normalizeShareCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== SHARE_CODE_LENGTH) return null;
  for (const c of code) if (!SHARE_CODE_ALPHABET.includes(c)) return null;
  return code;
}
