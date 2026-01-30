// memo.js
// Logic for floating memo button

let isFocusMode = false;
let targetNote = null;
let saveTimeout = null;

// Initialize
initMemo();

async function initMemo() {
    // Check initial state
    const settings = await chrome.storage.local.get(['focus_mode', 'target_note']);
    isFocusMode = settings.focus_mode;
    targetNote = settings.target_note;

    // Always create UI for resident memo
    createUI();
    loadDraft();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.focus_mode) {
                isFocusMode = changes.focus_mode.newValue;
                updateHeader();
            }
            if (changes.target_note) {
                targetNote = changes.target_note.newValue;
            }
        }
    });
}

function createUI() {
    if (document.getElementById('osh-memo-fab')) return; // Already exists

    // FAB
    const fab = document.createElement('div');
    fab.id = 'osh-memo-fab';
    fab.innerHTML = '✎';
    fab.title = 'Add Memo';
    document.body.appendChild(fab);

    // Container
    const container = document.createElement('div');
    container.id = 'osh-memo-container';
    container.innerHTML = `
        <div id="osh-memo-header">
            <span>Add Memo</span>
            <span id="osh-mode-indicator" style="font-size:10px; color:#777; display:none;">(Focus Mode)</span>
        </div>
        <textarea id="osh-memo-textarea" placeholder="Type your thought..."></textarea>
        <div class="osh-notification" id="osh-memo-toast">Saved!</div>
        <div id="osh-memo-actions">
            <button id="osh-btn-cancel" class="osh-btn">Minimize</button>
            <button id="osh-btn-send" class="osh-btn">Send</button>
        </div>
    `;
    document.body.appendChild(container);

    // Initial State: Container HIDDEN, FAB VISIBLE (unless user left it open? For now default to closed for resident)
    container.classList.add('osh-hidden');

    // Events
    fab.addEventListener('click', () => {
        container.classList.remove('osh-hidden');
        fab.classList.add('osh-hidden');
        document.getElementById('osh-memo-textarea').focus();
    });

    document.getElementById('osh-btn-cancel').addEventListener('click', () => {
        container.classList.add('osh-hidden');
        fab.classList.remove('osh-hidden');
    });

    document.getElementById('osh-btn-send').addEventListener('click', sendMemo);

    const textarea = document.getElementById('osh-memo-textarea');

    // Keyboard shortcut (Ctrl+Enter to send)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            sendMemo();
        }
    });

    // Auto-save draft on input
    textarea.addEventListener('input', () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveDraft();
        }, 500);
    });

    updateHeader();
}

function updateHeader() {
    const indicator = document.getElementById('osh-mode-indicator');
    if (indicator) {
        indicator.style.display = isFocusMode ? 'inline' : 'none';
    }
}

async function saveDraft() {
    const textarea = document.getElementById('osh-memo-textarea');
    if (!textarea) return;
    const content = textarea.value;
    await chrome.storage.local.set({ 'osh_memo_draft': content });
}

async function loadDraft() {
    const result = await chrome.storage.local.get('osh_memo_draft');
    if (result.osh_memo_draft) {
        const textarea = document.getElementById('osh-memo-textarea');
        if (textarea) {
            textarea.value = result.osh_memo_draft;
        }
    }
}

async function sendMemo() {
    const textarea = document.getElementById('osh-memo-textarea');
    const memo = textarea.value.trim();
    if (!memo) return;

    const btn = document.getElementById('osh-btn-send');
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
        // Send to background
        const response = await chrome.runtime.sendMessage({
            type: 'SEND_MEMO',
            path: targetNote,
            memo: memo
        });

        if (response && response.success) {
            textarea.value = '';
            await chrome.storage.local.remove('osh_memo_draft'); // Clear draft
            showToast();
            // Optional: Hide container after send? User request implies "resident", but "floating memo field". 
            // Often "Send" implies done. Let's keep it open or close it? 
            // Previous logic: "Do NOT hide container (Resident)". 
            // Let's stick effectively to that or check if we want to minimize.
            // "Minimize" button exists. I'll keep it open for continuous note taking?
            // Actually, usually sending a quick memo -> done.
            // But if I want to write multiple points...
            // Let's keep it open as per previous "Resident" comment, but maybe we can reconsider.
            // I'll leave it open for now to be safe.
        } else {
            alert('Failed to save memo: ' + (response?.error || 'Unknown error'));
        }
    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function showToast() {
    const toast = document.getElementById('osh-memo-toast');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}
