# CLAUDE.md - Text Saver Extension Developer Guide

## Project Overview

**Text Saver** is a Chrome browser extension (Manifest V3) that enables users to save, organize, and quickly access text snippets using tags and bookmarks. The extension provides a powerful `//` autocomplete feature that allows users to insert saved snippets into any input field on web pages.

**Version**: 2.3
**Author**: BDK-KIMS-9587-TS
**License**: Private use only
**Primary Language**: Korean (with English i18n support)

### Core Purpose
- Save frequently used text snippets, code blocks, and prompts
- Organize content with tags and bookmarks
- Quick insertion via `//<keyword>` autocomplete in web forms
- Backup/restore data via JSON export/import
- Pre-loaded AI prompt engineering templates (CoT, ToT, ReAct, SCAMPER, PCIO)

---

## Repository Structure

```
/
├── manifest.json              # Chrome extension manifest (v3)
├── popup.html                 # Extension popup UI
├── README.md                  # User-facing documentation (Korean)
├── PRIVACY_POLICY.md          # Privacy policy
├── SECURITY.md                # Security documentation
├── CLAUDE.md                  # This file - AI assistant guide
├── css/
│   ├── content.css           # Styles for injected autocomplete UI
│   └── popup.css             # Styles for popup interface
├── icons/                     # Extension icons (16, 32, 48, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── generate-icons.html
├── _locales/                  # i18n localization
│   ├── ko/messages.json      # Korean (default)
│   └── en/messages.json      # English
└── js/
    ├── background.js         # Service worker (background tasks)
    ├── content.js            # Content script (page injection)
    └── popup.js              # Popup UI logic
```

---

## Technology Stack

- **Manifest Version**: 3 (Chrome Extensions API)
- **JavaScript**: Vanilla ES6+ (no frameworks)
- **Storage**: Chrome Storage API (local + sync)
- **Permissions**: storage, clipboardWrite, contextMenus, notifications, activeTab, alarms
- **Content Security Policy**: Strict CSP with no external resources
- **Localization**: Chrome i18n API

---

## Architecture Overview

### 1. Background Service Worker (`js/background.js`)

**Purpose**: Central coordinator for extension operations

**Key Responsibilities**:
- **Context menu management**: Right-click "Save to Text Saver" on selected text
- **Preset prompts**: Initialize and restore 5 AI prompt templates (CoT, ToT, ReAct, SCAMPER, PCIO)
- **Search API**: Process search queries from content script
- **Extension icon updates**: Badge notifications for state changes
- **Keep-alive mechanism**: Periodic alarms to maintain service worker
- **Command handling**: Keyboard shortcut (Ctrl+Shift+T / Cmd+Shift+T) for toggle

**Key Functions**:
- `buildPresetTexts()`: Generates default AI prompt templates
- `restorePresetTexts()`: Restores preset templates to storage
- `handleSearchRequest()`: Processes autocomplete search queries
- `sortByRelevance()`: Ranks results by bookmark status, title match, tags, content
- `updateExtensionIcon()`: Updates badge and title based on feature state

**Message Handlers**:
- `searchItems`: Returns filtered/sorted snippets for autocomplete
- `updateIcon`: Updates extension icon/badge
- `restorePresets`: Reloads default templates

**Security**:
- Input validation for all search queries (max 100 chars)
- URL scheme whitelist (http/https only)
- Text content sanitization before storage
- Max 1000 items per import (DoS prevention)

---

### 2. Content Script (`js/content.js`)

**Purpose**: Implements the `//<keyword>` autocomplete feature on web pages

**Key Responsibilities**:
- **Pattern detection**: Monitor input fields for `//` trigger
- **UI injection**: Display floating autocomplete dropdown
- **Text insertion**: Replace `//query` with selected snippet
- **Keyboard navigation**: Arrow keys, Enter, Escape
- **State management**: Enable/disable via settings
- **Keep-alive**: Maintain connection to background worker
- **Special support**: Perplexity AI input controller (Shadow DOM)

**Key Variables** (in `TextSaverContentState`):
- `currentInputElement`: Active input being monitored
- `bookmarkSearchUI`: Dropdown DOM element
- `searchResults[]`: Current search results
- `selectedIndex`: Keyboard selection position
- `autoCompleteEnabled`: Feature toggle state
- `activeTrigger`: Current `//` pattern location {element, startOffset, endOffset}

**Key Functions**:
- `handleInputEvent()`: Detects `//` pattern and triggers search
- `handleKeydownEvent()`: Handles arrow keys, Enter, Escape
- `debouncedSearchBookmarks()`: Debounced search (280ms)
- `displayBookmarkSearchUI()`: Renders dropdown with results
- `selectAndInsertBookmark()`: Inserts selected text, handles ContentEditable/Input
- `normalizeEditableTarget()`: Supports textarea, input, contenteditable
- `replaceContentEditableToken()`: Complex text replacement for contenteditable elements
- `safeRuntimeSendMessage()`: Retry logic for extension context errors

