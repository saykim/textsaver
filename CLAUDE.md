# CLAUDE.md - Text Saver Extension

> **AI Assistant Guide**: This document provides a comprehensive overview of the Text Saver Chrome Extension codebase, development workflows, and key conventions for AI-assisted development.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Key Components](#key-components)
5. [Development Workflows](#development-workflows)
6. [Security Conventions](#security-conventions)
7. [Code Style Guidelines](#code-style-guidelines)
8. [Data Flow & State Management](#data-flow--state-management)
9. [Testing & Debugging](#testing--debugging)
10. [Common Tasks](#common-tasks)
11. [Internationalization (i18n)](#internationalization-i18n)
12. [Performance Considerations](#performance-considerations)

---

## 🎯 Project Overview

### What is Text Saver?

**Text Saver** is a Chrome Extension (Manifest V3) that allows users to save, manage, and quickly access text snippets, code fragments, and prompts. It features a powerful `//` auto-completion system that works on any web page.

### Key Features

- ✍️ **Text Snippet Management**: Save, edit, delete text with titles, tags, and metadata
- ⭐ **Bookmark System**: Mark important snippets for quick access
- 🔍 **Advanced Search**: Full-text search across titles, content, and tags
- ⚡ **`//` Auto-Completion**: Type `//` in any input field to trigger snippet suggestions
- 🖱️ **Context Menu**: Right-click to save selected text from any webpage
- ⌨️ **Keyboard Shortcuts**: `Ctrl+Shift+T` (Windows) / `Cmd+Shift+T` (Mac) to toggle auto-complete
- 💾 **Data Management**: Import/export data as JSON, restore default prompts
- 🤖 **Default Prompt Templates**: CoT, ToT, ReAct, SCAMPER, PCIO prompt engineering templates
- 📝 **Auto-Save**: Automatic temporary data saving in popup
- 🌐 **Internationalization**: Support for Korean (default) and English

### Version & Status

- **Current Version**: 2.3
- **Manifest Version**: 3 (latest Chrome Extension standard)
- **Browser Compatibility**: Chrome, Edge, Brave (Chromium-based browsers)
- **Security Level**: Enterprise-ready (8.4/10)

---

## 🏗️ Architecture

### Component Overview

Text Saver follows a standard Chrome Extension Manifest V3 architecture with three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │  Background  │◄────►│   Content    │      │  Popup    │ │
│  │   Service    │      │   Script     │◄────►│    UI     │ │
│  │   Worker     │      │              │      │           │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      │                    │       │
│         └──────────────────────┼────────────────────┘       │
│                                │                            │
│                    ┌───────────▼────────────┐               │
│                    │  Chrome Storage API    │               │
│                    │  (local & sync)        │               │
│                    └────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **Background Service Worker** (`js/background.js`)
   - Handles context menu creation and events
   - Manages keyboard shortcuts
   - Performs search operations
   - Maintains preset prompt templates
   - Manages extension icon state
   - Implements keep-alive mechanisms

2. **Content Script** (`js/content.js`)
   - Detects `//` trigger in input fields
   - Displays auto-completion UI overlay
   - Handles keyboard navigation (Arrow keys, Enter, Esc)
   - Inserts selected text into input fields
   - Communicates with background script for search
   - Supports contentEditable and standard inputs

3. **Popup UI** (`js/popup.js`, `popup.html`, `css/popup.css`)
   - Four-tab interface: Save, View, Bookmark, Settings
   - Text input forms with floating labels
   - Search functionality with filters
   - Data import/export features
   - Auto-complete toggle settings
   - Auto-save functionality

---

## 📁 File Structure

```
textsaver/
├── manifest.json                  # Extension configuration (Manifest V3)
├── popup.html                     # Popup UI structure
├── README.md                      # User documentation (Korean)
├── PRIVACY_POLICY.md             # Privacy policy
├── SECURITY.md                   # Security documentation
├── CLAUDE.md                     # This file (AI assistant guide)
│
├── _locales/                     # Internationalization
│   ├── en/
│   │   └── messages.json        # English translations
│   └── ko/
│       └── messages.json        # Korean translations (default)
│
├── css/
│   ├── content.css              # Content script UI styles (auto-complete overlay)
│   └── popup.css                # Popup UI styles (professional flat design)
│
├── icons/                       # Extension icons (16, 32, 48, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── generate-icons.html      # Icon generation tool
│
└── js/
    ├── background.js            # Background service worker (~572 lines)
    ├── content.js               # Content script (~1408 lines)
    └── popup.js                 # Popup UI logic (~1402 lines)
```

---

## 🔑 Key Components

### 1. Background Service Worker (`background.js`)

**Purpose**: Handles extension-wide operations, context menus, and data search.

**Key Features**:
- **Preset Prompts**: 5 default templates (CoT, ToT, ReAct, SCAMPER, PCIO)
- **Context Menu**: "Text Saver로 선택 내용 저장" for saving selected text
- **Keyboard Shortcuts**: Toggle auto-complete with `Ctrl+Shift+T`
- **Search Engine**: Fuzzy search with relevance scoring
- **Icon Management**: Dynamic icon updates based on feature state
- **Keep-Alive**: Uses Alarms API for efficient service worker persistence

**Important Functions**:
```javascript
// Preset prompt management
buildPresetTexts()          // Creates default prompt templates
restorePresetTexts()        // Restores presets to storage

// Search functionality
sortByRelevance()           // Sorts results by match quality
filterItems()               // Filters items by query
computeMatchScore()         // Calculates relevance score

// UI updates
updateExtensionIcon()       // Updates extension icon state
showTemporaryStatusBadge()  // Shows temporary badge
```

**Storage Keys**:
- `savedTexts` (local): Array of text objects
- `autoCompleteEnabled` (sync): Boolean toggle state
- `presetInitialized` (local): Boolean flag

### 2. Content Script (`content.js`)

**Purpose**: Implements `//` auto-completion on web pages.

**Key Features**:
- **Trigger Detection**: Monitors input for `//` pattern
- **Auto-Complete UI**: Dynamic overlay with search results
- **Keyboard Navigation**: Arrow keys, Enter, Escape support
- **Text Insertion**: Handles both standard inputs and contentEditable
- **Smart Positioning**: Places UI above/below input based on space
- **Cache Management**: LRU cache for search results

**Important State Variables**:
```javascript
TextSaverContentState = {
  currentInputElement: null,      // Active input field
  bookmarkSearchUI: null,         // UI overlay element
  searchResults: [],              // Current search results
  selectedIndex: -1,              // Selected item index
  autoCompleteEnabled: true,      // Feature toggle state
  activeTrigger: null,            // Current trigger position
  lastKnownCursorOffset: null     // Cursor position tracking
}
```

**Event Handlers**:
```javascript
handleInputEvent()          // Detects // trigger
handleKeydownEvent()        // Keyboard navigation
handleClickOutside()        // Closes UI on outside click
```

**Supported Input Types**:
- `<textarea>`
- `<input type="text|search|url|email|tel|password">`
- `[contenteditable]` elements
- Shadow DOM inputs (e.g., Perplexity AI)

### 3. Popup UI (`popup.js`)

**Purpose**: Main user interface for managing snippets.

**Tab Structure**:
1. **Save Tab**: Create/edit snippets
   - Title input (floating label)
   - Content textarea
   - Tags input (comma-separated)
   - Tag preview pills
   - Auto-save status indicator

2. **View Tab**: Browse all snippets
   - Search input with filters (title/content/tags)
   - Snippet list with expand/collapse
   - Double-click title to copy content
   - Action buttons: Bookmark, Copy, Edit, Delete

3. **Bookmark Tab**: Quick access to starred items
   - Filtered view of bookmarked snippets
   - Same UI as View tab

4. **Settings Tab**: Configuration & data management
   - Auto-complete toggle switch
   - Data import/export (JSON)
   - Restore default prompts
   - Reset all data (danger zone)

**Key Functions**:
```javascript
saveText()                  // Saves or updates snippet
loadTextList()              // Loads and filters snippets
toggleBookmark()            // Toggles bookmark state
copyToClipboard()           // Copies text to clipboard
deleteText()                // Deletes snippet
exportData()                // Exports to JSON
importData()                // Imports from JSON
```

---

## 🛠️ Development Workflows

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/textsaver.git
   cd textsaver
   ```

2. **Load in Chrome**:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `textsaver` folder

3. **Make changes**:
   - Edit files in your preferred editor
   - Click "Reload" button in `chrome://extensions` for each change

### Testing Workflow

**Manual Testing Checklist**:

- [ ] **Save Tab**: Create new snippet, verify auto-save
- [ ] **View Tab**: Search snippets, expand/collapse, edit, delete
- [ ] **Bookmark Tab**: Toggle bookmarks, verify filtering
- [ ] **Settings Tab**: Toggle auto-complete, export/import data
- [ ] **Auto-Completion**: Type `//` in Google, Gmail, ChatGPT
- [ ] **Context Menu**: Right-click selected text on any page
- [ ] **Keyboard Shortcut**: Test `Ctrl+Shift+T` toggle
- [ ] **Preset Prompts**: Verify CoT, ToT, ReAct templates exist
- [ ] **Security**: Test XSS injection attempts in inputs
- [ ] **i18n**: Test in English and Korean locales

**Testing Auto-Completion**:
```javascript
// Test on various sites:
// - https://www.google.com (search box)
// - https://mail.google.com (compose email)
// - https://chat.openai.com (ChatGPT input)
// - https://www.perplexity.ai (contentEditable shadow DOM)

// Type: //test
// Expected: Auto-complete UI appears with matching snippets
// Arrow keys: Navigate through results
// Enter: Insert selected snippet
// Escape: Close UI
```

### Debugging Tips

**Background Script Debugging**:
```javascript
// Open background service worker console:
// chrome://extensions → Text Saver → "service worker" link

console.log("Background script loaded");
```

**Content Script Debugging**:
```javascript
// Open DevTools on the webpage
// Check console for "Text Saver Extension: content.js loaded"

console.log("TextSaver //: Auto-complete state:", TextSaverContentState);
```

**Popup Debugging**:
```javascript
// Right-click extension icon → "Inspect popup"
// Console will show popup.js logs

console.log("Popup opened, loading saved texts...");
```

**Common Issues**:

1. **"Extension context invalidated"**:
   - Happens when extension is reloaded
   - Solution: Refresh the page where content script runs

2. **Service worker inactive**:
   - Chrome may pause service worker after 30 seconds
   - Solution: Keep-alive mechanism using Alarms API (already implemented)

3. **Auto-complete not showing**:
   - Check if feature is enabled: `chrome.storage.sync.get(['autoCompleteEnabled'])`
   - Verify content script loaded: Check console for load message
   - Ensure input field is supported: See supported selectors in `content.js`

---

## 🔒 Security Conventions

Text Saver implements **enterprise-grade security** (8.4/10 security level). All code changes MUST follow these conventions.

### 1. Input Sanitization (CRITICAL)

**Always sanitize user input before storing or displaying**:

```javascript
// ✅ CORRECT: Use sanitization functions
function sanitizeText(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>]/g, '')           // Remove HTML tags
    .replace(/javascript:/gi, '')   // Remove javascript: URLs
    .replace(/['";\\]/g, '')        // Prevent SQL injection
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .slice(0, 10000)                // Limit length
    .trim();
}

// ❌ WRONG: Direct use of user input
element.innerHTML = userInput;  // XSS vulnerability!
```

**Sanitization Functions** (defined in `popup.js`):
- `sanitizeText(input)`: General text (max 10,000 chars)
- `sanitizeTitle(input)`: Titles (max 200 chars)
- `sanitizeTags(input)`: Tags (max 500 chars)
- `validateTextData(data)`: Validates complete text object

### 2. DOM Manipulation (CRITICAL)

**Always use safe DOM methods**:

```javascript
// ✅ CORRECT: Use textContent
element.textContent = userInput;

// ✅ CORRECT: Create elements programmatically
const span = document.createElement('span');
span.className = 'tag';
span.textContent = sanitizedTag;

// ❌ WRONG: Using innerHTML
element.innerHTML = `<span>${userInput}</span>`;  // XSS!
```

### 3. Content Security Policy

The extension enforces strict CSP in `manifest.json`:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
  "sandbox": "sandbox allow-scripts allow-forms allow-popups allow-modals;"
}
```

**Rules**:
- ✅ Only load scripts from the extension itself (`'self'`)
- ✅ No inline scripts or `eval()`
- ✅ No external CDNs (Font Awesome, Google Fonts removed)
- ✅ All resources must be local

### 4. Permissions (Principle of Least Privilege)

**Current Permissions** (`manifest.json`):
```json
"permissions": [
  "storage",        // Required: Save snippets locally
  "clipboardWrite", // Required: Copy to clipboard
  "contextMenus",   // Required: Right-click menu
  "notifications",  // Required: Show save confirmations
  "activeTab",      // Required: Current tab info for context menu
  "alarms"          // Required: Keep-alive mechanism
]
```

**Content Script Scope**:
```json
"matches": ["https://*/*"],  // ✅ HTTPS only, not http://
"all_frames": false,         // ✅ No iframes
"match_about_blank": false,  // ✅ No blank pages
"run_at": "document_end"     // ✅ Safe execution timing
```

### 5. Data Validation

**Always validate data structure**:

```javascript
function validateTextData(data) {
  if (!data || typeof data !== 'object') return false;

  // Check required fields
  if (!data.title || typeof data.title !== 'string' ||
      data.title.length === 0 || data.title.length > 200) {
    return false;
  }

  if (!data.content || typeof data.content !== 'string' ||
      data.content.length === 0 || data.content.length > 10000) {
    return false;
  }

  // Validate tags array
  if (data.tags && (!Array.isArray(data.tags) ||
      data.tags.some(tag => typeof tag !== 'string' || tag.length > 50))) {
    return false;
  }

  return true;
}
```

### 6. Import/Export Security

**Limits** (defined in `popup.js`):
- Maximum items: 1,000 (prevents DoS attacks)
- Maximum file size: 10 MB
- File type: JSON only (validated)
- Each item is sanitized and validated

### 7. Tested Attack Vectors (All Mitigated)

- ✅ XSS: `<script>alert('XSS')</script>` → Sanitized
- ✅ JavaScript URLs: `javascript:alert('XSS')` → Removed
- ✅ HTML injection: `<img src=x onerror=alert()>` → Tags stripped
- ✅ SQL injection: `'; DROP TABLE;` → Quotes removed
- ✅ Large payloads: 1GB file → Rejected (10MB limit)
- ✅ Malicious JSON: Invalid structure → Rejected

---

## 📝 Code Style Guidelines

### JavaScript Conventions

**Naming**:
- **Variables**: camelCase (`savedTexts`, `autoCompleteEnabled`)
- **Functions**: camelCase (`saveText()`, `toggleBookmark()`)
- **Constants**: UPPER_SNAKE_CASE (`TEMP_STORAGE_KEY`, `AUTO_SAVE_INTERVAL`)
- **DOM Elements**: camelCase with descriptive suffix (`saveBtn`, `titleInput`)
- **CSS Classes**: kebab-case (`text-item`, `bookmark-btn`)

**Comments**:
```javascript
// ✅ GOOD: Explain WHY, not WHAT
// Keep-alive using Alarms API to prevent service worker suspension
setupKeepAlive();

// ❌ BAD: Obvious comments
// Set x to 5
let x = 5;
```

**Error Handling**:
```javascript
// ✅ CORRECT: Always handle errors
chrome.storage.local.get('savedTexts', (result) => {
  if (chrome.runtime.lastError) {
    console.error("Storage error:", chrome.runtime.lastError);
    return;
  }
  // ... process result
});

// ❌ WRONG: Ignoring errors
chrome.storage.local.get('savedTexts', (result) => {
  // What if this fails?
  processData(result.savedTexts);
});
```

### CSS Conventions

**Variables** (defined in `:root` in `popup.css`):
```css
:root {
  --primary-color: #2563eb;
  --text-primary: #0f172a;
  --bg-primary: #ffffff;
  --radius-md: 3px;
  --space-8: 1rem;
}
```

**Class Naming Pattern**:
```css
/* Component-based naming */
.text-item { }           /* Component */
.text-item__title { }    /* Element */
.text-item--expanded { } /* Modifier */

/* State classes */
.is-active { }
.is-selected { }
.is-loading { }

/* Utility classes */
.custom-scrollbar { }
.empty-state { }
```

---

## 🔄 Data Flow & State Management

### Storage Schema

**Chrome Storage (Local)**:
```javascript
{
  "savedTexts": [
    {
      "id": "1234567890",              // Timestamp-based ID
      "title": "Sample Title",         // Required, max 200 chars
      "content": "Sample content...",  // Required, max 10,000 chars
      "tags": ["tag1", "tag2"],        // Optional, array of strings
      "createdAt": "2024-01-15T10:30:00.000Z",  // ISO 8601
      "updatedAt": "2024-01-15T11:00:00.000Z",  // ISO 8601
      "isBookmarked": false,           // Boolean
      "sourceURL": "https://...",      // Optional, if saved via context menu
      "metadata": {                    // Optional
        "source": "contextMenu",       // "preset" | "contextMenu" | undefined
        "pageTitle": "Page Title",
        "createdBy": "extension",
        "presetKey": "CoT"             // For preset prompts
      }
    }
  ],
  "presetInitialized": true           // Boolean flag
}
```

**Chrome Storage (Sync)**:
```javascript
{
  "autoCompleteEnabled": true  // Boolean, syncs across devices
}
```

**LocalStorage** (Popup only):
```javascript
{
  "textSaver_temp": {
    "title": "Draft title",
    "content": "Draft content",
    "tags": "draft, temp",
    "editingId": "1234567890",
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

### Message Passing

**Popup → Background**:
```javascript
// Search request
chrome.runtime.sendMessage({
  action: 'searchItems',
  query: 'test'
}, (response) => {
  // response.items: Array of matching items
});

// Restore presets
chrome.runtime.sendMessage({
  action: 'restorePresets'
}, (response) => {
  // response.success, response.added, response.updated
});

// Update icon
chrome.runtime.sendMessage({
  action: 'updateIcon',
  enabled: true,
  showTemporary: true
});
```

**Background → Content**:
```javascript
chrome.tabs.sendMessage(tabId, {
  action: 'toggleAutoComplete',
  enabled: false
}, (response) => {
  // response.status, response.newState
});

chrome.tabs.sendMessage(tabId, {
  action: 'quickToggle'
}, (response) => {
  // response.newState
});
```

**Content → Background**:
```javascript
chrome.runtime.sendMessage({
  action: 'searchItems',
  query: 'keyword'
}, (response) => {
  // response.items: Search results
});
```

### State Synchronization

**Storage Changes**:
```javascript
// Popup.js and Content.js both listen
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.autoCompleteEnabled) {
    const enabled = changes.autoCompleteEnabled.newValue;
    // Update UI state
  }
});
```

---

## 🧪 Testing & Debugging

### Manual Test Cases

**Test Case 1: Save New Snippet**
1. Open popup → Save tab
2. Enter title: "Test Snippet"
3. Enter content: "This is a test"
4. Enter tags: "test, demo"
5. Click "저장하기"
6. ✅ Success message appears
7. ✅ Auto-switches to View tab
8. ✅ Snippet appears in list

**Test Case 2: Auto-Completion**
1. Navigate to `https://www.google.com`
2. Click in search box
3. Type: `//test`
4. ✅ UI overlay appears with matching snippets
5. Press Arrow Down
6. ✅ First item is selected (highlighted)
7. Press Enter
8. ✅ Snippet content is inserted
9. ✅ `//test` is replaced with content

**Test Case 3: Context Menu**
1. Navigate to any webpage
2. Select some text
3. Right-click → "Text Saver로 선택 내용 저장"
4. ✅ Notification appears
5. Open popup → View tab
6. ✅ Selected text appears as new snippet
7. ✅ Tags include "웹페이지" and date
8. ✅ Source URL is saved

**Test Case 4: Import/Export**
1. Open popup → Settings tab
2. Click "내보내기"
3. ✅ JSON file downloads
4. Open popup → Settings → "모든 데이터 초기화"
5. Confirm deletion
6. ✅ All snippets deleted
7. Click "가져오기" → Select exported JSON
8. ✅ All snippets restored

**Test Case 5: Keyboard Shortcut**
1. Navigate to any webpage
2. Press `Ctrl+Shift+T`
3. ✅ Notification appears: "자동완성 비활성화"
4. Type `//test` in an input
5. ✅ No UI appears (feature disabled)
6. Press `Ctrl+Shift+T` again
7. ✅ Notification: "자동완성 활성화"
8. Type `//test`
9. ✅ UI appears

### Console Debugging Commands

**Check storage**:
```javascript
// In popup console or background console
chrome.storage.local.get('savedTexts', (result) => {
  console.table(result.savedTexts);
});

chrome.storage.sync.get(['autoCompleteEnabled'], (result) => {
  console.log('Auto-complete:', result.autoCompleteEnabled);
});
```

**Check content script state** (in webpage console):
```javascript
// View current state
console.log(TextSaverContentState);

// Manually trigger search
debouncedSearchBookmarks('test');
```

**Simulate message passing**:
```javascript
// In popup console
chrome.runtime.sendMessage({
  action: 'searchItems',
  query: 'test'
}, console.log);
```

---

## 🌍 Internationalization (i18n)

### Locale Structure

**Default Locale**: Korean (`ko`)

**Supported Locales**: English (`en`), Korean (`ko`)

**Configuration**:
```json
// manifest.json
{
  "default_locale": "ko"
}
```

### Message Files

**`_locales/ko/messages.json`**:
```json
{
  "tab_save_label": {
    "message": "저장"
  },
  "button_save": {
    "message": "저장하기"
  }
}
```

**`_locales/en/messages.json`**:
```json
{
  "tab_save_label": {
    "message": "Save"
  },
  "button_save": {
    "message": "Save"
  }
}
```

### Usage in Code

**In JavaScript** (`popup.js`):
```javascript
function getLocaleMessage(key, fallback, substitutions = []) {
  if (!useEnglishLocale) return fallback;
  try {
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || fallback;
  } catch (error) {
    return fallback;
  }
}

// Usage
const saveLabel = getLocaleMessage('button_save', '저장하기');
```

**In HTML**:
```javascript
// Applied dynamically in popup.js
function applyLocaleText() {
  const textMap = [
    { selector: '#saveBtn .btn-content span', key: 'button_save' }
  ];
  textMap.forEach(({ selector, key }) => {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = getLocaleMessage(key, el.textContent);
    }
  });
}
```

### Adding New Locales

1. Create folder: `_locales/[locale_code]/`
2. Copy `_locales/ko/messages.json` to new folder
3. Translate all `message` values
4. Test by changing Chrome language settings

---

## ⚡ Performance Considerations

### 1. Search Optimization

**Debouncing**: Search is debounced by 280ms to reduce CPU usage:
```javascript
const DEBOUNCE_DELAY = 280;
const debouncedSearchBookmarks = debounce((query) => {
  // Search logic
}, DEBOUNCE_DELAY);
```

**Result Limits**:
- Content script displays: Max 50 items (`MAX_DISPLAYED_ITEMS`)
- Background search returns: Max 50 items (`MAX_SEARCH_RESULTS`)
- Cache size: Max 30 queries (`MAX_CACHED_RESULTS`)

**Caching**:
```javascript
// LRU cache for search results
const queryResultCache = new Map();

if (queryResultCache.has(query)) {
  // Return cached results immediately
  return queryResultCache.get(query);
}
```

### 2. DOM Manipulation

**Avoid Reflows**:
```javascript
// ✅ GOOD: Batch DOM updates
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const li = createListItem(item);
  fragment.appendChild(li);
});
listContainer.appendChild(fragment);

// ❌ BAD: Multiple reflows
items.forEach(item => {
  const li = createListItem(item);
  listContainer.appendChild(li); // Reflow on each iteration!
});
```

### 3. Service Worker Keep-Alive

**Problem**: Chrome suspends service workers after 30 seconds of inactivity.

**Solution**: Use Alarms API (more efficient than setInterval):
```javascript
function setupKeepAlive() {
  chrome.alarms.clear('keepAlive', () => {
    chrome.alarms.create('keepAlive', {
      periodInMinutes: 5  // Wake up every 5 minutes
    });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    chrome.storage.local.get(['keepAlive'], () => {
      console.log("Keep-alive check");
    });
  }
});
```

### 4. Storage Best Practices

**Use Appropriate Storage**:
- `chrome.storage.local`: Large data (snippets) - 10 MB limit
- `chrome.storage.sync`: Small settings (autoCompleteEnabled) - 100 KB limit, syncs across devices

**Batch Updates**:
```javascript
// ✅ GOOD: Single storage write
chrome.storage.local.set({ savedTexts: updatedArray });

// ❌ BAD: Multiple writes in loop
savedTexts.forEach((text, index) => {
  chrome.storage.local.set({ [`text_${index}`]: text }); // Slow!
});
```

---

## 🔧 Common Tasks

### Task 1: Add a New Preset Prompt Template

**File**: `js/background.js`

1. Add to `PRESET_PROMPTS` array:
```javascript
const PRESET_PROMPTS = [
  // ... existing prompts
  {
    title: 'My New Template',
    tags: ['tag1', 'tag2'],
    content: `# Template Title\n\n## Section 1\n...`
  }
];
```

2. Update `buildPresetTexts()` if needed (usually automatic)

3. Test: Settings → "기본 프롬프트 복원" → Verify new template appears

### Task 2: Add Support for a New Input Type

**File**: `js/content.js`

1. Update `SUPPORTED_INPUT_SELECTOR`:
```javascript
const SUPPORTED_INPUT_SELECTOR =
  'textarea, input[type="text"], input[type="search"], ' +
  'input[type="url"], input[type="email"], input[type="tel"], ' +
  'input[type="password"], input[type="NEW_TYPE"]';  // Add here
```

2. Test on a page with the new input type

### Task 3: Change Auto-Complete Trigger

**File**: `js/content.js`

Current trigger: `//`

To change to `@@`:

1. Update regex in `handleInputEvent()`:
```javascript
// Change from:
const match = textBeforeCursor.match(/\/\/([^\s\/]*)$/);

// To:
const match = textBeforeCursor.match(/@@([^\s@]*)$/);
```

2. Update documentation in `README.md`

3. Test thoroughly on various sites

### Task 4: Add a New Tab to Popup

**Files**: `popup.html`, `popup.js`, `css/popup.css`

1. **Add tab button** in `popup.html`:
```html
<button id="newTabBtn" class="tab-btn" data-tab="new">
  <div class="tab-icon">🆕</div>
  <span class="tab-label">New Tab</span>
</button>
```

2. **Add tab content** in `popup.html`:
```html
<div id="newTab" class="tab-content">
  <!-- Your tab content here -->
</div>
```

3. **Add event listener** in `popup.js`:
```javascript
const newTabBtn = document.getElementById('newTabBtn');
const newTab = document.getElementById('newTab');

newTabBtn.addEventListener('click', () => switchTab(newTabBtn, newTab));
```

4. **Style** in `popup.css` (usually inherits existing styles)

### Task 5: Debug "Context Invalidated" Error

**Problem**: Extension reloaded while page was open.

**Solution**:
1. Refresh the webpage
2. Or implement auto-reconnect (already done in `content.js`):
```javascript
function ensureKeepAliveConnection() {
  if (!chrome?.runtime?.id) {
    // Extension context invalidated
    return;
  }
  // Reconnect logic...
}
```

### Task 6: Add New Search Filter

**File**: `js/background.js` (search logic), `popup.js` (UI)

Example: Add filter for "source URL"

1. **Update `filterItems()`** in `background.js`:
```javascript
function filterItems(items, query) {
  const lowerQuery = String(query).toLowerCase();

  return items.filter(item => {
    return (
      // ... existing filters
      (typeof item.sourceURL === 'string' &&
       item.sourceURL.toLowerCase().includes(lowerQuery))
    );
  });
}
```

2. **Add checkbox** in `popup.html`:
```html
<label class="checkbox-wrapper">
  <input type="checkbox" id="searchURL" checked>
  <span class="checkmark">✓</span>
  <span class="checkbox-label">URL</span>
</label>
```

3. **Update `loadTextList()`** in `popup.js` to read the checkbox

---

## 🚀 Best Practices for AI Assistants

### When Adding Features

1. **Security First**: Always sanitize user input
2. **Validate**: Check data types and structure
3. **Error Handling**: Never assume operations succeed
4. **i18n**: Use `getLocaleMessage()` for all user-facing strings
5. **Performance**: Consider caching, debouncing, and batch operations
6. **Test**: Manually test in multiple scenarios
7. **Document**: Update this CLAUDE.md file with significant changes

### When Modifying Code

1. **Read Context**: Understand surrounding code before changing
2. **Preserve Patterns**: Follow existing naming and structure conventions
3. **Don't Break Security**: Never bypass sanitization or validation
4. **Comment Changes**: Explain non-obvious modifications
5. **Test Edge Cases**: Empty arrays, null values, long strings

### When Debugging

1. **Check Console**: Background, content, and popup consoles
2. **Verify Permissions**: Ensure required permissions are in manifest
3. **Storage Inspection**: Use DevTools → Application → Storage
4. **Message Flow**: Log all message passing to trace data flow
5. **Reload Extension**: After manifest.json changes, reload from chrome://extensions

---

## 📚 Additional Resources

### Chrome Extension Documentation
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

### Project Files
- `README.md`: User guide (Korean)
- `PRIVACY_POLICY.md`: Privacy policy
- `SECURITY.md`: Security documentation

### Version History
- **v2.3**: Auto-complete UX improvements (bookmark priority, smart search)
- **v2.2**: Hover preview, double-click copy
- **v2.1**: Icon design improvements
- **v2.0**: Security enhancements (XSS prevention, CSP, sanitization)
- **v1.0**: Initial release

---

## 🤝 Contributing Guidelines

When contributing or making changes:

1. **Branch Naming**: `feature/description` or `fix/description`
2. **Commit Messages**: Clear, descriptive messages in English
3. **Testing**: Test all changes thoroughly before committing
4. **Security**: Never commit code that bypasses security measures
5. **Documentation**: Update CLAUDE.md for significant changes

---

## 📞 Support & Contact

For questions or issues related to development:

- **GitHub Issues**: [Repository Issues](https://github.com/your-username/textsaver/issues)
- **Security Issues**: See SECURITY.md for responsible disclosure

---

**Last Updated**: 2024-01-15
**Maintained By**: Text Saver Development Team
**AI Assistant**: Claude (Anthropic)
