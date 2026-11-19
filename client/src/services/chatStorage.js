const PREFIX = "pagebot_chat_";
const MAX_MESSAGES = 50;

// Ignore the #fragment so the same page always maps to one history
const keyFor = (url) => PREFIX + url.split("#")[0];

const hasChromeStorage =
  typeof chrome !== "undefined" && chrome.storage?.local;

export async function loadChat(url) {
  const key = keyFor(url);
  if (hasChromeStorage) {
    const data = await chrome.storage.local.get(key);
    return data[key] || [];
  }
  // Fallback for running in a normal browser tab during development
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

export async function saveChat(url, messages) {
  const key = keyFor(url);
  const trimmed = messages.slice(-MAX_MESSAGES);
  if (hasChromeStorage) {
    await chrome.storage.local.set({ [key]: trimmed });
  } else {
    localStorage.setItem(key, JSON.stringify(trimmed));
  }
}

export async function clearChat(url) {
  const key = keyFor(url);
  if (hasChromeStorage) {
    await chrome.storage.local.remove(key);
  } else {
    localStorage.removeItem(key);
  }
}