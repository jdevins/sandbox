export function wordCount(text) {
  const str = String(text || '');
  const words = str.split(/\s+/).filter(Boolean);
  return { words: words.length, chars: str.length };
}
