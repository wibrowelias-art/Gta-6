/** Prompt normalization used both for storage and for policy matching. Pure, no I/O. */

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** What we store and send to the model: NFKC, invisible chars stripped, whitespace tidied. */
export function normalizePrompt(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(CONTROL, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i", "|": "l", "+": "t" };

function base(text: string): string {
  return normalizePrompt(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, ""); // strip diacritics: "nüde" -> "nude"
}

/** Join runs of single characters separated by punctuation/space: "s e x", "s.e.x", "s-e-x" -> "sex". */
function joinSpelledOut(s: string): string {
  return s.replace(/\b(?:[a-z0-9][\s._\-*/\\]+){2,}[a-z0-9]\b/g, (m) => m.replace(/[\s._\-*/\\]+/g, ""));
}

/** Collapsed spelled-out runs ("n a k e d c h i l d" -> "nakedchild"), leet-mapped. Used for substring checks. */
export function spelledOutRuns(text: string): string[] {
  const b = base(text);
  const leetSrc = b.replace(/[0-9@$!|+]/g, (c) => LEET[c] ?? c);
  const runs: string[] = [];
  for (const src of [b, leetSrc]) {
    for (const m of src.matchAll(/\b(?:[a-z0-9][\s._\-*/\\]+){2,}[a-z0-9]\b/g)) runs.push(m[0].replace(/[\s._\-*/\\]+/g, ""));
  }
  return runs;
}

function spaced(s: string): string {
  return ` ${s.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/**
 * Matching variants. Terms are tested against each; any hit counts.
 * - plain: lowercase, no diacritics, punctuation -> space ("ak47" stays "ak47")
 * - leet: digits/symbols mapped to letters ("n4ked" -> "naked")
 * - joined: spelled-out words collapsed ("n a k e d" -> "naked")
 */
export function matchVariants(text: string): string[] {
  const b = base(text);
  const plain = spaced(b);
  const leetSrc = b.replace(/[0-9@$!|+]/g, (c) => LEET[c] ?? c);
  const leet = spaced(leetSrc);
  const joined = spaced(joinSpelledOut(b));
  const joinedLeet = spaced(joinSpelledOut(leetSrc));
  return Array.from(new Set([plain, leet, joined, joinedLeet]));
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compile a phrase list to one regex over the space-padded variants, allowing simple plurals. */
export function compileTerms(terms: readonly string[]): RegExp | null {
  const cleaned = terms
    .map((t) => spaced(base(t)).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escape);
  if (cleaned.length === 0) return null;
  return new RegExp(` (${cleaned.join("|")})(?:s|es)? `);
}

export function findTerm(re: RegExp | null, variants: string[]): string | null {
  if (!re) return null;
  for (const v of variants) {
    const m = re.exec(v);
    if (m) return m[1] ?? m[0].trim();
  }
  return null;
}
