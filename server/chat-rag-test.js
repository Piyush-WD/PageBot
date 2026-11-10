const { page } = require("./test-page");

async function ask(question) {
  const res = await fetch("http://localhost:5000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageContent: page, question }),
  });
  const data = await res.json();
  console.log(`Q: ${question}\nA: ${data.answer ?? JSON.stringify(data)}\n`);
}

(async () => {
  await ask("How long does the Zephyr cache keep entries?"); // expect 90 seconds
  await ask("How often does the Falcon index rebuild?");     // expect 6 hours
  await ask("When do releases ship?");                       // expect Tuesday
  await ask("Who is the CEO?");                              // not on page, should say so
})();