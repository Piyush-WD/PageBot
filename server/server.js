require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");

const { chunkSections } = require("./utils");
const { topChunks } = require("./retrieval");

const app = express();
const port = process.env.PORT || 5000;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ---- Settings ----
// Separate models give each route its own daily token budget.
const SUMMARY_MODEL = "openai/gpt-oss-20b";
const CHAT_MODEL = "qwen/qwen3.8-27b";

const CONTEXT_LIMIT_CHARS = 12_000; // at or below this: send the whole page
const OUTLINE_MAX_CHARS = 10_000; // above it: send an outline of this size

const RAG_CHUNK_SIZE = 2_000;
const RAG_TOP_K = 5;

const CACHE_MAX = 100;

const OVERVIEW_PROMPT =
  "You are PageBot, a webpage companion. Tell the reader what a webpage contains so they can decide whether to read it. Write 2 sentences, about 40-50 words. Begin the very first sentence with \"This page\" followed by a verb such as covers, explores, details or describes, and use it to name the subject and the main topics or sections the page deals with. Do not open with a fact about the subject itself (such as a date, place, or definition); the first sentence must already describe the page's content. The second sentence adds the remaining topics or aspects the page covers. Describe what is on the page; do not summarise facts, figures or conclusions. The input may be a condensed outline of the page: treat it as the page itself and never mention the outline. Use only the provided content and never invent information. Write plain prose with no lists or markdown.";

const CHAT_PROMPT =
  "You are PageBot, an assistant that answers questions about the current webpage. Answer using only the provided webpage excerpts. Give clear, direct, and helpful answers. If the excerpts do not contain the answer, say that you couldn't find the information on this page. Never invent facts or use outside knowledge.";

// ---- Middleware ----
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    },
  },
});

app.use("/api/chat", limiter);
app.use("/api/summarize", limiter);

// ---- Helpers ----
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One system prompt + one user message -> the model's reply text.
// Retries up to 3 times for temporary failures (waits out 429 limits).
async function ask(systemPrompt, userContent, model = SUMMARY_MODEL) {
  let lastError;

  for (let i = 0; i < 3; i++) {
    try {
      const params = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
      };

      // Less hidden thinking = fewer tokens used. Only gpt-oss supports this.
      if (model.startsWith("openai/gpt-oss")) {
        params.reasoning_effort = "low";
      }

      const response = await groq.chat.completions.create(params);

      let answer = response.choices[0]?.message?.content || "";
      // Some models put their thinking in <think> tags; remove it.
      answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

      if (!answer) {
        throw new Error(`Empty response from ${model}.`);
      }

      return answer;
    } catch (error) {
      lastError = error;
      console.error(`Groq attempt ${i + 1} (${model}) failed:`, error.message);

      const status = error.status;

      // Errors a retry can't fix (bad key, bad request, etc.)
      if (status && [400, 401, 403, 404, 413].includes(status)) {
        throw error;
      }

      if (i === 2) break;

      if (status === 429) {
        const headers = error.headers || error.response?.headers;

        let retryAfter = Number(
          headers?.get?.("retry-after") || headers?.["retry-after"]
        );

        if (!retryAfter) {
          const match = error.message.match(/try again in ([\d.]+)s/i);
          retryAfter = match ? Number(match[1]) : 20;
        }

        const waitTime = Math.min(retryAfter * 1000 + 500, 60_000);
        console.log(`Rate limited. Retrying after ${waitTime / 1000}s`);
        await sleep(waitTime);
      } else {
        await sleep(1000 * Math.pow(2, i));
      }
    }
  }

  throw lastError;
}

// Builds a short outline of a long page: the start of every section.
// If the page has no headings, it samples the start, middle, and end instead.

