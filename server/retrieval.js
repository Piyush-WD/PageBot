const STOPWORDS = new Set(
  "a an the is are was were be been of in on at to for and or but with by from as it this that these those what which who how when where why does do did can could should would about into than then there their its".split(" ")
);

function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
    (w) => w.length > 1 && !STOPWORDS.has(w)
  );
}

// Returns the k chunks that best match the question, in original page order
function topChunks(chunks, question, k = 5) {
  if (chunks.length <= k) return chunks;

  const docs = chunks.map((c) => tokenize(c.text));
  const N = docs.length;
  const avgLen = docs.reduce((sum, d) => sum + d.length, 0) / N || 1;

  // In how many chunks does each word appear?
  const df = new Map();
  for (const d of docs) {
    for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  }

  const k1 = 1.5;
  const b = 0.75;
  const queryWords = [...new Set(tokenize(question))];

  const scored = docs.map((d, i) => {
    const tf = new Map();
    for (const w of d) tf.set(w, (tf.get(w) || 0) + 1);

    let score = 0;
    for (const w of queryWords) {
      const f = tf.get(w);
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgLen));
    }
    return { i, score };
  });

  // Nothing matched at all: fall back to the start of the page
  if (scored.every((s) => s.score === 0)) return chunks.slice(0, k);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .sort((a, b) => a.i - b.i) // back to page order so it reads naturally
    .map((s) => chunks[s.i]);
}

module.exports = { topChunks };