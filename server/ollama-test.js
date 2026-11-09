require("dotenv").config();

const { Ollama } = require("ollama");

const ollama = new Ollama({
    host: "https://ollama.com",
    headers: {
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
    },
});

async function testOllama() {
    console.log("Calling Ollama...");
    try {
        const response = await ollama.chat({
            model: "gpt-oss:120b",
            messages: [
                {
                    role: "user",
                    content: "Reply with: Pagebot connected successfully!",
                },
            ],
        });
        console.log(response.message.content);
    } catch (error) {
        console.error("Ollama connection failed:", error.message);
    }
}

testOllama();