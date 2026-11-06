/**
 * Policy engine. Pure function: text + live policy config in, decision out.
 * Child safety always runs first and cannot be skipped by any option.
 */
import type { AppSettings, PolicyCategory } from "@/server/settings/schema";
import { POLICY_CATEGORIES } from "@/server/settings/schema";
import {
  ART_STYLE_RE,
  BRAND_RE,
  BRAND_USE_RE,
  CATEGORY_RES,
  KNOWN_PEOPLE_RE,
  PHOTOREAL_RE,
  PUBLIC_ROLE_RE,
} from "./categories";
import { CHILD_SAFETY_CATEGORY, checkChildSafety } from "./child-safety";
import { compileTerms, findTerm, matchVariants, normalizePrompt } from "./normalize";

export type PolicyAction = "allow" | "warn" | "block";

export type PolicyReason = {
  category: string;
  action: Exclude<PolicyAction, "allow">;
  matched?: string;
  ruleId?: string;
  hard?: boolean;
};

export type PolicyDecision = {
  action: PolicyAction;
  /** True only for the child-safety hard block. */
  hard: boolean;
  reasons: PolicyReason[];
};

export type RuleLike = {
  id: string;
  kind: "keyword" | "regex" | "category" | "allow";
  pattern: string;
  category: string | null;
  action: PolicyAction;
  enabled: boolean;
};

export type EvaluateOptions = {
  policy: AppSettings["policy"];
  rules: RuleLike[];
  /**
   * Break-glass (developer dry-run only): skip the *configurable* policy.
   * Has no effect on child safety, which always runs first.
   */
  bypassConfigurable?: boolean;
};

const MAX_REGEX_INPUT = 4000;

export function evaluatePolicy(text: string, opts: EvaluateOptions): PolicyDecision {
  // 1) Child safety — unconditional, first, not influenced by opts.
  const cs = checkChildSafety(text);
  if (cs.blocked) {
    return { action: "block", hard: true, reasons: [{ category: CHILD_SAFETY_CATEGORY, action: "block", hard: true, matched: cs.matched.join(" + ") }] };
  }
  if (opts.bypassConfigurable) return { action: "allow", hard: false, reasons: [] };

  const reasons: PolicyReason[] = [];
  const variants = matchVariants(text);
  const { policy } = opts;
  const enabledRules = opts.rules.filter((r) => r.enabled);

  // 2) Allowlist hard mode: prompt must mention at least one allowed topic.
  if (policy.allowlistMode) {
    const allowTerms = [...policy.allowedTopics, ...enabledRules.filter((r) => r.kind === "allow").flatMap((r) => splitList(r.pattern))];
    if (!findTerm(compileTerms(allowTerms), variants)) {
      reasons.push({ category: "not_allowlisted", action: "block" });
    }
  }

  // 3) Developer-defined rules.
  for (const r of enabledRules) {
    if (r.kind === "allow" || r.action === "allow") continue;
    let matched: string | null = null;
    if (r.kind === "keyword") matched = findTerm(compileTerms([r.pattern]), variants);
    else if (r.kind === "category") matched = findTerm(compileTerms(splitList(r.pattern)), variants);
    else if (r.kind === "regex") matched = matchRegex(r.pattern, text);
    if (matched) reasons.push({ category: r.category || `custom_${r.kind}`, action: r.action, matched, ruleId: r.id });
  }

  // 4) Built-in categories.
  for (const cat of POLICY_CATEGORIES) {
    const level = policy.categories[cat as PolicyCategory];
    if (level === "off") continue;
    const m = findTerm(CATEGORY_RES[cat], variants);
    if (m) reasons.push({ category: cat, action: level, matched: m });
  }

  // 5) Photorealistic faces of real people.
  if (policy.realFaces.enabled) {
    const person = findTerm(KNOWN_PEOPLE_RE, variants) ?? findTerm(PUBLIC_ROLE_RE, variants);
    if (person) {
      const photoreal = findTerm(PHOTOREAL_RE, variants);
      const stylised = findTerm(ART_STYLE_RE, variants);
      const isKnownName = Boolean(findTerm(KNOWN_PEOPLE_RE, variants));
      if (photoreal || (isKnownName && !stylised)) {
        reasons.push({ category: "real_person_photoreal", action: policy.realFaces.severity, matched: person });
      }
    }
  }

  // 6) Brand / logo impersonation.
  if (policy.brandImpersonation) {
    const brand = findTerm(BRAND_RE, variants);
    if (brand && findTerm(BRAND_USE_RE, variants)) reasons.push({ category: "brand_impersonation", action: "block", matched: brand });
  }

  const action: PolicyAction = reasons.some((r) => r.action === "block") ? "block" : reasons.some((r) => r.action === "warn") ? "warn" : "allow";
  return { action, hard: false, reasons };
}

function splitList(s: string) {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function matchRegex(pattern: string, text: string): string | null {
  try {
    const re = new RegExp(pattern, "iu");
    const m = re.exec(normalizePrompt(text).slice(0, MAX_REGEX_INPUT));
    return m ? m[0].slice(0, 80) : null;
  } catch {
    return null;
  }
}

/**
 * Optional safe-rewrite pass for *warn* outcomes: removes the matched terms and
 * nudges the model toward non-graphic output. Never used to rescue a block.
 */
export function safeRewrite(prompt: string, decision: PolicyDecision): string {
  let out = prompt;
  for (const r of decision.reasons) {
    if (r.action !== "warn" || !r.matched) continue;
    const words = r.matched.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    out = out.replace(new RegExp(`\\b${words.join("[\\s\\W]+")}(?:s|es)?\\b`, "giu"), "");
  }
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
  return `${out}${out ? ", " : ""}tasteful, non-graphic, safe for work`;
}