**Supported Input Types**:
- `<textarea>`
- `<input type="text|search|url|email|tel|password">`
- `[contenteditable]` elements
- Shadow DOM elements (Perplexity AI support)

**Performance Optimizations**:
- Query result caching (max 30 cached queries)
- Debouncing (280ms delay)
- Max 50 displayed items
- Event delegation for click handlers

---

### 3. Popup UI (`js/popup.js`)

**Purpose**: Main user interface for managing snippets

**Key Responsibilities**:
- **CRUD operations**: Create, read, update, delete text snippets
- **Tab management**: Save, View, Bookmark, Settings tabs
- **Search/filter**: Multi-field search (title, content, tags)
- **Auto-save**: Draft recovery (localStorage temp storage)
- **Data management**: Import/export JSON, reset data
- **Localization**: Dynamic UI text replacement based on locale

**Key Functions**:
- `saveText()`: Validates, sanitizes, and stores text
- `loadTextList()`: Displays filtered/sorted snippets
- `loadBookmarkList()`: Shows bookmarked items
- `createTextItem()`: Generates DOM for each snippet
- `exportData()`: Downloads JSON backup
- `importData()`: Validates and imports JSON
- `restorePresetData()`: Calls background.js to restore templates
- `initAutoCompleteToggle()`: Syncs toggle state with storage

**Auto-Save Mechanism**:
- Saves draft to `localStorage` every 1 second
- Restores draft on popup open (if < 24 hours old)
- Clears draft after successful save

**Security Features**:
- `sanitizeText()`: Removes HTML, JavaScript, SQL injection patterns
- `sanitizeTitle()`: Limits to 200 chars
- `sanitizeTags()`: Limits to 500 chars
- `validateTextData()`: Schema validation before storage
- Max field lengths: title (200), content (10000), tags (50 each)

---

## Data Model

### Text Snippet Object

```javascript
{
  id: "1234567890",              // Timestamp-based unique ID
  title: "Example Snippet",      // Max 200 chars
  content: "The actual text...", // Max 10000 chars
  tags: ["tag1", "tag2"],        // Array of strings (max 10 tags, 50 chars each)
  createdAt: "2025-01-15T10:30:00.000Z",  // ISO 8601
  updatedAt: "2025-01-15T12:45:00.000Z",  // Optional
  isBookmarked: false,           // Boolean
  sourceURL: "https://...",      // Optional (from context menu)
  metadata: {                    // Optional
    source: "contextMenu|preset|extension",
    pageTitle: "Page Title",
    createdBy: "extension",
    presetKey: "CoT"            // For preset templates
  }
}
```

### Storage Keys

**chrome.storage.local**:
- `savedTexts`: Array of all text snippets
- `presetInitialized`: Boolean (whether presets were loaded)
- `keepAlive`: Dummy value for service worker keep-alive

**chrome.storage.sync**:
- `autoCompleteEnabled`: Boolean (default: true)

**localStorage** (popup only):
- `textSaver_temp`: Auto-save draft (JSON stringified)

---

## Development Conventions

### Code Style

1. **No external dependencies**: Pure vanilla JavaScript
2. **Security-first**:
   - All user input is sanitized before storage/display
   - CSP enforced (no inline scripts, no external resources)
   - XSS prevention via textContent (not innerHTML)
3. **Error handling**:
   - Try-catch blocks for critical operations
   - Chrome runtime error checking
   - Graceful degradation for bfcache errors
4. **Naming conventions**:
   - camelCase for functions and variables
   - UPPER_SNAKE_CASE for constants
   - Descriptive function names (verbs: `loadTextList`, `sanitizeText`)
5. **Comments**:
   - Korean comments in original code
   - Watermark header with license info
   - Function-level comments for complex logic

### File Organization

- **manifest.json**: Single source of truth for permissions, version
- **CSS**: Separate files for popup vs content script
- **JS**: Clear separation of concerns (background/content/popup)
- **Localization**: Keep Korean as primary, English as fallback

### Security Practices

**Input Validation**:
```javascript
// Example from popup.js
function sanitizeText(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>]/g, '')           // Remove HTML brackets
    .replace(/javascript:/gi, '')    // Remove JS protocol
    .replace(/['";\\]/g, '')         // SQL injection prevention
    .slice(0, 10000)                 // Length limit
    .trim();
}
```

**Output Encoding**:
```javascript
// Safe DOM manipulation
titleElement.textContent = sanitizedTitle;  // NOT innerHTML
```

