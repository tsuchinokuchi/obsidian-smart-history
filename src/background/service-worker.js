import { ObsidianClient } from './obsidianClient.js';
import { GeminiClient } from './gemini.js';
import { getSettings, StorageKeys } from '../utils/storage.js';

const obsidian = new ObsidianClient();
const gemini = new GeminiClient();

// We don't use a global variable for lastMemoUrl anymore because SW can sleep.
// We use chrome.storage.local instead.

console.log('Service Worker v3.4 Loaded');

// Cache to store tab data including content and validation status
// Key: TabID, Value: { title, url, content, isValidVisit, timestamp }
const tabCache = new Map();

// Initialize cache with currently open tabs (basic info only)
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    if (tab.url && tab.url.startsWith('http')) {
      tabCache.set(tab.id, {
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        lastUpdated: Date.now(),
        isValidVisit: false, // Default to false until proven valid
        content: null
      });
    }
  });
});

// Update cache on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    tabCache.set(tabId, {
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      lastUpdated: Date.now(),
      isValidVisit: false, // Reset validity on new page load
      content: null
    });

    // Check Focus Mode and update badge
    checkFocusMode();
  }
});

// Helper to check focus mode and set badge
async function checkFocusMode() {
  const settings = await getSettings();
  if (settings[StorageKeys.FOCUS_MODE]) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#2e8b57' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initial check
checkFocusMode();


// Helper to normalize URL for context comparison (ignore hash and trailing slash)
function getContextUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.origin + u.pathname.replace(/\/$/, ''); // Ignore hash and search query? Maybe keep search query. 
    // Wikipedia pages often change hash. keep search, ignore hash.
  } catch (e) {
    return urlStr;
  }
}

// Listen for messages from Content Script and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Handle Valid Visit (Auto-save)
  if (message.type === 'VALID_VISIT' && sender.tab) {
    (async () => {
      const tabId = sender.tab.id;
      const currentData = tabCache.get(tabId) || {};

      // Update cache
      tabCache.set(tabId, {
        ...currentData,
        title: sender.tab.title,
        url: sender.tab.url,
        content: message.payload.content,
        isValidVisit: true
      });

      console.log(`Tab ${tabId} marked as VALID visit. Processing immediately...`);

      // Check if this URL has already been saved
      const url = sender.tab.url;
      const savedUrls = await chrome.storage.local.get('savedUrls');
      const urlSet = new Set(savedUrls.savedUrls || []);

      if (urlSet.has(url)) {
        console.log(`URL already saved, skipping: ${url}`);
        return;
      }

      // Update Context for Memos too!
      // If we auto-save, we establish this page as the current context.
      const normalizedUrl = getContextUrl(url);
      await chrome.storage.local.set({ lastMemoUrl: normalizedUrl });

      // Trigger AI Summary immediately
      try {
        const settings = await getSettings();
        const apiKey = settings[StorageKeys.GEMINI_API_KEY];
        const modelName = settings[StorageKeys.GEMINI_MODEL] || 'gemini-2.5-flash';
        const focusMode = settings[StorageKeys.FOCUS_MODE];
        const targetNote = settings[StorageKeys.TARGET_NOTE];
        const summaryLength = settings[StorageKeys.SUMMARY_LENGTH] || 'short';

        let summary = "Summary not available.";
        if (apiKey && message.payload.content) {
          console.log(`Generating AI Summary using ${modelName} (${summaryLength})...`);
          summary = await gemini.generateSummary(message.payload.content, apiKey, modelName, summaryLength);
        } else if (!apiKey) {
          console.warn("Gemini API Key is missing in settings.");
          summary = "No Gemini API Key configured.";
        }

        // Sanitize summary to prevent breaking markdown list
        summary = summary.replace(/\n/g, ' ');

        // Format the entry
        const timestamp = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const markdown = `- ${timestamp} [${sender.tab.title}](${sender.tab.url})\n    - AI要約: ${summary}`;

        if (focusMode && targetNote) {
          console.log(`Focus Mode ON. Appending to: ${targetNote}`);
          await obsidian.appendToNote(targetNote, markdown);
        } else {
          console.log(`Focus Mode OFF. Appending to Daily Note.`);
          await obsidian.appendToDailyNote(markdown);
        }

        console.log("Saved to Obsidian successfully.");

        // Add URL to saved list
        urlSet.add(url);
        await chrome.storage.local.set({ savedUrls: Array.from(urlSet) });
        console.log(`URL added to saved list: ${url}`);

        // Success Notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '../icons/icon128.png',
          title: 'Saved to Obsidian',
          message: `Saved: ${sender.tab.title}`
        });

        // Send success response
        sendResponse({ success: true });

      } catch (e) {
        console.error("Failed to sync to Obsidian", e);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '../icons/icon128.png',
          title: 'Obsidian Sync Failed',
          message: `Error: ${e.message}`
        });
        sendResponse({ success: false, error: e.message });
      }
    })();

    return true; // Keep channel open
  }

  // 2. Handle Popup Actions
  if (message.type === 'GET_ACTIVE_NOTE') {
    obsidian.getActiveNote()
      .then(path => sendResponse({ success: true, path }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'CREATE_NOTE') {
    obsidian.createNote(message.path, message.content)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'SEND_MEMO') {
    (async () => {
      try {
        let title = message.title;
        let url = message.url;

        // Fallback to active tab if no context provided (e.g. from popup)
        if (!title || !url) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            title = tab.title;
            url = tab.url;
          }
        }

        if (!url) throw new Error("No URL context found");

        // Normalize
        const normalizedUrl = getContextUrl(url);

        // Retrieve last memo context from storage (persistent)
        const storageData = await chrome.storage.local.get('lastMemoUrl');
        const lastUrl = storageData.lastMemoUrl;

        // Is this a new context (different URL than last time)?
        const isNewContext = (normalizedUrl !== lastUrl);

        // Update global context in storage
        await chrome.storage.local.set({ lastMemoUrl: normalizedUrl });

        await obsidian.appendMemo(message.path, message.memo, title, url, isNewContext);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'SEARCH_FILES') {
    obsidian.searchFiles(message.query)
      .then(results => sendResponse({ success: true, results }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'RESOLVE_PATH') {
    obsidian.resolvePath(message.path)
      .then(resolvedPath => {
        if (resolvedPath) sendResponse({ success: true, resolvedPath });
        else sendResponse({ success: false });
      })
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'CHECK_FOCUS_MODE') {
    checkFocusMode().then(() => sendResponse({ success: true }));
    return true;
  }
});


// Handle Tab Closure - Cleanup only
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabCache.has(tabId)) {
    tabCache.delete(tabId);
  }
});
