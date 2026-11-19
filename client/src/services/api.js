// This file separates API communication from UI Logic, good React practice

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Summarize webpage
export async function summarizePage(pageContent) {
  const response = await fetch(`${API_URL}/api/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pageContent }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Failed to summarize webpage."
    );
  }

  return data;
}

// Ask a question about the webpage
export async function askQuestion(pageContent, question) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pageContent, question }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Failed to get an answer."
    );
  }

  return data;
}
