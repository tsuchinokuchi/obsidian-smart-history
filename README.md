# Obsidian Smart History

A Chrome extension that automatically saves your browsing history to Obsidian with AI-generated summaries.

## Features

- 🤖 **AI-Powered Summaries**: Automatically generates concise summaries of web pages using Google's Gemini API
- 📝 **Obsidian Integration**: Saves browsing history directly to your Obsidian daily notes
- 🎯 **Smart Detection**: Only saves pages you actually read (based on scroll depth and time spent)
- 📂 **Organized Storage**: Automatically creates and maintains a dedicated "Browser History" section in your daily notes
- ⚙️ **Customizable**: Configure minimum visit duration, scroll depth, and API settings

## Requirements

- [Obsidian](https://obsidian.md/) with [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier available)

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your toolbar

### From Chrome Web Store

*Coming soon*

## Setup

1. Click the extension icon in your toolbar
2. Configure the following settings:

### Obsidian Settings
- **API Key**: Your Obsidian Local REST API key
- **Protocol**: `http` or `https` (use `http` for simplicity)
- **Port**: Default is `27123`
- **Daily Notes Path**: Path to your daily notes folder (e.g., `092.Daily`)

### Gemini Settings
- **API Key**: Your Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- **Model Name**: Recommended models:
  - `gemini-2.5-flash` (fastest, recommended)
  - `gemini-2.5-pro` (highest quality)
  - `gemini-flash-latest` (always uses latest Flash model)

### Visit Detection Settings
- **Minimum Visit Duration**: Minimum seconds on a page (default: 30)
- **Minimum Scroll Depth**: Minimum scroll percentage (default: 30%)

3. Click "Save Settings"
4. Click "Test Connection" to verify Obsidian connectivity

## Usage

1. Browse the web normally
2. When you spend enough time on a page and scroll sufficiently, the extension automatically:
   - Detects the valid visit
   - Generates an AI summary using Gemini
   - Saves the entry to your daily note under `## 🌐 ブラウザ閲覧履歴`

3. Open your Obsidian daily note to see the saved history

## Entry Format

Each saved entry includes:
- Timestamp
- Page title with link
- AI-generated summary

Example:
```markdown
## 🌐 ブラウザ閲覧履歴

- 03:30 [Example Article](https://example.com)
  - AI要約: This article discusses...
```

## Privacy

- All data is stored locally in your Obsidian vault
- API keys are stored in Chrome's local storage
- No data is sent to third parties except:
  - Google Gemini API (for summary generation)
  - Your local Obsidian instance (for storage)

## Troubleshooting

### Connection Errors

If you see SSL/HTTPS errors:
1. Try using `http` instead of `https` in settings
2. If using `https`, visit `https://127.0.0.1:27123` in your browser and accept the self-signed certificate

### Gemini API Errors

- **404 Not Found**: Check that your model name is correct (use `gemini-2.5-flash`)
- **429 Quota Exceeded**: You've hit the free tier limit. Wait or upgrade your plan
- **401 Unauthorized**: Check that your API key is correct

### Nothing is Being Saved

1. Check that you meet the minimum visit requirements (time + scroll depth)
2. Open the extension's Service Worker console (`chrome://extensions` → "Inspect views: Service Worker")
3. Look for error messages in the console

## Development

### Project Structure

```
history to obsidian/
├── manifest.json           # Extension manifest
├── src/
│   ├── background/
│   │   ├── service-worker.js    # Main background script
│   │   ├── gemini.js            # Gemini API client
│   │   └── obsidianClient.js    # Obsidian API client
│   ├── content/
│   │   └── extractor.js         # Content script for page detection
│   ├── popup/
│   │   ├── popup.html           # Settings UI
│   │   └── popup.js             # Settings logic
│   └── utils/
│       └── storage.js           # Chrome storage utilities
└── icons/                  # Extension icons
```

### Building

No build step required. The extension runs directly from source.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use and modify as needed.

## Credits

- Built with [Google Gemini API](https://ai.google.dev/gemini-api)
- Integrates with [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)

## Support

For issues or questions, please open an issue on GitHub.
