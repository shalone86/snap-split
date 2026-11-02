// Turn on-screen text into something nice to hear (no HTML, no emoji, math symbols in words).

export function spoken(text) {
  return String(text ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/\s*=\s*\?/g, " equals what?")
    .replace(/\s*−\s*/g, " minus ")
    .replace(/\s*\+\s*/g, " plus ")
    .replace(/\s*×\s*/g, " times ")
    .replace(/\s*÷\s*/g, " divided by ")
    .replace(/\s*=\s*/g, " equals ")
    .replace(/[⬅➡]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