**URL Validation**:
```javascript
const SAFE_URL_SCHEMES = ['http:', 'https:'];
const urlObj = new URL(tab.url);
if (!SAFE_URL_SCHEMES.includes(urlObj.protocol)) {
  console.error("Unsafe URL scheme detected");
  return;
}
```

---

## Key Features Implementation

### 1. `//<keyword>` Autocomplete

**Trigger Detection** (content.js):
```javascript
// Pattern: // followed by 0+ non-whitespace chars until cursor
const match = textBeforeCursor.match(/\/\/([^\s\/]*)$/);
```

**Search Flow**:
1. User types `//` in input field
2. `handleInputEvent()` detects pattern
3. Debounced search sent to background.js
4. Background returns sorted results (bookmarks first, then by relevance)
5. Content script displays dropdown below/above input
6. User navigates with arrows, selects with Enter
7. Text replaced, UI hidden

**Positioning Logic**:
- Dropdown placed below input if space available
- Otherwise placed above input
- Horizontal position adjusted to stay in viewport

### 2. Context Menu Save

**Flow**:
1. User right-clicks selected text on webpage
2. Chrome shows "Text Saver로 선택 내용 저장" menu item
3. background.js receives selection + URL + page title
4. Creates snippet with auto-generated tags (["웹페이지", "2025/01/15"])
5. Shows success notification + badge

### 3. Preset Prompts

**Default Templates**:
1. **CoT (Chain-of-Thought)**: Step-by-step reasoning template
2. **ToT (Tree-of-Thought)**: Multi-path exploration template
3. **ReAct (Reason+Act)**: Iterative reasoning-action loop
4. **SCAMPER**: Creative thinking framework (7 techniques)
5. **PCIO**: Problem-Context-Insight-Opportunity analysis

**Restoration**:
- User clicks "기본 프롬프트" in Settings
- background.js compares by `metadata.presetKey`
- Updates existing presets, adds missing ones
- Reports count (added/updated)

### 4. Data Backup/Restore

**Export Format** (JSON):
```json
{
  "version": "1.0",
  "savedTexts": [...],
  "exportDate": "2025-01-15T12:00:00.000Z"
}
```

**Import Validation**:
- File size check (max 10MB)
- JSON parsing
- Schema validation for each item
- Sanitization of all fields
- Max 1000 items security limit
- Merge or replace dialog

---

## Common Development Workflows

### Adding a New Feature

1. **Plan**: Identify which component(s) need changes (background/content/popup)
2. **Manifest**: Update permissions if needed
3. **Implement**: Follow security conventions (sanitize inputs)
4. **Localize**: Add strings to `_locales/en/messages.json` and `ko/messages.json`
5. **Test**: Load unpacked extension, test all scenarios
6. **Commit**: Clear commit message

### Debugging

**Background Script**:
```
Chrome DevTools > Extensions > Service Worker > Inspect
```

**Content Script**:
```
Right-click page > Inspect > Console
Look for "Text Saver Extension: content.js loaded"
```

**Popup**:
```
Right-click extension icon > Inspect Popup
```

**Storage Inspection**:
```
Chrome DevTools > Application > Storage > Extension Storage
```

### Fixing Security Issues

1. **Input validation**: Always sanitize before storage
2. **Output encoding**: Use `textContent`, not `innerHTML`
3. **CSP compliance**: No inline scripts, no `eval()`
4. **URL validation**: Whitelist protocols
5. **Rate limiting**: Debounce user actions

### Localization Workflow

1. Add key to `_locales/en/messages.json` and `ko/messages.json`
2. Use `getLocaleMessage(key, fallback)` in popup.js
3. For placeholders: `getLocaleMessage('key', 'fallback', [value1, value2])`
4. Apply via `applyLocaleText()` on DOMContentLoaded

---

## Testing Checklist

### Manual Testing

**Autocomplete**:
- [ ] Type `//` in various input types (textarea, input, contenteditable)
- [ ] Arrow keys navigate results
- [ ] Enter inserts text
- [ ] Escape closes UI
- [ ] Works after page navigation
- [ ] Toggle Ctrl+Shift+T disables/enables

**Context Menu**:
- [ ] Right-click selected text shows menu
- [ ] Saves with correct URL and tags
- [ ] Notification appears

**Popup CRUD**:
- [ ] Save new snippet
- [ ] Edit existing snippet
- [ ] Delete snippet (with confirmation)
- [ ] Bookmark/unbookmark
- [ ] Search filters correctly
- [ ] Auto-save recovers draft

**Data Management**:
- [ ] Export downloads JSON
- [ ] Import merges/replaces correctly
- [ ] Reset clears all data
- [ ] Restore presets works

**Edge Cases**:
- [ ] Empty search returns bookmarks + recent
- [ ] Very long content doesn't break UI
- [ ] Special characters handled (quotes, brackets)
- [ ] Concurrent edits don't corrupt data

