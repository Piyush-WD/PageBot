require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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

app.use(helmet());
app.use(cors());
app.use(express.json( {limit: '100kb'}));

const limiter = rateLimit({
  windowMs: 60*1000, //1 minute
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

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "PageBot backend is running" });
});

app.post("/api/test", (req,res)=> {
  const {message} = req.body;
  if(!message||typeof message !== "string"){
    return res.status(400).json({
      error:{
        code: "INVALID INPUT",
        message: "Message is required and must be a string."
      },
    });
  }
  res.status(200).json({
    received: message,
    reply: "PageBot received your message!"
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
    const response = await ollama.chat({
      model: "gpt-oss:120b",
      messages: [
        {
          role: "system",
          content:
            "You are PageBot, an assistant that answers questions using the provided webpage content. If the answer is not in the content, say so clearly.",
        },
        {
          role: "user",
          content: `Webpage content:\n${pageContent}\n\nQuestion:\n${question}`,
        },
      ],
    });
    res.status(200).json({
      answer: response.message.content,
    });
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

const MAX_PAGE_CONTENT_LENGTH = 50_000; // 50,000 characters
app.post("/api/summarize", async (req,res) => {
  const { pageContent } = req.body;
  if(typeof pageContent !== "string" || !pageContent.trim()) {
    return res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: "Page content is required and must be a string.",
      },
    });
  }
  if(pageContent.length > MAX_PAGE_CONTENT_LENGTH) {
    return res.status(413).json({
      error: {
        code: "CONTENT_TOO_LARGE",
        message: "Webpage content is too large.",
      },
    });
  }
  try {
    //1. Split the webpage into heading-aware chunks
    const chunks = chunkSections(pageContent);
    if(chunks.length===0){
      return res.status(400).json({
        error: {
          code: "NO_CONTENT",
          message: "No readable webpage content was found.",
        },
      });
    }
    //2. Summarize each chunk
    const chunkSummaries = [];
    for(const chunk of chunks){
      const response = await ollama.chat({
        model: "gpt-oss:120b-cloud",
        messages: [
          {
            role: "system",
            content:
  "You are PageBot. Identify the main topic of the provided webpage section and briefly describe what aspects it covers. Write 1-2 concise sentences. Do not explain every detail or list minor examples. Do not invent information.",
          },
          {
            role: "user",
            content: chunk.text,
          },
        ],
      });
      chunkSummaries.push(response.message.content);
    }
    //3. Combine the chunk summaries into one coherent summary
    const finalResponse = await ollama.chat({
      model: "gpt-oss:120b-cloud",
      messages: [
        {
          role: "system",
          content:
  "You are PageBot. Create a brief overview of the webpage in 2-3 sentences. Explain what the page is about and the main aspects it covers, like a preview for someone deciding whether to read it. Avoid detailed explanations, repetition, and minor examples. Do not add information.",
        },
        {
          role: "user",
          content: chunkSummaries.join("\n\n"),
        },
      ],
    });
    //4. Return the final summary
    res.status(200).json({
      summary: finalResponse.message.content,
      chunkProcessed: chunks.length,
    });
  } catch (error) {
    console.log("Ollama summarization error:", error.message);
    res.status(502).json({
      error: {
        code: "LLM_ERROR",
        message: "Could not summarize the webpage.",
      },
    });
  }
});

app.listen(port, () => {
  console.log(`PageBot backend is running on port ${port}`);
});