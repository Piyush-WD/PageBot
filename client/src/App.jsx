import { loadChat, saveChat } from "./services/chatStorage";
import { useEffect, useRef, useState } from "react";
import { extractCurrentPage } from "./services/pageExtractor";
import { summarizePage, askQuestion } from "./services/api";
import "./App.css";

function App() {
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [question, setQuestion] = useState("");
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        setError("");

        const data = await extractCurrentPage();
        setPage(data);

        const saved = await loadChat(data.url);
        setMessages(saved);
        setHistoryLoaded(true);

        setLoading(false);
        setSummaryLoading(true);

        try {
          const result = await summarizePage(data.text);
          setSummary(result.summary);
        } catch (err) {
          console.error("Summarization failed:", err);
          setSummaryError(err.message);
        }
      } catch (err) {
        console.error("Page extraction failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
        setSummaryLoading(false);
      }
    }

    loadPage();
  }, []);

  // Scroll to the latest chat message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (!historyLoaded || !page) return;
    saveChat(page.url, messages);
  }, [messages, historyLoaded, page]);

  async function handleSendQuestion(e) {
    e.preventDefault();

    const currentQuestion = question.trim();

    if (!currentQuestion || !page || chatLoading) return;

    setQuestion("");
    setChatError("");

    setMessages((prev) => [
      ...prev,
      { role: "user", content: currentQuestion },
    ]);

    setChatLoading(true);

    try {
      const result = await askQuestion(
        page.text,
        currentQuestion
      );

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer },
      ]);
    } catch (err) {
      console.error("Chat failed:", err);
      setChatError(err.message);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="pagebot">

      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <h1>PageBot</h1>
            <span>Your webpage companion</span>
          </div>
        </div>
      </header>

      {/* Current webpage */}
      <section className="page-info">
        <div className="section-label">CURRENT PAGE</div>

        {loading ? (
          <p>Reading webpage...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <>
            <h2>{page.title}</h2>
            <p>{page.url}</p>
          </>
        )}
      </section>

      {/* Summary */}
      <main className="content">
        <div className="section-heading">
          <h2>Page Summary</h2>
          <span className="tag">AI SUMMARY</span>
        </div>

        <div className="summary-result">
          {summaryLoading ? (
            <div className="loading-state">
              <div className="loader"></div>
              <h3>Analyzing webpage...</h3>
              <p>PageBot is reading and understanding the content.</p>
            </div>
          ) : summaryError ? (
            <div className="error-state">
              <h3>Couldn't summarize this page</h3>
              <p>{summaryError}</p>
            </div>
          ) : summary ? (
            <div className="summary-text">{summary}</div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">✦</div>
              <h3>Understand any page faster</h3>
              <p>Your page summary will appear here.</p>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="chat-section">
          <div className="section-heading">
            <h2>Ask about this page</h2>
          </div>

          {messages.length === 0 && (
            <div className="chat-placeholder">
              <p>
                Have a question? Ask PageBot anything
                about the current webpage.
              </p>
            </div>
          )}

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chat-message ${message.role}`}
              >
                <span className="message-label">
                  {message.role === "user" ? "You" : "PageBot"}
                </span>
                <p>{message.content}</p>
              </div>
            ))}

            {chatLoading && (
              <div className="chat-message assistant">
                <span className="message-label">PageBot</span>
                <p className="typing-indicator">Thinking...</p>
              </div>
            )}

            {chatError && (
              <div className="chat-error">
                {chatError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Input */}
      <form className="chat-input" onSubmit={handleSendQuestion}>
        <input
          type="text"
          placeholder="Ask a follow-up question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!page || loading || chatLoading}
        />

        <button
          type="submit"
          disabled={!question.trim() || !page || chatLoading}
          aria-label="Send question"
        >
          ➤
        </button>
      </form>

      {/* Footer */}
      <footer className="footer">
        PageBot processes the current webpage to answer your questions.
      </footer>

    </div>
  );
}

export default App;