---

## Known Limitations & Gotchas

1. **ContentEditable complexity**: Text replacement in rich text editors is error-prone. The code uses `execCommand` as primary method, with manual DOM manipulation as fallback.

2. **bfcache errors**: Chrome's back/forward cache can invalidate extension context. The code has retry logic and keep-alive mechanisms to handle this.

3. **Shadow DOM**: Special support added for Perplexity AI, but other Shadow DOM sites may not work.

4. **HTTPS-only**: Content script only runs on `https://` pages (manifest.json restriction).

5. **Popup size**: Fixed at 500x600px via forced CSS to prevent browser scrollbar bugs.

6. **Service worker lifecycle**: Background script may hibernate. Alarms API used to wake every 5 minutes.

7. **Storage limits**: Chrome local storage quota is ~10MB. No enforcement in code currently.

---

## Important File References

### Key Line Numbers for Common Tasks

**Adding a new preset template**:
- `js/background.js:1-27` - Edit `PRESET_PROMPTS` array

**Changing autocomplete trigger pattern**:
- `js/content.js:1260` - Modify regex `/\/\/([^\s\/]*)$/`

**Adjusting popup size**:
- `js/popup.js:243-264` - Update `setPopupSize()`

**Modifying search ranking**:
- `js/background.js:426-469` - Edit `sortByRelevance()`

**Changing sanitization rules**:
- `js/popup.js:36-69` - Update `sanitizeText()` functions

**Adding new keyboard shortcuts**:
- `manifest.json:30-37` - Add to `commands`
- `js/background.js:172-199` - Handle in `onCommand`

---

## Deployment Notes

### Building for Release

1. **Version bump**: Update `manifest.json` version
2. **Test**: Load unpacked, run through checklist
3. **Package**: Zip entire folder (excluding .git)
4. **Submit**: Chrome Web Store Developer Dashboard

### Publishing Checklist

- [ ] Version number incremented
- [ ] README.md updated with changelog
- [ ] Screenshots updated if UI changed
- [ ] Privacy policy reviewed
- [ ] Security audit completed
- [ ] All console.log removed from production code
- [ ] Icons optimized

---

## Git Workflow

**Current Branch**: `claude/claude-md-mi4ja2q1g5d1abmu-01GybkzswYMB7P3RJ13Mx1M9`

**Commit Guidelines**:
- Use descriptive commit messages in Korean or English
- Prefix with type: `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `test:`
- Example: `feat: 언어설정 추가` or `fix: autocomplete positioning bug`

**Pushing**:
```bash
git add .
git commit -m "descriptive message"
git push -u origin claude/claude-md-mi4ja2q1g5d1abmu-01GybkzswYMB7P3RJ13Mx1M9
```

---

## AI Assistant Guidelines

When working on this codebase:

1. **Security first**: Always sanitize inputs, validate data
2. **Preserve Korean**: Keep Korean comments/strings unless explicitly asked to change
3. **Test thoroughly**: Browser extensions have many edge cases
4. **Check manifest**: Permissions changes require manifest updates
5. **Use existing patterns**: Follow the established code style
6. **Consider performance**: This runs on every webpage (content.js)
7. **Handle errors gracefully**: Extension context can be invalidated
8. **Maintain backwards compatibility**: Users have existing data in storage
9. **Document changes**: Update this file if architecture changes
10. **Ask before major refactors**: The watermark/license indicates private ownership

---

## Contact & License

**Author**: BDK-KIMS-9587-TS
**License**: Private use only
**Watermark**: `@bdk-auth: KIMS-9587-TS-242507`
**Copyright**: (c) 2025 syk

⚠️ **This code contains the original author's watermark and is for private use only. Unauthorized copying or modification may result in legal action.**

---

## Appendix: Chrome Extension APIs Used

- `chrome.storage.local` - Persistent snippet storage
- `chrome.storage.sync` - Settings sync across devices
- `chrome.runtime.sendMessage` - Background ↔ content communication
- `chrome.runtime.onMessage` - Message listeners
- `chrome.runtime.onInstalled` - First-run initialization
- `chrome.tabs.query` - Find active tab
- `chrome.tabs.sendMessage` - Send to specific tab
- `chrome.contextMenus.create` - Right-click menu
- `chrome.notifications.create` - Desktop notifications
- `chrome.action.setBadgeText` - Icon badge
- `chrome.action.setTitle` - Icon tooltip
- `chrome.commands.onCommand` - Keyboard shortcuts
- `chrome.alarms.create` - Periodic background tasks
- `chrome.i18n.getMessage` - Localization

---

**Last Updated**: 2025-01-15
**Document Version**: 1.0
**For**: AI assistants working on Text Saver extension