function parseSections(text) {
  const sections = [];
  let current = { level: 0, heading: "", lines: [] };

  for (const line of text.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (m) {
      sections.push(current);
      current = { level: m[1].length, heading: m[2], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  return sections
    .map((s) => ({ ...s, content: s.lines.join("\n").trim() }))
    .filter((s) => s.heading || s.content);
}

const SKIP_HEADINGS =
  /^(references|external links|notes|see also|further reading|citations|bibliography)$/i;

function buildOutline(pageContent, title = "", maxChars = OUTLINE_MAX_CHARS) {
  const clean = (s) => s.replace(/\s+/g, " ").trim();
  const all = parseSections(pageContent);
  const intro = all.length && !all[0].heading ? all.shift() : null;
  const headed = all.filter((s) => !SKIP_HEADINGS.test(s.heading));

  // No headings at all: sample the start, middle, and end
  if (headed.length === 0) {
    const part = Math.floor(maxChars / 3);
    const mid = Math.floor(pageContent.length / 2);
    return [
      pageContent.slice(0, part),
      pageContent.slice(mid - part / 2, mid + part / 2),
      pageContent.slice(-part),
    ].join("\n\n[...]\n\n");
  }

  const structure = headed
    .slice(0, 60)
    .map((s) => `${"  ".repeat(Math.max(0, s.level - 2))}- ${s.heading}`)
    .join("\n");

  const head =
    `PAGE TITLE: ${title || headed[0].heading}\n\n` +
    (intro ? `INTRODUCTION:\n${clean(intro.content).slice(0, 1500)}\n\n` : "") +
    `SECTIONS:\n${structure}\n\n` +
    `SECTION PREVIEWS:\n`;

  const remaining = Math.max(0, maxChars - head.length);

  // If there are too many sections, take an evenly spaced subset
  let pick = headed.filter((s) => s.content);
  const maxPicks = Math.max(1, Math.floor(remaining / 100));
  if (pick.length > maxPicks) {
    const step = pick.length / maxPicks;
    pick = Array.from({ length: maxPicks }, (_, i) => pick[Math.floor(i * step)]);
  }

  const per = pick.length
    ? Math.max(60, Math.min(400, Math.floor(remaining / pick.length) - 40))
    : 0;

  const previews = pick
    .map((s) => `${s.heading}: ${clean(s.content).slice(0, per)}`)
    .join("\n");

  return (head + previews).slice(0, maxChars);
}


// Simple in-memory cache: same page text -> same summary, 0 tokens.
const summaryCache = new Map();

// ---- Routes ----
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "PageBot backend is running" });
});

app.post("/api/test", (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: "Message is required and must be a string.",
      },
    });
  }
  res.status(200).json({
    received: message,
    reply: "PageBot received your message!",
  });
});

app.post("/api/chat", async (req, res) => {
  const { pageContent, question } = req.body;
  if (
    typeof pageContent !== "string" ||
    typeof question !== "string" ||
    !pageContent.trim() ||
    !question.trim()
  ) {
    return res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: "Page content and question are required.",
      },
    });
  }

  try {
    const chunks = chunkSections(pageContent, RAG_CHUNK_SIZE, 200);
    const best = topChunks(chunks, question, RAG_TOP_K);
    const context = best.map((c) => c.text).join("\n\n---\n\n");

    console.log(
      `Page: ${pageContent.length} chars, sent: ${context.length} chars, chunks: ${best
        .map((c) => c.heading)
        .join(" | ")}`
    );

    const answer = await ask(
      CHAT_PROMPT,
      `Webpage excerpts:\n${context}\n\nQuestion:\n${question}`,
      CHAT_MODEL
    );
    res.status(200).json({ answer });
  } catch (error) {
    console.error("Groq chat error:", error.message);
    res.status(502).json({
      error: {
        code: "LLM_ERROR",
        message: "Could not get a response from the language model.",
      },
    });
  }
});

app.post("/api/summarize", async (req, res) => {
  const { pageContent, title } = req.body;

  if (typeof pageContent !== "string" || !pageContent.trim()) {
    return res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: "Page content is required and must be a string.",
      },
    });
  }

  const pageTitle = typeof title === "string" ? title.trim().slice(0, 200) : "";

  try {
    console.log("Page length:", pageContent.length);

    const key = crypto
      .createHash("sha256")
      .update(pageTitle + "\n" + pageContent)
      .digest("hex");
    if (summaryCache.has(key)) {
      console.log("Summary cache hit");
      return res.status(200).json({ summary: summaryCache.get(key), cached: true });
    }

    const isShort = pageContent.length <= CONTEXT_LIMIT_CHARS;
    const input = isShort
      ? (pageTitle ? `PAGE TITLE: ${pageTitle}\n\n` : "") + pageContent
      : buildOutline(pageContent, pageTitle);

    console.log("Model input:\n", input); // remove once you're happy

    const summary = await ask(OVERVIEW_PROMPT, input, SUMMARY_MODEL);

    if (summaryCache.size >= CACHE_MAX) {
      summaryCache.delete(summaryCache.keys().next().value);
    }
    summaryCache.set(key, summary);

    res.status(200).json({ summary, outline: !isShort });
  } catch (error) {
    console.error("Groq summarization error:", error.message);
    res.status(502).json({
      error: {
        code: "LLM_ERROR",
        message: "Could not summarize the webpage.",
      },
    });
  }
});

// ---- Error handler (must come after routes) ----
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: {
        code: "CONTENT_TOO_LARGE",
        message: "Webpage content is too large.",
      },
    });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body is not valid JSON.",
      },
    });
  }
  next(err);
});

app.listen(port, () => {
  console.log(`PageBot backend is running on port ${port}`);
});