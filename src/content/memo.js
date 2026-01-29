// memo.js
// Logic for floating memo button

let isFocusMode = false;
let targetNote = null;

// Initialize
initMemo();

async function initMemo() {
    // Check initial state
    const settings = await chrome.storage.local.get(['focus_mode', 'target_note']);
    isFocusMode = settings.focus_mode;
    targetNote = settings.target_note;

    if (isFocusMode) {
        createUI();
    }

    // Listen for storage changes to toggle UI
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.focus_mode) {
                isFocusMode = changes.focus_mode.newValue;
                toggleUI(isFocusMode);
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
    fab.title = 'Add Memo to Focus Note';
    document.body.appendChild(fab);

    // Container
    const container = document.createElement('div');
    container.id = 'osh-memo-container';
    // Removed osh-hidden to make it visible by default
    container.innerHTML = `
        <div id="osh-memo-header">
            <span>Add Memo</span>
            <span style="font-size:10px; color:#777;">(Focus Mode)</span>
        </div>
        <textarea id="osh-memo-textarea" placeholder="Type your thought..."></textarea>
        <div class="osh-notification" id="osh-memo-toast">Saved!</div>
        <div id="osh-memo-actions">
            <button id="osh-btn-cancel" class="osh-btn">Minimize</button>
            <button id="osh-btn-send" class="osh-btn">Send</button>
        </div>
    `;
    document.body.appendChild(container);

    // Initial State: Container OPEN, FAB HIDDEN
    fab.classList.add('osh-hidden');

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

    // Keyboard shortcut (Ctrl+Enter to send)
    document.getElementById('osh-memo-textarea').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            sendMemo();
        }
    });
}

function toggleUI(show) {
    const fab = document.getElementById('osh-memo-fab');
    const container = document.getElementById('osh-memo-container');

    if (show) {
        if (!fab) createUI();
        else {
            // Restore last state? Or default to Open?
            // Default to Open as per "Resident" request
            container.classList.remove('osh-hidden');
            fab.classList.add('osh-hidden');
        }
    } else {
        if (fab) fab.classList.add('osh-hidden');
        if (container) container.classList.add('osh-hidden');
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
            showToast();
            // Do NOT hide container (Resident)
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
