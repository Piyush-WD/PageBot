require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { topChunks } = require("./retrieval");

const { Ollama } = require("ollama");
const { chunkSections } = require("./utils");

const app = express();
const port = process.env.PORT || 5000;
const ollama = new Ollama({
  host: "https://ollama.com",
  headers: {
    Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
  },
});

// ---- Settings ----
const MODEL = "gpt-oss:120b";
const CONTEXT_LIMIT_CHARS = 100_000; // 1 call at or below this
const CHUNK_SIZE = 12_000;
const CHUNK_CONCURRENCY = 3;

const SECTION_PROMPT =
  "You are PageBot. Identify the main topic of the provided webpage section and briefly describe what aspects it covers. Write 1-2 concise sentences. Do not explain every detail or list minor examples. Do not invent information.";

const OVERVIEW_PROMPT =
  "You are PageBot. Create a brief overview of the webpage in 2-3 sentences. Explain what the page is about and the main aspects it covers, like a preview for someone deciding whether to read it. Avoid detailed explanations, repetition, and minor examples. Do not add information.";

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

// ---- Helper ----
// One system prompt + one user message -> the model's reply text
async function ask(systemPrompt, userContent) {
  const response = await ollama.chat({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  return response.message.content;
}

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

const RAG_CHUNK_SIZE = 2_000;
const RAG_TOP_K = 5;
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

    console.log(`Page: ${pageContent.length} chars, sent: ${context.length} chars, chunks: ${best.map((c) => c.heading).join(" | ")}`);

    const answer = await ask(
      "You are PageBot, an assistant that answers questions using excerpts from a webpage. Use only the excerpts. If the answer is not in them, say you couldn't find it on the page.",
      `Webpage excerpts:\n${context}\n\nQuestion:\n${question}`
    );
    res.status(200).json({ answer });
  } catch (error) {
    console.error("Ollama chat error:", error.message);
    res.status(502).json({
      error: {
        code: "LLM_ERROR",
        message: "Could not get a response from the language model.",
      },
    });
  }
});

app.post("/api/summarize", async (req, res) => {
  const { pageContent } = req.body;

  if (typeof pageContent !== "string" || !pageContent.trim()) {
    return res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: "Page content is required and must be a string.",
      },
    });
  }

  try {
    // SHORT PAGE: one call, no chunking
    if (pageContent.length <= CONTEXT_LIMIT_CHARS) {
      const summary = await ask(OVERVIEW_PROMPT, pageContent);
      return res.status(200).json({ summary, chunksProcessed: 1 });
    }

    // LONG PAGE: chunk, summarize each, combine
    const chunks = chunkSections(pageContent, CHUNK_SIZE, 500);
    if (chunks.length === 0) {
      return res.status(400).json({
        error: {
          code: "NO_CONTENT",
          message: "No readable webpage content was found.",
        },
      });
    }

    const chunkSummaries = [];

    for (let i = 0; i < chunks.length; i += CHUNK_CONCURRENCY) {
      const batch = chunks.slice(i, i + CHUNK_CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map((chunk) => ask(SECTION_PROMPT, chunk.text))
      );

      if (results.some((r) => r.status === "rejected")) {
        throw new Error("One or more chunk summarization requests failed.");
      }

      chunkSummaries.push(...results.map((r) => r.value));
    }

    const summary = await ask(OVERVIEW_PROMPT, chunkSummaries.join("\n\n"));
    res.status(200).json({ summary, chunksProcessed: chunks.length });
  } catch (error) {
    console.error("Ollama summarization error:", error.message);
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