import { getSettings, saveSettings, StorageKeys } from '../utils/storage.js';
import { ObsidianClient } from '../background/obsidianClient.js';

const obsidian = new ObsidianClient();

document.addEventListener('DOMContentLoaded', async () => {
    await restoreSettings();
    await updateUI();

    // Focus Mode Buttons
    const btnUseActive = document.getElementById('btn-use-active');
    if (btnUseActive) btnUseActive.addEventListener('click', handleUseActiveNote);

    // Select Existing button listener (still useful for manual entry confirmation)
    const btnSetExisting = document.getElementById('btn-set-existing');
    if (btnSetExisting) btnSetExisting.addEventListener('click', handleSetExisting);

    const btnCreateNew = document.getElementById('btn-create-new');
    if (btnCreateNew) btnCreateNew.addEventListener('click', handleCreateNew);

    const btnStopSession = document.getElementById('btn-stop-session');
    if (btnStopSession) btnStopSession.addEventListener('click', handleStopSession);

    const btnSendMemo = document.getElementById('btn-send-memo');
    if (btnSendMemo) btnSendMemo.addEventListener('click', handleSendMemo);

    // Search Input Logic
    const searchInput = document.getElementById('target-note-input');
    if (searchInput) {
        // Debounce search input
        searchInput.addEventListener('input', debounce(handleSearchInput, 300));

        // Hide results on blur, but delay to allow click on result
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const results = document.getElementById('search-results');
                if (results) results.style.display = 'none';
            }, 200);
        });

        // Ensure results show again if focusing back
        searchInput.addEventListener('focus', handleSearchInput);
    }

    // Settings Buttons
    const btnSave = document.getElementById('save');
    if (btnSave) btnSave.addEventListener('click', saveAndTest);
});

async function restoreSettings() {
    const settings = await getSettings();
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('apiKey', settings[StorageKeys.OBSIDIAN_API_KEY] || '');
    setVal('protocol', settings[StorageKeys.OBSIDIAN_PROTOCOL] || 'http');
    setVal('port', settings[StorageKeys.OBSIDIAN_PORT] || '27123');
    setVal('dailyPath', settings[StorageKeys.OBSIDIAN_DAILY_PATH] || 'Daily');
    setVal('geminiApiKey', settings[StorageKeys.GEMINI_API_KEY] || '');
    setVal('geminiModel', settings[StorageKeys.GEMINI_MODEL] || 'gemini-2.5-flash');
    setVal('minVisitDuration', settings[StorageKeys.MIN_VISIT_DURATION] || 5);
    setVal('minScrollDepth', settings[StorageKeys.MIN_SCROLL_DEPTH] || 50);
    setVal('defaultFolder', settings[StorageKeys.DEFAULT_FOLDER] || '');
    setVal('summaryLength', settings[StorageKeys.SUMMARY_LENGTH] || 'short');
}

async function updateUI() {
    const settings = await getSettings();
    const isFocusMode = settings[StorageKeys.FOCUS_MODE];
    const targetNote = settings[StorageKeys.TARGET_NOTE];

    const startView = document.getElementById('start-session-view');
    const activeView = document.getElementById('active-session-view');
    const container = document.getElementById('focus-mode-container');
    const currentTargetName = document.getElementById('current-target-name');

    if (isFocusMode) {
        if (startView) startView.style.display = 'none';
        if (activeView) activeView.style.display = 'block';
        if (container) container.style.borderBottom = '4px solid #2e8b57';
        if (currentTargetName) currentTargetName.textContent = targetNote || 'Unknown';
    } else {
        if (startView) startView.style.display = 'block';
        if (activeView) activeView.style.display = 'none';
        if (container) container.style.borderBottom = '2px solid #eee';
    }
}

// --- Search Logic ---

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function handleSearchInput(e) {
    const query = e.target.value.trim();
    const resultsContainer = document.getElementById('search-results');

    // Minimal query length (1 char is enough for testing)
    if (query.length < 1) {
        resultsContainer.style.display = 'none';
        return;
    }

    // Show searching
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div style="padding:8px; color:#666;">Searching...</div>';

    try {
        const response = await chrome.runtime.sendMessage({ type: 'SEARCH_FILES', query });
        if (response.success) {
            if (response.results && response.results.length > 0) {
                renderSearchResults(response.results);
            } else {
                resultsContainer.innerHTML = '<div style="padding:8px; color:#666;">No results found.</div>';
            }
        } else {
            // Error from background
            resultsContainer.innerHTML = `<div style="padding:8px; color:red;">Error: ${response.error || 'Unknown'}</div>`;
        }
    } catch (e) {
        console.error('Search failed', e);
        resultsContainer.innerHTML = `<div style="padding:8px; color:red;">Msg Error: ${e.message}</div>`;
    }
}

function renderSearchResults(files) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    // Sort slightly? API usually returns sorted by score.
    // Display up to 10
    files.slice(0, 10).forEach(file => {
        const div = document.createElement('div');
        div.style.padding = '8px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.style.fontSize = '12px';
        div.style.color = '#333';
        div.style.whiteSpace = 'nowrap';
        div.style.overflow = 'hidden';
        div.style.textOverflow = 'ellipsis';
        div.textContent = file;

        div.addEventListener('mouseenter', () => div.style.backgroundColor = '#f5f5f5');
        div.addEventListener('mouseleave', () => div.style.backgroundColor = 'white');

        div.addEventListener('mousedown', (e) => { // mousedown happens before blur
            e.preventDefault(); // prevent blur
            document.getElementById('target-note-input').value = file;
            container.style.display = 'none';
        });

        div.addEventListener('click', () => {
            document.getElementById('target-note-input').value = file;
            container.style.display = 'none';
        });

        container.appendChild(div);
    });

    container.style.display = 'block';
}

