# Privacy Policy for Obsidian Smart History

**Last Updated: December 27, 2025**

## Overview

Obsidian Smart History ("the Extension") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights.

## Data Collection

### Data We Collect

The Extension collects the following data **locally on your device**:

1. **Browsing History Data**:
   - Page URLs you visit
   - Page titles
   - Time spent on pages
   - Scroll depth on pages
   - Page content (for AI summary generation)

2. **Configuration Data**:
   - Obsidian API key
   - Obsidian server settings (protocol, port, path)
   - Google Gemini API key
   - Gemini model name
   - Visit detection settings (minimum duration, scroll depth)

### How Data is Stored

- All configuration data is stored in **Chrome's local storage** on your device
- Browsing history entries are saved to **your local Obsidian vault**
- **No data is stored on our servers** - we do not operate any servers

## Data Usage

### How We Use Your Data

1. **Page Content**: Sent to Google Gemini API to generate summaries
2. **Browsing History**: Saved to your Obsidian vault via the Local REST API
3. **Configuration**: Used to connect to Obsidian and Gemini APIs

### Third-Party Services

The Extension communicates with the following third-party services:

1. **Google Gemini API** (https://generativelanguage.googleapis.com)
   - Purpose: Generate AI summaries of web pages
   - Data sent: Page content (text only, truncated to 30,000 characters)
   - Privacy policy: https://policies.google.com/privacy

2. **Your Local Obsidian Instance** (http://127.0.0.1:27123 by default)
   - Purpose: Save browsing history to your daily notes
   - Data sent: Timestamps, URLs, titles, AI summaries
   - Note: This is your own local server, not a third-party service

## Data Sharing

- **We do not sell, rent, or share your data with any third parties**
- Data is only sent to services you explicitly configure (Gemini API, your Obsidian instance)
- No analytics or tracking services are used

## Your Rights

You have the right to:

1. **Access Your Data**: All data is stored locally and accessible to you
2. **Delete Your Data**: 
   - Uninstall the extension to remove all configuration data
   - Delete entries from your Obsidian vault manually
3. **Modify Your Data**: Edit settings at any time through the extension popup

## Security

- API keys are stored in Chrome's local storage (not synced to Google account)
- Communication with Gemini API uses HTTPS encryption
- Communication with Obsidian can use HTTP or HTTPS (configurable)

## Children's Privacy

This Extension is not intended for use by children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

For questions about this privacy policy, please open an issue on our GitHub repository.

## Consent

By using Obsidian Smart History, you consent to this privacy policy.
