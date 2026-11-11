
import { useState } from "react";
import "./App.css";

function App() {
  const [question, setQuestion] = useState("");

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

        <div className="status">
          <span className="status-dot"></span>
          Ready
        </div>
      </header>

      {/* Current webpage */}
      <section className="page-info">
        <div className="section-label">CURRENT PAGE</div>
        <h2>Waiting for webpage...</h2>
        <p>Open a webpage to get started with PageBot.</p>
      </section>

      {/* Summary */}
      <main className="content">
        <div className="section-heading">
          <h2>Page Summary</h2>
          <span className="tag">AI SUMMARY</span>
        </div>

        <div className="empty-state">
          <div className="empty-icon">✦</div>
          <h3>Understand any page faster</h3>
          <p>
            Open a webpage and PageBot will extract
            the important information for you.
          </p>
        </div>

        {/* Takeaway */}
        <div className="takeaway">
          <div className="takeaway-label">
            <span>✦</span> MAIN TAKEAWAY
          </div>
          <p>
            Your key takeaway will appear here once
            the webpage has been summarized.
          </p>
        </div>

        {/* Chat */}
        <div className="chat-section">
          <div className="section-heading">
            <h2>Ask about this page</h2>
          </div>

          <div className="chat-placeholder">
            <p>
              Have a question? Ask PageBot anything
              about the current webpage.
            </p>
          </div>
        </div>
      </main>

      {/* Input */}
      <form
        className="chat-input"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="text"
          placeholder="Ask a follow-up question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button
          type="submit"
          disabled={!question.trim()}
          aria-label="Send question"
        >
          ↑
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
