console.log("Obsidian Smart History: Content Script Loaded (DEBUG MODE)");

// Default settings
let minVisitDuration = 5; // seconds
let minScrollDepth = 50;  // percentage

let startTime = Date.now();
let maxScrollPercentage = 0;
let isValidVisitReported = false;

// Load settings
chrome.storage.local.get(['min_visit_duration', 'min_scroll_depth'], (result) => {
    if (result.min_visit_duration) minVisitDuration = parseInt(result.min_visit_duration, 10);
    if (result.min_scroll_depth) minScrollDepth = parseInt(result.min_scroll_depth, 10);
    console.log(`Settings loaded: Min Dur=${minVisitDuration}s, Min Scroll=${minScrollDepth}%`);
});

function checkConditions() {
    if (isValidVisitReported) return;

    const duration = (Date.now() - startTime) / 1000;

    // DEBUG LOG: Show status every second
    // console.log(`Status: Duration=${duration.toFixed(1)}s, MaxScroll=${maxScrollPercentage.toFixed(1)}%`);

    // Check if conditions are met
    if (duration >= minVisitDuration && maxScrollPercentage >= minScrollDepth) {
        reportValidVisit();
    }
}

function updateMaxScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    // Prevent division by zero
    if (docHeight <= 0) return;

    const scrollPercentage = (scrollTop / docHeight) * 100;

    if (scrollPercentage > maxScrollPercentage) {
        maxScrollPercentage = scrollPercentage;
        // console.log(`New Max Scroll: ${maxScrollPercentage.toFixed(1)}%`);
    }

    checkConditions();
}

function reportValidVisit() {
    isValidVisitReported = true;
    console.log(">>> VALID VISIT DETECTED! Sending message to background... <<<");

    const content = extractMainContent();

    try {
        chrome.runtime.sendMessage({
            type: 'VALID_VISIT',
            payload: {
                content: content
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("SendMessage Error:", chrome.runtime.lastError.message);
            } else if (response && !response.success) {
                console.error("Background Worker Error:", response.error);
                alert(`Obsidian Smart History Error:\n${response.error}`); // Optional: alert the user directly
            } else {
                console.log("Message sent successfully. Response:", response);
            }
        });
    } catch (e) {
        console.error("Exception sending message:", e);
    }
}

// Event Listeners
window.addEventListener('scroll', updateMaxScroll);

// Check duration periodically
setInterval(checkConditions, 1000);

// Improved Content Extraction Logic
function extractMainContent() {
    // 1. Explicit Note.com Support
    const noteContent = document.querySelector('.o-noteContentText'); // New style
    if (noteContent) return cleanText(noteContent.innerText);

    const noteBody = document.querySelector('.note-common-styles__text'); // Old style
    if (noteBody) return cleanText(noteBody.innerText);

    // 2. Standard Semantic Tags
    const article = document.querySelector('article');
    if (article) return cleanText(article.innerText);

    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) return cleanText(main.innerText);

    // 3. Common Class Names (Heuristics)
    const contentClasses = [
        '.post-content', '.entry-content', '.article-body', '.content-body',
        '#content', '#main', '.main-content'
    ];

    for (const selector of contentClasses) {
        const element = document.querySelector(selector);
        if (element) return cleanText(element.innerText);
    }

    // 4. Fallback: Largest Text Block (Simplified Readability)
    const paragraphs = document.getElementsByTagName('p');
    let bestContainer = null;
    let maxLegitTextLen = 0;
    const parentMap = new Map();

    for (const p of paragraphs) {
        const textLen = p.innerText.length;
        if (textLen < 50) continue;
        const parent = p.parentElement;
        const currentScore = parentMap.get(parent) || 0;
        parentMap.set(parent, currentScore + textLen);

        if (parentMap.get(parent) > maxLegitTextLen) {
            maxLegitTextLen = parentMap.get(parent);
            bestContainer = parent;
        }
    }

    if (bestContainer) {
        return cleanText(bestContainer.innerText);
    }

    // 5. Last Resort
    return cleanText(document.body.innerText);
}

function cleanText(text) {
    if (!text) return "";
    return text.replace(/\s+/g, ' ').trim().substring(0, 30000);
}


