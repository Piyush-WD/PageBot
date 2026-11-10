const filler =
  "This paragraph gives general background that applies to the whole system and does not describe any single feature in detail. ".repeat(12);

const sections = [
  { title: "Caching", fact: "The Zephyr cache keeps entries for 90 seconds before evicting them." },
  { title: "Authentication", fact: "Login tokens expire after 15 minutes." },
  { title: "Billing", fact: "The Marigold service generates invoices on the 3rd of every month." },
  { title: "Search", fact: "The Falcon index rebuilds every 6 hours." },
  { title: "Logging", fact: "Logs are kept for 30 days in the Basalt store." },
  { title: "Deployment", fact: "Releases ship every Tuesday after the Granite review." },
];

const page =
  "# Platform Guide\n\n" +
  sections.map((s) => `## ${s.title}\n\n${filler}\n\n${s.fact}`).join("\n\n");

module.exports = { page, sections };