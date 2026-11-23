# PageBot – AI-Powered Browser Assistant

**Your webpage, understood in seconds.**

PageBot is an AI-powered Chrome extension that automatically summarizes webpages and allows users to ask questions based on the content of the currently opened page. It makes consuming lengthy online content faster and more interactive by bringing AI assistance directly into the browser.

## 🚀 Features

- **Automatic Webpage Summarization:** Generates a concise summary of the current webpage when the user opens PageBot.
- **Contextual Question Answering:** Allows users to ask questions about the webpage and receive answers based on its content.
- **AI-Powered Processing:** Leverages Large Language Models (LLMs) to understand webpage content and generate meaningful responses.
- **Browser Integration:** Provides an accessible extension interface without requiring users to leave their current webpage.
- **On-Demand Assistance:** Enables interactive exploration of webpage content through follow-up questions.

## 🛠️ Tech Stack

- **Language:** JavaScript
- **Frontend:** HTML, CSS
- **Platform:** Chrome Extension API
- **AI Integration:** Large Language Model (LLM) API

## 📸 Screenshots



### 1. Automatic Webpage Summary

<img width="1920" height="1008" alt="image" src="https://github.com/user-attachments/assets/980bd2fd-e246-4951-88c1-ff5f05266db3" />


### 2. Contextual Question Answering

<img width="1920" height="1008" alt="image" src="https://github.com/user-attachments/assets/3f6d5e29-12e6-49df-a63d-745f91bfb0f7" />


## ⚙️ How It Works

1. The user opens a webpage and accesses PageBot through the Chrome extension.
2. PageBot extracts the relevant content from the currently opened webpage.
3. The extracted content is processed using an LLM to generate a concise summary.
4. Users can ask questions related to the webpage.
5. PageBot uses the webpage context to generate relevant, contextual responses.

## 💻 Installation & Setup

PageBot can be installed locally using Chrome's Developer Mode.

1. Clone the repository:

   ```bash
   git clone https://github.com/Piyush-WD/PageBot.git
   ```

2. Navigate to the project directory.

3. Configure the required API credentials as described in the project configuration.

4. Open Google Chrome and navigate to:

   ```text
   chrome://extensions
   ```

5. Enable **Developer mode**.

6. Click **Load unpacked** and select the extension directory containing `manifest.json`.

7. Open any webpage and launch PageBot from the Chrome toolbar.

## 🔐 Security & Configuration

- Keep API credentials and sensitive configuration outside publicly committed source files.
- Do not commit `.env` files or API secrets.
- Configure the required API credentials before running the extension.

## 🔮 Future Enhancements

- Support for summarizing PDFs and other document formats.
- Improved handling of lengthy webpages and large context windows.
- Conversation history for individual webpages.
- Support for multiple LLM providers.
- Improved response streaming and user experience.

## 👨‍💻 Developer

**Piyush Gupta**

- GitHub: [Piyush-WD](https://github.com/Piyush-WD)
- Project Repository: [PageBot](https://github.com/Piyush-WD/PageBot)

---

*PageBot – Spend less time reading, more time understanding.*
