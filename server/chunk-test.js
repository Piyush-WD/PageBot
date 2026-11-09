const assert = require("assert");
const { chunkText } = require("./utils");

const sampleText = `
# How Artificial Intelligence Is Changing Web Development

Artificial Intelligence is becoming an important part of modern web development. Developers are using AI-powered tools to write code, identify bugs, generate documentation, and improve productivity. These tools can reduce repetitive work, but developers still need to understand the code they produce and verify that it behaves correctly.

## AI-Assisted Coding

AI coding assistants can suggest functions, explain unfamiliar code, and help developers debug errors. They are especially useful when working with large codebases or learning a new framework. However, generated code may contain security issues, inefficient logic, or incorrect assumptions. Developers should review and test suggestions rather than accepting them blindly.

## Frontend Development

In frontend development, AI can help generate user interface components, improve accessibility, and suggest responsive layouts. A developer might describe a form or dashboard in natural language and receive an initial implementation. The result still needs refinement to match the product's design system and user experience requirements.

## Backend Development

Backend developers can use AI to draft API routes, write database queries, and generate test cases. AI tools can also explain authentication flows, validation rules, and error handling. However, sensitive operations such as authorization, payment processing, and data access require careful human review.

## Performance and Reliability

Web applications must remain responsive as traffic increases. Developers use caching, database indexing, load balancing, and background jobs to improve performance. AI can help identify possible bottlenecks, but performance improvements should be verified through profiling and realistic load testing.

## Security Considerations

AI-generated code should not be assumed to be secure. Developers must validate user input, protect secrets, apply appropriate access controls, and keep dependencies updated. Security testing should be part of the development process rather than something added only before deployment.

## The Future of Development

AI is likely to change how developers spend their time. Routine implementation tasks may become faster, while system design, debugging, code review, and product decisions remain important. Developers who understand fundamentals and know how to evaluate AI-generated work will be better prepared to use these tools effectively.
`;

// ---- sample text test, with checks ----
const MAX = 500;
const chunks = chunkText(sampleText, MAX, 300);

console.log("Total chunks:", chunks.length);
chunks.forEach((c, i) => console.log(`\n--- Chunk ${i + 1} (${c.length}) ---\n${c}`));

assert(chunks.length > 1, "should produce multiple chunks");
chunks.forEach((c, i) => assert(c.length <= MAX, `chunk ${i + 1} exceeds max (${c.length})`));

chunks.forEach((c, i) => {
  assert(!/learninganew|queries,and|developmentprocess/.test(c), `merged words in chunk ${i + 1}`);
});

// Overlap: the start of each chunk should repeat the end of the previous one
for (let i = 1; i < chunks.length; i++) {
  const startOfNext = chunks[i].slice(0, 40);
  assert(chunks[i - 1].includes(startOfNext), `no overlap between chunk ${i} and ${i + 1}`);
}

// Nothing lost: every original word appears somewhere
const joined = chunks.join(" ");
for (const word of sampleText.split(/\s+/).filter(Boolean)) {
  assert(joined.includes(word), `missing word: ${word}`);
}

// ---- edge cases ----
assert.deepStrictEqual(chunkText(""), []);
assert.deepStrictEqual(chunkText("   \n\n  "), []);

const long = "word ".repeat(2000); // 10k chars, no punctuation
chunkText(long, 500, 100).forEach((c) => assert(c.length <= 500));

const blob = "a".repeat(1500); // no whitespace at all
chunkText(blob, 500, 100).forEach((c) => assert(c.length <= 500));

const list = Array.from({ length: 100 }, (_, i) => `- item ${i}`).join("\n");
const listChunks = chunkText(list, 500, 100);
listChunks.forEach((c) => assert(c.length <= 500));
console.log("\nList sample (newlines should survive):\n", listChunks[0].slice(0, 80));

const abbr = "Dr. Smith met Mr. Jones at 3.14 p.m. in the U.S. office. They talked.";
const abbrChunks = chunkText(abbr, 40, 0);
console.log("\nAbbreviation chunks:", abbrChunks);
abbrChunks.forEach((c) => assert(!/\b(Dr|Mr)\.$/.test(c), `chunk ends on abbreviation: ${c}`));

const { chunkSections } = require("./utils");

const sec = chunkSections(sampleText, 500, 100);
sec.forEach((c, i) => {
  assert(c.text.length <= 500, `section chunk ${i + 1} too long`);
  assert(!/^##? /.test(c.text.trim().split("\n").pop()), `chunk ${i + 1} ends on a bare heading`);
});
console.log("\nSection chunks:", sec.length);
console.log(sec[3]);

console.log("\nAll assertions passed");

const longSection = "# Guide\n\n## Setup\n\n" + "This is a sentence about setup. ".repeat(100);
const longSec = chunkSections(longSection, 500, 100);
longSec.forEach((c) => assert(c.text.length <= 500, "long section chunk too long"));
assert(longSec.length > 1);
assert(longSec.every((c) => c.text.startsWith("Guide > Setup")));
console.log("Long section chunks:", longSec.length);