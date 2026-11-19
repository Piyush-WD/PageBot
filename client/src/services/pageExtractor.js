export async function extractCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Unable to find the active tab.");

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const content =
          document.querySelector("#mw-content-text") ||
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.querySelector('[role="main"]') ||
          document.body;

        const clone = content.cloneNode(true);

        clone
          .querySelectorAll(
            "script, style, noscript, nav, footer, button, form, iframe, svg, " +
              "[role='navigation'], [aria-hidden='true'], " +
              ".mw-editsection, .toc, .sidebar, .navigation, .advertisement, .ads, " +
              ".reflist, .references, .mw-references-wrap, .navbox, .catlinks, " +
              ".hatnote, .mw-empty-elt, .noprint, sup.reference"
          )
          .forEach((el) => el.remove());

        clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
          const level = Number(h.tagName[1]);
          h.textContent = `${"#".repeat(level)} ${h.textContent.trim()}`;
        });

        // innerText only keeps line breaks for rendered elements,
        // so attach the clone off-screen while reading it.
        clone.style.cssText =
          "position:absolute;left:-99999px;top:0;width:900px;";
        document.body.appendChild(clone);
        const text = clone.innerText || "";
        clone.remove();

        return { title: document.title, url: window.location.href, text };
      },
    });

    if (!result?.result) throw new Error("Unable to extract webpage content.");

    const page = result.result;
    const text = page.text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 100000);
    if (!text) throw new Error("No readable content found on this page.");

    console.log("Extracted page:", { title: page.title, characters: text.length });
    return { title: page.title, url: page.url, text };
  } catch (error) {
    console.error("Page extraction failed:", error);
    throw error;
  }
}