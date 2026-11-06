/**
 * CHILD SAFETY HARD BLOCK — ALWAYS ON.
 *
 * This module is intentionally:
 *  - code-only: there is no setting, DB column, feature flag, env var, API
 *    parameter, or UI control that can disable or relax it;
 *  - parameterless: `checkChildSafety` takes only text, so no caller can pass
 *    an option to skip it;
 *  - called twice: first inside the policy engine, then again directly before
 *    every provider call (see providers/registry.ts), including dry-run and
 *    break-glass paths.
 *
 * Do not weaken. Any change here must keep tests/unit/child-safety.test.ts green.
 */
import { compileTerms, findTerm, matchVariants, spelledOutRuns } from "./normalize";

const MINOR_TERMS = [
  "child", "children", "childlike", "child like", "kid", "kiddie", "kiddo", "minor", "underage", "under age", "under aged",
  "preteen", "pre teen", "tween", "teen", "teenage", "teenager", "young teen", "adolescent", "juvenile", "pubescent", "prepubescent",
  "schoolgirl", "schoolboy", "school girl", "school boy", "little girl", "little boy", "young girl", "young boy", "girl child", "boy child",
  "toddler", "infant", "baby", "babies", "newborn", "loli", "lolita", "shota", "elementary school", "middle school", "grade school",
  "high schooler", "high school girl", "high school boy", "middle schooler", "junior high", "daughter", "son", "niece", "nephew",
  "boy scout", "girl scout", "cub scout", "kindergarten", "kindergartener", "first grader", "fifth grader", "sixth grader",
];

const SEXUAL_TERMS = [
  "sex", "sexy", "sexual", "sexualized", "sexualised", "sexually", "nude", "nudes", "naked", "nudity", "nudist", "porn", "porno",
  "pornographic", "erotic", "erotica", "nsfw", "xxx", "lewd", "hentai", "ecchi", "explicit", "topless", "bottomless", "undressed",
  "undressing", "undress", "unclothed", "no clothes", "without clothes", "lingerie", "underwear", "panties", "panty", "bra", "thong",
  "bikini", "swimsuit", "seductive", "seduce", "provocative", "sensual", "fetish", "bdsm", "bondage", "orgasm", "genital", "genitals",
  "breast", "breasts", "boobs", "nipple", "nipples", "cleavage", "aroused", "arousal", "intimate", "strip", "stripping", "stripper",
  "spread legs", "onlyfans", "kinky", "horny", "hot body", "bedroom pose", "pin up", "pinup", "boudoir", "suggestive", "molest",
  "molested", "molestation", "grooming", "rape", "raped", "incest", "booty", "butt", "ass", "crotch", "pantyhose", "skimpy",
];

/** Terms that are blocked on their own, with no second signal needed. */
const HARD_TERMS = [
  "csam", "child porn", "child pornography", "kiddie porn", "kiddy porn", "pedo", "pedophile", "pedophilia", "paedo", "paedophile",
  "paedophilia", "pedobear", "jailbait", "lolicon", "shotacon", "underage sex", "underage nude", "underage porn", "preteen model",
  "child sex", "child nude", "child erotica", "minor sex", "minor nude",
];

const MINOR_RE = compileTerms(MINOR_TERMS);
const SEXUAL_RE = compileTerms(SEXUAL_TERMS);
const HARD_RE = compileTerms(HARD_TERMS);
/** "12 year old", "12yo", "12 y o", "aged 12", "age 9" — ages 1 to 17. */
const AGE_RE = / (?:(?:[1-9]|1[0-7]) ?(?:yo|y o|yr old|yrs old|year old|years old|years|yrs)|aged? (?:[1-9]|1[0-7])) /;

export type ChildSafetyResult = { blocked: false } | { blocked: true; reason: "hard_term" | "minor_sexual"; matched: string[] };

const compact = (terms: string[]) => terms.map((t) => t.replace(/\s+/g, "")).filter((t) => t.length >= 3);
const MINOR_COMPACT = compact(MINOR_TERMS.filter((t) => t.length >= 4));
const SEXUAL_COMPACT = compact(SEXUAL_TERMS.filter((t) => t.length >= 3 && t !== "ass" && t !== "bra"));
const HARD_COMPACT = compact(HARD_TERMS);

/** Substring search inside spelled-out runs only ("n a k e d c h i l d"). */
function inRuns(runs: string[], terms: string[]): string | null {
  for (const r of runs) for (const t of terms) if (r.includes(t)) return t;
  return null;
}

export function checkChildSafety(text: string): ChildSafetyResult {
  if (!text) return { blocked: false };
  const variants = matchVariants(text);
  const runs = spelledOutRuns(text);
  const hard = findTerm(HARD_RE, variants) ?? inRuns(runs, HARD_COMPACT);
  if (hard) return { blocked: true, reason: "hard_term", matched: [hard] };
  const minor =
    findTerm(MINOR_RE, variants) ?? variants.map((v) => AGE_RE.exec(v)?.[0]?.trim()).find(Boolean) ?? inRuns(runs, MINOR_COMPACT) ?? null;
  if (!minor) return { blocked: false };
  const sexual = findTerm(SEXUAL_RE, variants) ?? inRuns(runs, SEXUAL_COMPACT);
  if (sexual) return { blocked: true, reason: "minor_sexual", matched: [minor, sexual] };
  return { blocked: false };
}

export const CHILD_SAFETY_CATEGORY = "child_safety";

export class ChildSafetyViolation extends Error {
  readonly code = "CHILD_SAFETY_BLOCK";
  constructor() {
    super("Blocked by child-safety policy");
  }
}

/** Throws if the text is unsafe. Used as the last gate before any provider call. */
export function assertChildSafe(...texts: (string | null | undefined)[]): void {
  const joined = texts.filter(Boolean).join("\n");
  if (checkChildSafety(joined).blocked) throw new ChildSafetyViolation();
}
