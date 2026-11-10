const assert = require("assert");
const { chunkSections } = require("./utils");
const { topChunks } = require("./retrieval");
const { page } = require("./test-page");

const chunks = chunkSections(page, 2000, 200);
console.log(`Page: ${page.length} chars -> ${chunks.length} chunks`);
assert(chunks.length > 6, "page should produce many chunks, or retrieval isn't being exercised");
chunks.forEach((c) => assert(c.text.length <= 2000, "chunk too long"));

// 1. Each question should pull in the chunk that holds the answer
const cases = [
  ["How long does the Zephyr cache keep entries?", "90 seconds"],
  ["How long do login tokens last?", "15 minutes"],
  ["When does the Marigold service generate invoices?", "3rd of every month"],
  ["How often does the Falcon index rebuild?", "6 hours"],
  ["How many days are logs kept?", "30 days"],
  ["When do releases ship?", "Tuesday"],
];

for (const [question, expected] of cases) {
  const best = topChunks(chunks, question, 2);
  console.log(`\nQ: ${question}\n   picked: ${best.map((c) => c.heading).join(" | ")}`);
  assert(best.some((c) => c.text.includes(expected)), `answer "${expected}" not retrieved`);
}

// 2. Never returns more than k
assert(topChunks(chunks, "login tokens", 3).length <= 3);

// 3. Results come back in page order
const ordered = topChunks(chunks, "cache login invoices", 4);
const positions = ordered.map((c) => chunks.indexOf(c));
assert.deepStrictEqual(positions, [...positions].sort((a, b) => a - b), "not in page order");

// 4. No keyword match: falls back to the start of the page
assert.deepStrictEqual(topChunks(chunks, "quantum banana", 3), chunks.slice(0, 3));

// 5. Question made only of stopwords: also falls back
assert.deepStrictEqual(topChunks(chunks, "what is the", 3), chunks.slice(0, 3));

// 6. Short pages: if chunks <= k, return all of them
const few = chunks.slice(0, 3);
assert.deepStrictEqual(topChunks(few, "anything", 5), few);

console.log("\nAll retrieval assertions passed");