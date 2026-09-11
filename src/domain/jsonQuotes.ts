/** Repair smart string delimiters only at positions required by strict JSON grammar.
 * U+201D may open a key/value token too (iOS copies empty strings as ””).
 * ASCII strings (including their smart punctuation) and all escapes stay verbatim.
 * Balanced smart quotes nested in smart-delimited text remain literal punctuation.
 * Unmatched quotes, mixed delimiter pairs, comments, and trailing commas are rejected.
 */
function normalizeSmartDelimiters(text: string): string {
  let position = 0;
  const replacements: number[] = [];
  const fail = (): never => { throw new SyntaxError('Unrecognized JSON quoting'); };
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[position] ?? '') && position < text.length) position++; };
  function string() {
    const start = position, opening = text[position++];
    if (opening !== '"' && opening !== '“' && opening !== '”') fail();
    let nested = 0;
    while (position < text.length) {
      const index = position++, char = text[index];
      if (char === '\\') { position++; continue; } // JSON.parse validates the untouched escape.
      if (opening === '"') { if (char === '"') return; continue; }
      if (char === '“') { nested++; continue; }
      if (char === '”') {
        if (nested > 0) { nested--; continue; }
        replacements.push(start, index); return;
      }
    }
    fail();
  }
  function value(depth: number) {
    if (depth > 64) fail(); // Bound fallback stack usage; never guess at deeply nested input.
    whitespace();
    const char = text[position];
    if (char === '"' || char === '“' || char === '”') { string(); return; }
    if (char === '{' || char === '[') {
      const object = char === '{', closing = object ? '}' : ']';
      position++; whitespace();
      if (text[position] === closing) { position++; return; }
      while (position < text.length) {
        if (object) { whitespace(); string(); whitespace(); if (text[position++] !== ':') fail(); }
        value(depth + 1); whitespace();
        const separator = text[position++];
        if (separator === closing) return;
        if (separator !== ',') fail();
      }
      fail();
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(position));
    if (!token) fail();
    position += token![0].length;
  }
  value(0); whitespace();
  if (position !== text.length || !replacements.length) fail();
  const chars = text.split('');
  for (const index of replacements) chars[index] = '"';
  return chars.join('');
}

export function parseJsonWithSmartQuotes(text: string): unknown {
  try { return JSON.parse(text); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return JSON.parse(normalizeSmartDelimiters(text));
  }
}