// --- Handlers ---

async function handleUseActiveNote() {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Getting active note...';

    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_NOTE' });
        if (response.success && response.path) {
            await startSession(response.path);
        } else {
            statusDiv.textContent = `Error: ${response.error || 'No active note found'}`;
            statusDiv.className = 'error';
        }
    } catch (e) {
        statusDiv.textContent = `Error: ${e.message}`;
        statusDiv.className = 'error';
    }
}

async function handleSetExisting() {
    const input = document.getElementById('target-note-input');
    const path = input.value.trim();
    if (!path) {
        alert('Please enter a file name/path.');
        return;
    }

    // Try to resolve path via background
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Verifying path...';

    try {
        // We can expose resolvePath via message if needed, but for now 
        // we can just use exists via message or similar?
        // Actually, we need to add RESOLVE_PATH to service worker or just try to 
        // rely on SEARCH?
        // Let's add RESOLVE_PATH to service worker first? 
        // Or simpler: Just assume user might be right, but try to be smart?
        // No, let's update service worker to expose resolvePath.

        // Wait, I can't update service worker in this tool call.
        // I will assume for now we just send the path, and maybe the background script's 
        // SEND_MEMO/etc should resolve it?
        // Actually, startSession saves the path. If we save "Test", 
        // subsequent calls to appendMemo use "Test".
        // It's better to resolve it NOW and save the resolved path.

        const response = await chrome.runtime.sendMessage({ type: 'RESOLVE_PATH', path });
        let finalPath = path;

        if (response && response.success && response.resolvedPath) {
            finalPath = response.resolvedPath;
        } else {
            // If resolution fails, maybe just append .md?
            if (!finalPath.endsWith('.md')) finalPath += '.md';
        }

        await startSession(finalPath);

    } catch (e) {
        console.error(e);
        // Fallback
        if (!path.endsWith('.md')) await startSession(path + '.md');
        else await startSession(path);
    }
}

async function handleCreateNew() {
    const input = document.getElementById('target-note-input');
    const filename = input.value.trim();
    if (!filename) {
        alert('Please enter a file name.');
        return;
    }

    const settings = await getSettings();
    const folder = settings[StorageKeys.DEFAULT_FOLDER] || '';

    // Construct path
    let fullPath = folder ? `${folder}/${filename}` : filename;
    if (!fullPath.endsWith('.md')) fullPath += '.md';

    // Remove leading slash if any
    if (fullPath.startsWith('/')) fullPath = fullPath.substring(1);

    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Creating note...';

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CREATE_NOTE',
            path: fullPath,
            content: `# ${filename}\n\nCreated via Smart History Focus Mode\n`
        });

        if (response.success) {
            await startSession(fullPath);
        } else {
            statusDiv.textContent = `Error creating note: ${response.error}`;
            statusDiv.className = 'error';
        }
    } catch (e) {
        statusDiv.textContent = `Error: ${e.message}`;
        statusDiv.className = 'error';
    }
}

async function startSession(targetPath) {
    await saveSettings({
        [StorageKeys.FOCUS_MODE]: true,
        [StorageKeys.TARGET_NOTE]: targetPath
    });

    // Notify background to update badge
    chrome.runtime.sendMessage({ type: 'CHECK_FOCUS_MODE' });

    await updateUI();
    const status = document.getElementById('status');
    if (status) status.textContent = '';
}

async function handleStopSession() {
    await saveSettings({
        [StorageKeys.FOCUS_MODE]: false,
        [StorageKeys.TARGET_NOTE]: null
    });

    // Notify background to update badge
    chrome.runtime.sendMessage({ type: 'CHECK_FOCUS_MODE' });

    await updateUI();
}

async function handleSendMemo() {
    const memoInput = document.getElementById('quick-memo-input');
    const memo = memoInput.value.trim();
    if (!memo) return;

    const settings = await getSettings();
    const targetPath = settings[StorageKeys.TARGET_NOTE];

    const btn = document.getElementById('btn-send-memo');
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'SEND_MEMO',
            path: targetPath,
            memo: memo
        });

        if (response.success) {
            memoInput.value = '';
            btn.textContent = 'Sent!';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1000);
        } else {
            alert(`Failed: ${response.error}`);
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function saveAndTest() {
    const status = document.getElementById('status');
    status.textContent = 'Saving...';
    status.className = '';

    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };

    const settings = {
        [StorageKeys.OBSIDIAN_API_KEY]: getVal('apiKey'),
        [StorageKeys.OBSIDIAN_PROTOCOL]: getVal('protocol'),
        [StorageKeys.OBSIDIAN_PORT]: getVal('port'),
        [StorageKeys.OBSIDIAN_DAILY_PATH]: getVal('dailyPath'),
        [StorageKeys.GEMINI_API_KEY]: getVal('geminiApiKey'),
        [StorageKeys.GEMINI_MODEL]: getVal('geminiModel'),
        [StorageKeys.MIN_VISIT_DURATION]: getVal('minVisitDuration'),
        [StorageKeys.MIN_SCROLL_DEPTH]: getVal('minScrollDepth'),
        [StorageKeys.DEFAULT_FOLDER]: getVal('defaultFolder'),
        [StorageKeys.SUMMARY_LENGTH]: getVal('summaryLength')
    };

    await saveSettings(settings);

    status.textContent = 'Testing Connection...';
    const result = await obsidian.testConnection();

    if (result.success) {
        status.textContent = 'Settings Saved & Connection Successful!';
        status.className = 'success';
    } else {
        status.textContent = `Settings Saved, but Connection Failed: ${result.message}`;
        status.className = 'error';
    }
}
