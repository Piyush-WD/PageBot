
export async function extractCurrentPage() {
  try {
    // Find the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new Error("Unable to find the active tab.");
    }

    // Extract webpage information
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },

      func: () => ({
        title: document.title,
        url: window.location.href,
        text: document.body?.innerText || "",
      }),
    });

    if (!result?.result) {
      throw new Error("Unable to extract webpage content.");
    }

    const page = result.result;

    const text = page.text.trim().slice(0, 20000);

    if (!text) {
      throw new Error("No readable content found on this page.");
    }

    return {
      title: page.title,
      url: page.url,
      text,
    };

  } catch (error) {
    console.error("Page extraction failed:", error);
    throw error;
  }
}
