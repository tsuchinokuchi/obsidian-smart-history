import { getSettings, StorageKeys } from '../utils/storage.js';

export class ObsidianClient {
    constructor() {
        this.baseUrl = '';
        this.apiKey = '';
        this.headers = {};
    }

    async init() {
        const settings = await getSettings();

        const protocol = settings[StorageKeys.OBSIDIAN_PROTOCOL] || 'http';
        const port = settings[StorageKeys.OBSIDIAN_PORT] || '27123';
        this.apiKey = settings[StorageKeys.OBSIDIAN_API_KEY];

        if (!this.apiKey) {
            throw new Error('Obsidian API Key not set');
        }

        this.baseUrl = `${protocol}://127.0.0.1:${port}`;
        this.headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'text/markdown'
        };
    }

    async testConnection() {
        try {
            await this.init();
            const response = await fetch(`${this.baseUrl}/`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            if (response.ok) {
                const text = await response.text();
                // Log the welcome message which often contains version info
                console.log("Obsidian API Connection OK. Root Response:", text);
                return { success: true, message: 'Connected' };
            } else {
                return { success: false, message: `Status: ${response.status}` };
            }
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    async exists(path) {
        await this.init();
        try {
            // Encode path to handle Japanese characters etc.
            // encodeURI preserves slashes '/' which is what we want for paths
            // But strict segment encoding is safer:
            const encodedPath = path.split('/').map(encodeURIComponent).join('/');
            const response = await fetch(`${this.baseUrl}/vault/${encodedPath}`, {
                method: 'HEAD',
                headers: this.headers
            });
            return response.status === 200;
        } catch (e) {
            return false;
        }
    }

    async createNote(path, content) {
        await this.init();
        try {
            const encodedPath = path.split('/').map(encodeURIComponent).join('/');
            const response = await fetch(`${this.baseUrl}/vault/${encodedPath}`, {
                method: 'PUT',
                headers: this.headers,
                body: content
            });

            if (!response.ok) {
                throw new Error(`Failed to create note: ${response.statusText}`);
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async appendToNote(path, content) {
        await this.init();
        try {
            const encodedPath = path.split('/').map(encodeURIComponent).join('/');
            const response = await fetch(`${this.baseUrl}/vault/${encodedPath}`, {
                method: 'POST',
                headers: { ...this.headers, 'Content-Type': 'text/markdown' },
                body: content
            });

            if (!response.ok) {
                // If 404, it might be that the file truly doesn't exist
                if (response.status === 404) {
                    return { success: false, error: `Note not found: ${path} (Encoded: ${encodedPath})` };
                }
                throw new Error(`Failed to append: ${response.statusText}`);
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async appendToDailyNote(content) {
        await this.init();
        // Use static import
        const settings = await getSettings();
        const dailyPath = settings[StorageKeys.OBSIDIAN_DAILY_PATH] || 'Daily';

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const fileName = `${year}-${month}-${day}.md`;

        // Remove trailing slash if present
        const folder = dailyPath.replace(/\/$/, '');
        const fullPath = `${folder}/${fileName}`;

        return this.appendToNote(fullPath, content);
    }

    // New method specifically for the memo/floating feature
    async appendMemo(path, memoContent, title, url, isNewContext) {
        await this.init();

        const timestamp = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        let formatted = '';

        if (isNewContext) {
            // New Page/Context: Add Header
            formatted += `\n## [${title}](${url})\n`;
        }

        // Bullet point memo
        formatted += `- ${timestamp} ${memoContent}\n`;

        // Use appendToNote logic
        return this.appendToNote(path, formatted);
    }

    async getActiveNote() {
        await this.init();
        try {
            // Fetch /active/ which redirects to the actual file content
            const response = await fetch(`${this.baseUrl}/active/`, {
                method: 'GET',
                headers: this.headers
            });

            if (response.ok) {
                // If the URL has changed (redirected), we can extract the path from it.
                // Format: http://127.0.0.1:27123/vault/path/to/file.md
                const fullUrl = response.url;
                const prefix = `${this.baseUrl}/vault/`;

                if (fullUrl.startsWith(prefix)) {
                    // Start after the prefix
                    const rawPath = fullUrl.substring(prefix.length);
                    // Decode to get human readable path (e.g. %E3%83... -> テスト.md)
                    return decodeURIComponent(rawPath);
                }
            }
            throw new Error('Could not determine active note path (Is a note open?)');
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    async searchFiles(query) {
        await this.init();
        try {
            console.log(`Searching Obsidian for: ${query}`);

            // Strategy 1: /search/simple/ (Standard for v1.4.0+)
            try {
                const results = await this.fetchSearch(`${this.baseUrl}/search/simple/`, query);
                if (results) return results;
            } catch (e) {
                console.warn("Strategy 1 (/search/simple/) failed:", e);
            }

            // Strategy 2: /search/ (Possible legacy or alternative)
            try {
                const results = await this.fetchSearch(`${this.baseUrl}/search/`, query);
                if (results) return results;
            } catch (e) {
                console.warn("Strategy 2 (/search/) failed:", e);
            }

            // Strategy 3: /vault/ + Default Folder (Fallback)
            try {
                console.log("Strategy 3: Listing files via /vault/ and Default Folder");

                let allFiles = [];

                // 3a. Root
                try {
                    const rootResp = await fetch(`${this.baseUrl}/vault/`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
                    });
                    if (rootResp.ok) {
                        const data = await rootResp.json();
                        const files = Array.isArray(data) ? data : (data.files || []);
                        allFiles = allFiles.concat(files);
                    }
                } catch (e) { console.warn("Strategy 3a (Root) failed", e); }

                // 3b. Default Folder (if configured)
                const settings = await getSettings();
                const defaultFolder = settings[StorageKeys.DEFAULT_FOLDER];

                if (defaultFolder) {
                    try {
                        const encodedFolder = defaultFolder.split('/').map(encodeURIComponent).join('/');
                        // Ensure trailing slash for directory listing
                        const folderUrl = `${this.baseUrl}/vault/${encodedFolder}/`;

                        console.log(`Strategy 3b: Listing default folder: ${folderUrl}`);
                        const folderResp = await fetch(folderUrl, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
                        });

                        if (folderResp.ok) {
                            const data = await folderResp.json();
                            const files = Array.isArray(data) ? data : (data.files || []);
                            allFiles = allFiles.concat(files);
                        }
                    } catch (e) { console.warn("Strategy 3b (Default Folder) failed", e); }
                }

                if (allFiles.length > 0) {
                    console.log("Fallback files found:", allFiles.length);

                    const lowerQuery = query.toLowerCase();
                    const filtered = allFiles
                        .filter(f => {
                            const name = typeof f === 'string' ? f : f.name || f.filename;
                            return name && name.toLowerCase().includes(lowerQuery);
                        })
                        .map(f => (typeof f === 'string' ? f : f.name || f.filename));

                    const unique = [...new Set(filtered)];

                    if (unique.length > 0) return unique;
                }
            } catch (e) {
                console.warn("Strategy 3 (File Listing) failed:", e);
            }

            return [];
        } catch (e) {
            console.error('All search strategies failed:', e);
            return [];
        }
    }

    async fetchSearch(endpoint, query) {
        const url = new URL(endpoint);
        url.searchParams.append('query', query);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const results = await response.json();
            if (Array.isArray(results)) {
                return results.map(r => r.filename);
            }
        }
        throw new Error(`Status ${response.status}`);
    }

    // Helper to try and find a file if the user only provides a filename
    async resolvePath(pathOrFilename) {
        await this.init();
        const candidates = [];

        // 1. As provided
        candidates.push(pathOrFilename);

        // 2. With .md extension
        if (!pathOrFilename.toLowerCase().endsWith('.md')) {
            candidates.push(`${pathOrFilename}.md`);
        }

        // 3. In default folder (if configured)
        const settings = await getSettings();
        const defaultFolder = settings[StorageKeys.DEFAULT_FOLDER];

        if (defaultFolder) {
            // Join properly, avoid double slash
            const folder = defaultFolder.replace(/\/$/, '');
            const name = pathOrFilename.startsWith('/') ? pathOrFilename.substring(1) : pathOrFilename;

            candidates.push(`${folder}/${name}`);
            if (!name.toLowerCase().endsWith('.md')) {
                candidates.push(`${folder}/${name}.md`);
            }
        }

        // Check each candidate
        for (const c of candidates) {
            if (await this.exists(c)) {
                return c;
            }
        }

        // 4. Fallback: Search for the filename
        try {
            console.log(`resolvePath failed for candidates, trying search for: ${pathOrFilename}`);
            const query = pathOrFilename.replace(/\.md$/i, ''); // Strip extension for search
            const searchResults = await this.searchFiles(query);

            if (searchResults && searchResults.length > 0) {
                // Look for exact match (basename)
                const targetBasename = query + '.md';

                const exactMatch = searchResults.find(p => p.endsWith('/' + targetBasename) || p === targetBasename);
                if (exactMatch) {
                    console.log(`resolvePath found via search (exact match): ${exactMatch}`);
                    return exactMatch;
                }

                // Return the first result as best guess
                console.log(`resolvePath found via search (best guess): ${searchResults[0]}`);
                return searchResults[0];
            }
        } catch (e) {
            console.warn("resolvePath search fallback failed", e);
        }

        // If none found, return the original
        return pathOrFilename;
    }
}
