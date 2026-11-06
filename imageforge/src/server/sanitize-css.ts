/**
 * Conservative sanitizer for the developer's custom CSS snippet. It is injected
 * into a <style> tag, so we strip anything that could break out of the tag,
 * load remote resources, or execute script in legacy engines.
 */
export function sanitizeCss(input: string): string {
  let css = input.slice(0, 5000);
  css = css.replace(/\/\*[\s\S]*?\*\//g, ""); // comments (can hide tricks)
  css = css.replace(/[<>]/g, ""); // no tag breakout
  css = css.replace(/\\/g, ""); // no escape sequences (e.g. \75rl( obfuscation)
  css = css.replace(/@import[^;]*;?/gi, "");
  css = css.replace(/@charset[^;]*;?/gi, "");
  css = css.replace(/@namespace[^;]*;?/gi, "");
  css = css.replace(/url\s*\([^)]*\)/gi, "none");
  css = css.replace(/image-set\s*\([^)]*\)/gi, "none");
  css = css.replace(/expression\s*\(/gi, "");
  css = css.replace(/javascript\s*:/gi, "");
  css = css.replace(/(-moz-binding|behavior)\s*:[^;}]*;?/gi, "");
  return css.trim();
}
