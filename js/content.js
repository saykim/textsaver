// This script will handle detecting '//' in input fields,
// displaying the bookmark search UI, and interacting with the background script.

console.log("Text Saver Extension: content.js loaded");

// 전역 변수 (모듈 패턴으로 캡슐화)
const TextSaverContentState = {
  currentInputElement: null,
  bookmarkSearchUI: null,
  searchResults: [],
  selectedIndex: -1,
  autoCompleteEnabled: true,
  debounceTimer: null,
  repositionUIBound: null,
  resizeRepositionBound: null,
  contextWarningShown: false,
  lastKnownCursorOffset: null,
  activeTrigger: null,
  lastQuerySent: null,
  lastDisplayedQuery: '',
  pendingQuery: null
};

const INPUT_EVENT_FLAG = Symbol('textSaverInputHandled');
const KEYDOWN_EVENT_FLAG = Symbol('textSaverKeydownHandled');

// 상수
const DEBOUNCE_DELAY = 280;
const MAX_CACHED_RESULTS = 30;
const MAX_DISPLAYED_ITEMS = 50;
const DEFAULT_BOOKMARK_LIMIT = 10;
const DEFAULT_RECENT_LIMIT = 10;
const TITLE_PREVIEW_LIMIT = 100;
const CONTENT_PREVIEW_LIMIT = 80;

const SUPPORTED_INPUT_SELECTOR = 'textarea, input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"]';
const queryResultCache = new Map();
const PERPLEXITY_CONTROLLER_SELECTOR = 'deepl-input-controller';
const textSaverGlobal = window.__textSaverContentHooks || (window.__textSaverContentHooks = {
  attachedControllers: new WeakSet(),
  attachedInputs: new WeakSet(),
  observers: []
});

function sanitizeForDisplay(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text, limit) {
  if (!text) {
    return '';
  }
  if (typeof limit !== 'number' || limit <= 0) {
    return text;
  }
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function getItemTimestamp(item) {
  if (!item || typeof item !== 'object') {
    return 0;
  }
  const source = item.updatedAt || item.createdAt;
  if (!source) {
    return 0;
  }
  const timestamp = new Date(source).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortByRecencyDesc(a, b) {
  return getItemTimestamp(b) - getItemTimestamp(a);
}

function normalizeEditableTarget(target) {
  if (!target) return null;

  if (target.nodeType === Node.TEXT_NODE) {
    target = target.parentElement;
  }

  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const matchedInput = target.closest(SUPPORTED_INPUT_SELECTOR);
  if (matchedInput) {
    return matchedInput;
  }

  let contentEditableCandidate = target.isContentEditable
    ? target
    : target.closest('[contenteditable]:not([contenteditable="false"])');

  if (!contentEditableCandidate) {
    return null;
  }

  while (contentEditableCandidate.parentElement && contentEditableCandidate.parentElement.isContentEditable) {
    contentEditableCandidate = contentEditableCandidate.parentElement;
  }

  return contentEditableCandidate;
}

function attachPerplexityInput(controller) {
  if (!controller || !(controller instanceof HTMLElement)) {
    return;
  }

  if (textSaverGlobal.attachedControllers.has(controller)) {
    return;
  }

  const shadowRoot = controller.shadowRoot;
  if (!shadowRoot) {
    return;
  }

  const inputEl = shadowRoot.querySelector('textarea, [contenteditable="true"], [contenteditable]:not([contenteditable="false"])');
  if (!inputEl) {
    return;
  }

  if (textSaverGlobal.attachedInputs.has(inputEl)) {
    textSaverGlobal.attachedControllers.add(controller);
    return;
  }

  const focusHandler = (event) => {
    if (!TextSaverContentState.autoCompleteEnabled) return;
    const target = normalizeEditableTarget(event.target);
    if (target) {
      TextSaverContentState.currentInputElement = target;
    }
  };

  inputEl.addEventListener('input', handleInputEvent);
  inputEl.addEventListener('keydown', handleKeydownEvent);
  inputEl.addEventListener('focusin', focusHandler, true);

  textSaverGlobal.attachedInputs.add(inputEl);
  textSaverGlobal.attachedControllers.add(controller);
}

function initPerplexitySupport() {
  try {
    document.querySelectorAll(PERPLEXITY_CONTROLLER_SELECTOR).forEach(attachPerplexityInput);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }

          if (node.matches?.(PERPLEXITY_CONTROLLER_SELECTOR)) {
            attachPerplexityInput(node);
            return;
          }

          const nestedControllers = node.querySelectorAll?.(PERPLEXITY_CONTROLLER_SELECTOR);
          if (nestedControllers && nestedControllers.length > 0) {
            nestedControllers.forEach(attachPerplexityInput);
          }
        });
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      textSaverGlobal.observers.push(observer);
    }
  } catch (error) {
    console.warn('Text Saver //: Failed to initialize Perplexity support', error);
  }
}

function getElementContentLength(element) {
  if (!element) return 0;
  if (element.isContentEditable) {
    return (element.textContent || '').length;
  }
  const value = element.value ?? '';
  return value.length;
}

function storeCursorOffset(offset, element) {
  if (typeof offset === 'number' && !Number.isNaN(offset)) {
    const length = getElementContentLength(element);
    TextSaverContentState.lastKnownCursorOffset = Math.min(Math.max(offset, 0), length);
  } else {
    TextSaverContentState.lastKnownCursorOffset = null;
  }
}

// 안전한 메시지 전송 함수 (단순화 버전)
function safeRuntimeSendMessage(message, callback) {
  try {
    // 직접 메시지 전송 시도 (사전 검증 없이)
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || '';

        // bfcache 오류는 조용히 처리 (콘솔에 출력하지 않음)
        if (errorMsg.includes(BF_CACHE_ERROR_SNIPPET)) {
          scheduleKeepAliveReconnect();
          if (callback) callback(null);
          return;
        }

        // 재시도가 필요한 에러인지 확인
        const shouldRetry = errorMsg.includes('Receiving end does not exist') ||
                           errorMsg.includes('message port closed');

        if (shouldRetry) {
          // 한 번만 재시도 (100ms 후)
          setTimeout(() => {
            try {
              chrome.runtime.sendMessage(message, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  // bfcache 오류 체크 (재시도에서도)
                  const retryErrorMsg = chrome.runtime.lastError.message || '';
                  if (!retryErrorMsg.includes(BF_CACHE_ERROR_SNIPPET)) {
                    // bfcache 오류가 아닌 경우에만 로그
                    console.warn('Text Saver //: Retry failed:', retryErrorMsg);
                  }
                  if (callback) callback(null);
                } else {
                  if (callback) callback(retryResponse);
                }
              });
            } catch (retryError) {
              if (callback) callback(null);
            }
          }, 100);
          return;
        }

        // 재시도 불필요한 에러 - 즉시 실패 처리
        if (callback) callback(null);
        return;
      }

      // 정상 응답
      if (callback) callback(response);
    });
    return true;
  } catch (error) {
    const errorMessage = error?.message || '';
    const isBfCacheError = errorMessage.includes(BF_CACHE_ERROR_SNIPPET);

    // bfcache 오류가 아닌 경우에만 경고 표시
    if (!isBfCacheError) {
      console.warn('Text Saver //: Message send failed, retrying...', errorMessage);
      showContextInvalidWarning();
    } else {
      scheduleKeepAliveReconnect();
    }

    // 예외 발생 시에도 재시도
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const finalErrorMsg = chrome.runtime.lastError.message || '';
            if (!finalErrorMsg.includes(BF_CACHE_ERROR_SNIPPET)) {
              console.warn('Text Saver //: Final retry failed:', finalErrorMsg);
            }
            if (callback) callback(null);
          } else {
            if (callback) callback(response);
          }
        });
      } catch (retryError) {
        if (callback) callback(null);
      }
    }, 100);
    return false;
  }
}

// 컨텍스트 무효화 경고 표시
function showContextInvalidWarning() {
  if (TextSaverContentState.contextWarningShown) {
    return;
  }
  TextSaverContentState.contextWarningShown = true;

  // 기존 경고가 있다면 제거
  const existingWarning = document.getElementById('text-saver-context-warning');
  if (existingWarning) {
    existingWarning.remove();
  }
  
  const warning = document.createElement('div');
  warning.id = 'text-saver-context-warning';
  warning.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 300px;
    cursor: pointer;
  `;
  warning.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 4px;">⚠️ Text Saver 확장 프로그램 오류</div>
    <div style="font-size: 12px; opacity: 0.9;">
      확장 프로그램을 재시작하거나 페이지를 새로고침해주세요.
    </div>
  `;
  
  // 클릭 시 제거
  warning.addEventListener('click', () => warning.remove());
  
  // 10초 후 자동 제거
  setTimeout(() => {
    if (warning.parentNode) {
      warning.remove();
    }
  }, 10000);
  
  document.body.appendChild(warning);
}

let keepAlivePort = null;
let keepAliveReconnectTimer = null;
let isBfcacheHidden = false;
const BF_CACHE_ERROR_SNIPPET = 'back/forward cache';

function shouldDeferKeepAlive() {
  return isBfcacheHidden || document.visibilityState === 'hidden';
}

function scheduleKeepAliveReconnect() {
  if (keepAliveReconnectTimer) {
    return;
  }

  keepAliveReconnectTimer = setTimeout(() => {
    keepAliveReconnectTimer = null;

    if (shouldDeferKeepAlive()) {
      scheduleKeepAliveReconnect();
      return;
    }

    ensureKeepAliveConnection();
  }, 2000);
}

function disconnectKeepAlivePort() {
  if (!keepAlivePort) {
    return;
  }
  try {
    keepAlivePort.disconnect();
  } catch (_) {
    // Ignore disconnect errors
  }
  keepAlivePort = null;
}

function ensureKeepAliveConnection() {
  if (!chrome?.runtime?.id) {
    return;
  }
  if (keepAlivePort || shouldDeferKeepAlive()) {
    return;
  }

  try {
    keepAlivePort = chrome.runtime.connect({ name: 'text-saver-keepalive' });
    keepAlivePort.onDisconnect.addListener(() => {
      keepAlivePort = null;
      scheduleKeepAliveReconnect();
    });
  } catch (error) {
    console.warn('Text Saver //: Keep-alive connection failed', error);
    keepAlivePort = null;

    const errorMessage = String(error?.message || '');
    if (errorMessage.includes('Extension context invalidated') || errorMessage.includes(BF_CACHE_ERROR_SNIPPET)) {
      if (errorMessage.includes(BF_CACHE_ERROR_SNIPPET)) {
        isBfcacheHidden = true;
      }
      scheduleKeepAliveReconnect();
      return;
    }

    scheduleKeepAliveReconnect();
  }
}

// 초기 설정 로드
chrome.storage.sync.get(['autoCompleteEnabled'], (result) => {
  TextSaverContentState.autoCompleteEnabled = result.autoCompleteEnabled !== false;
  console.log('TextSaver //: Initial auto-complete state:', TextSaverContentState.autoCompleteEnabled);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.autoCompleteEnabled) {
    return;
  }

  const enabled = changes.autoCompleteEnabled.newValue !== false;
  if (TextSaverContentState.autoCompleteEnabled === enabled) {
    return;
  }

  TextSaverContentState.autoCompleteEnabled = enabled;

  if (!enabled) {
    hideBookmarkSearchUI();
  }

  showToggleNotification(enabled);
});

ensureKeepAliveConnection();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    ensureKeepAliveConnection();
  }
});

window.addEventListener('pageshow', (event) => {
  isBfcacheHidden = false;
  if (event.persisted) {
    scheduleKeepAliveReconnect();
  } else {
    ensureKeepAliveConnection();
  }
});

window.addEventListener('pagehide', (event) => {
  if (event.persisted) {
    isBfcacheHidden = true;
  }
  disconnectKeepAlivePort();
});

// 메시지 패싱 리스너 (개선된 버전)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('TextSaver //: Message received:', request);

  const handlers = {
    toggleAutoComplete: () => {
      TextSaverContentState.autoCompleteEnabled = request.enabled;
      console.log('TextSaver //: Auto-complete toggled to:', request.enabled);

      if (!request.enabled) hideBookmarkSearchUI();
      showToggleNotification(request.enabled);

      sendResponse({ status: 'applied', newState: request.enabled });
    },

    getStatus: () => {
      sendResponse({ enabled: TextSaverContentState.autoCompleteEnabled });
    },

    quickToggle: () => {
      TextSaverContentState.autoCompleteEnabled = !TextSaverContentState.autoCompleteEnabled;

      chrome.storage.sync.set({ autoCompleteEnabled: TextSaverContentState.autoCompleteEnabled });

      if (!TextSaverContentState.autoCompleteEnabled) hideBookmarkSearchUI();
      showToggleNotification(TextSaverContentState.autoCompleteEnabled);

      sendResponse({ newState: TextSaverContentState.autoCompleteEnabled });
    }
  };

  if (handlers[request.action]) {
    handlers[request.action]();
    return true;
  }

  return false;
});

// 개선된 디바운스 함수
function debounce(func, delay) {
  return function(...args) {
    clearTimeout(TextSaverContentState.debounceTimer);
    TextSaverContentState.debounceTimer = setTimeout(() => func.apply(this, args), delay);
  };
}

// 검색 함수 (개선된 버전 - 에러 처리 강화)
function loadDefaultSuggestions(targetElement) {
  if (!TextSaverContentState.autoCompleteEnabled) {
    return;
  }

  const normalizedTarget = normalizeEditableTarget(targetElement);
  if (!normalizedTarget || !document.contains(normalizedTarget)) {
    return;
  }

  chrome.storage.local.get('savedTexts', (result) => {
    if (!TextSaverContentState.autoCompleteEnabled) {
      return;
    }

    const activeElement = normalizeEditableTarget(TextSaverContentState.currentInputElement);
    if (!activeElement || activeElement !== normalizedTarget) {
      return;
    }

    const savedTexts = Array.isArray(result.savedTexts) ? result.savedTexts : [];

    if (savedTexts.length === 0) {
      TextSaverContentState.searchResults = [];
      TextSaverContentState.selectedIndex = -1;
      TextSaverContentState.lastQuerySent = null;
      TextSaverContentState.pendingQuery = '';
      TextSaverContentState.lastDisplayedQuery = '';
      displayBookmarkSearchUI(activeElement, []);
      return;
    }

    const effectiveTotalLimit = Math.min(
      MAX_DISPLAYED_ITEMS,
      DEFAULT_BOOKMARK_LIMIT + DEFAULT_RECENT_LIMIT
    );
    const bookmarkedLimit = Math.min(DEFAULT_BOOKMARK_LIMIT, effectiveTotalLimit);

    const bookmarked = savedTexts
      .filter(item => item && item.isBookmarked)
      .sort(sortByRecencyDesc)
      .slice(0, bookmarkedLimit);

    const remainingSlots = Math.max(0, effectiveTotalLimit - bookmarked.length);
    const nonBookmarkedLimit = Math.min(
      MAX_DISPLAYED_ITEMS - bookmarked.length,
      Math.max(DEFAULT_RECENT_LIMIT, remainingSlots)
    );

    const nonBookmarked = savedTexts
      .filter(item => item && !item.isBookmarked)
      .sort(sortByRecencyDesc)
      .slice(0, nonBookmarkedLimit);

    const suggestions = [];
    const seenIds = new Set();

    [...bookmarked, ...nonBookmarked].forEach(item => {
      if (!item || !item.id) {
        return;
      }
      if (seenIds.has(item.id)) {
        return;
      }
      seenIds.add(item.id);
      suggestions.push(item);
    });

    TextSaverContentState.searchResults = suggestions;
    TextSaverContentState.selectedIndex = -1;
    TextSaverContentState.lastQuerySent = null;
    TextSaverContentState.pendingQuery = '';
    TextSaverContentState.lastDisplayedQuery = '';

    displayBookmarkSearchUI(activeElement, suggestions);
  });
}

const debouncedSearchBookmarks = debounce((rawQuery) => {
  if (!TextSaverContentState.autoCompleteEnabled || !TextSaverContentState.currentInputElement) {
    return;
  }

  if (typeof rawQuery !== 'string') {
    TextSaverContentState.lastQuerySent = null;
    TextSaverContentState.searchResults = [];
    TextSaverContentState.pendingQuery = null;
    hideBookmarkSearchUI();
    return;
  }

  const query = rawQuery.trim();

  if (query.length === 0) {
    TextSaverContentState.lastQuerySent = null;
    TextSaverContentState.pendingQuery = '';
    TextSaverContentState.lastDisplayedQuery = '';
    loadDefaultSuggestions(TextSaverContentState.currentInputElement);
    return;
  }

  if (query === TextSaverContentState.lastQuerySent) {
    return;
  }

  TextSaverContentState.searchResults = [];
  TextSaverContentState.pendingQuery = query;

  if (queryResultCache.has(query)) {
    TextSaverContentState.searchResults = queryResultCache.get(query);
    textSaverRenderCachedResults(query);
    return;
  }

  TextSaverContentState.lastQuerySent = query;
  const success = safeRuntimeSendMessage({ action: 'searchItems', query }, (response) => {
    // response가 null이면 에러 발생한 것
    if (response === null) {
      console.warn('Text Saver //: Search failed due to extension context error');
      TextSaverContentState.searchResults = [];
      TextSaverContentState.lastQuerySent = null;
      showContextInvalidWarning();

      // 에러 메시지를 UI에 표시
      if (TextSaverContentState.currentInputElement && TextSaverContentState.autoCompleteEnabled) {
        displayBookmarkSearchUI(TextSaverContentState.currentInputElement, []);
      }
      return;
    }

    const items = Array.isArray(response?.items) ? response.items : [];
    queryResultCache.set(query, items);
    TextSaverContentState.searchResults = items;
    TextSaverContentState.lastDisplayedQuery = query;
    trimQueryCache();

    if (TextSaverContentState.contextWarningShown) {
      const existingWarning = document.getElementById('text-saver-context-warning');
      if (existingWarning) {
        existingWarning.remove();
      }
      TextSaverContentState.contextWarningShown = false;
    }

    if (TextSaverContentState.currentInputElement && TextSaverContentState.autoCompleteEnabled) {
      displayBookmarkSearchUI(TextSaverContentState.currentInputElement, TextSaverContentState.searchResults);
    }
  });

  if (!success) {
    // 메시지 전송 자체가 실패한 경우 (재시도 중)
    TextSaverContentState.lastQuerySent = null;
    console.log('Text Saver //: Search message sending in progress...');
  }
}, DEBOUNCE_DELAY);

// displayBookmarkSearchUI 함수 (개선된 버전)
function displayBookmarkSearchUI(inputElement, items) {
  if (!TextSaverContentState.autoCompleteEnabled || !inputElement) return;

  if (TextSaverContentState.bookmarkSearchUI) {
    TextSaverContentState.bookmarkSearchUI.remove();
  }
  TextSaverContentState.selectedIndex = -1;

  TextSaverContentState.bookmarkSearchUI = document.createElement('div');
  TextSaverContentState.bookmarkSearchUI.id = 'text-saver-bookmark-search-ui';
  const ul = document.createElement('ul');

  if (items && items.length > 0) {
    const maxItems = Math.min(items.length, MAX_DISPLAYED_ITEMS);
    
    for (let index = 0; index < maxItems; index++) {
      const item = items[index];
      const li = document.createElement('li');
      
      const sanitizedTitle = sanitizeForDisplay(item?.title || '제목 없음');
      const displayTitle = truncateText(sanitizedTitle, TITLE_PREVIEW_LIMIT);

      const sanitizedContent = sanitizeForDisplay(item?.content || '');
      const contentPreview = truncateText(sanitizedContent, CONTENT_PREVIEW_LIMIT);

      const prefix = item?.isBookmarked ? '★ ' : '';
      const composedText = prefix + displayTitle + (contentPreview ? ` - ${contentPreview}` : '');

      li.textContent = composedText;
      li.dataset.index = index; // selectAndInsertBookmark에서 사용하기 위해 인덱스 저장
      if (item?.id) {
        li.dataset.id = item.id;
      }
      if (item?.isBookmarked) {
        li.dataset.bookmarked = 'true';
      }
      li.addEventListener('click', () => {
        selectAndInsertBookmark(index); // currentInputElement는 전역변수 사용
      });
      ul.appendChild(li);
    }
    
    // 더 많은 항목이 있으면 표시
    if (items.length > maxItems) {
      const moreLi = document.createElement('li');
      moreLi.textContent = `+ ${items.length - maxItems}개 더 있음`;
      moreLi.classList.add('more-items');
      ul.appendChild(moreLi);
    }
  } else {
    const li = document.createElement('li');
    li.textContent = '일치하는 항목이 없습니다.';
    li.classList.add('no-results');
    ul.appendChild(li);
  }

  TextSaverContentState.bookmarkSearchUI.appendChild(ul);
  document.body.appendChild(TextSaverContentState.bookmarkSearchUI);

  // 스타일 설정
  Object.assign(TextSaverContentState.bookmarkSearchUI.style, {
    position: 'absolute',
    zIndex: '2147483647',
    maxHeight: '200px',
    overflowY: 'auto',
    minWidth: `${Math.max(180, inputElement.getBoundingClientRect().width)}px`
  });

  positionBookmarkSearchUI();
  updateSelectionVisuals();
  document.addEventListener('mousedown', handleClickOutside, true);

  // 이벤트 리스너 최적화 (중복 방지)
  cleanupEventListeners();
  TextSaverContentState.repositionUIBound = () => positionBookmarkSearchUI();
  TextSaverContentState.resizeRepositionBound = () => positionBookmarkSearchUI();
  window.addEventListener('scroll', TextSaverContentState.repositionUIBound, true);
  window.addEventListener('resize', TextSaverContentState.resizeRepositionBound, true);
}

function hideBookmarkSearchUI() {
  if (TextSaverContentState.bookmarkSearchUI) {
    TextSaverContentState.bookmarkSearchUI.remove();
    TextSaverContentState.bookmarkSearchUI = null;
  }
  TextSaverContentState.selectedIndex = -1;
  TextSaverContentState.searchResults = [];
  TextSaverContentState.activeTrigger = null;
  TextSaverContentState.pendingQuery = null;
  TextSaverContentState.lastQuerySent = null;
  TextSaverContentState.lastDisplayedQuery = '';
  document.removeEventListener('mousedown', handleClickOutside, true);
  cleanupEventListeners();

  const element = normalizeEditableTarget(TextSaverContentState.currentInputElement);
  if (!element || !document.contains(element)) {
    return;
  }

  if (document.activeElement !== element) {
    return;
  }

  if (element.isContentEditable) {
    const offset = TextSaverContentState.lastKnownCursorOffset ?? getElementContentLength(element);
    setCursorPositionContentEditable(element, offset);
  } else {
    const length = getElementContentLength(element);
    const offset = TextSaverContentState.lastKnownCursorOffset ?? length;
    const nextOffset = Math.min(Math.max(offset, 0), length);
    element.selectionStart = nextOffset;
    element.selectionEnd = nextOffset;
    try {
      element.focus({ preventScroll: true });
    } catch (_) {
      element.focus();
    }
    storeCursorOffset(nextOffset, element);
  }
}

function cleanupEventListeners() {
  if (TextSaverContentState.repositionUIBound) {
    window.removeEventListener('scroll', TextSaverContentState.repositionUIBound, true);
    TextSaverContentState.repositionUIBound = null;
  }
  if (TextSaverContentState.resizeRepositionBound) {
    window.removeEventListener('resize', TextSaverContentState.resizeRepositionBound, true);
    TextSaverContentState.resizeRepositionBound = null;
  }
}

// selectAndInsertBookmark 함수 (개선된 버전 - 중복 삽입 버그 수정)
function selectAndInsertBookmark(index) {
  if (!TextSaverContentState.autoCompleteEnabled ||
      index < 0 ||
      index >= TextSaverContentState.searchResults.length) {
    console.warn('Text Saver //: selectAndInsertBookmark - Invalid state or index');
    return;
  }

  const item = TextSaverContentState.searchResults[index];
  if (!item) {
    console.warn('Text Saver //: selectAndInsertBookmark - Item not found');
    return;
  }

  TextSaverContentState.activeTrigger = null;
  TextSaverContentState.pendingQuery = null;
  TextSaverContentState.lastQuerySent = null;
  TextSaverContentState.lastDisplayedQuery = '';

  const textToInsert = item.content || item.title ||
    (item.sourceURL && !item.content ? `[${item.title || 'link'}](${item.sourceURL})` : '');

  let element = normalizeEditableTarget(TextSaverContentState.currentInputElement);
  if (!element || !document.contains(element)) {
    console.warn('Text Saver //: No valid input element found for insertion');
    hideBookmarkSearchUI();
    return;
  }

  TextSaverContentState.currentInputElement = element;

  try {
    element.focus({ preventScroll: true });
  } catch (_) {
    element.focus();
  }

  const isContentEditable = element.isContentEditable;
  const currentValue = isContentEditable ? element.textContent : (element.value ?? '');
  const cursorPos = isContentEditable
    ? getCursorPositionContentEditable(element)
    : (typeof element.selectionStart === 'number' ? element.selectionStart : currentValue.length);

  const textBeforeCursor = currentValue.slice(0, cursorPos);
  const match = textBeforeCursor.match(/\/\/([^\s\/]*)$/);

  let startIndex = match && typeof match.index === 'number' ? match.index : null;
  let endIndex = match ? cursorPos : null;

  const trigger = TextSaverContentState.activeTrigger;
  if (trigger && trigger.element === element) {
    startIndex = trigger.startOffset;
    endIndex = trigger.endOffset;
  }

  if (startIndex === null || endIndex === null) {
    const resultingOffset = insertTextAtCursor(element, textToInsert);
    if (typeof resultingOffset === 'number') {
      storeCursorOffset(resultingOffset, element);
    }
    hideBookmarkSearchUI();
    return;
  }

  let syntheticEventNeeded = false;
  let handled = false;
  const targetOffset = startIndex + textToInsert.length;

  if (isContentEditable) {
    const replaceResult = replaceContentEditableToken(element, currentValue, startIndex, endIndex, textToInsert);
    handled = replaceResult.success;
    syntheticEventNeeded = replaceResult.syntheticEventNeeded;

    if (!handled) {
      try {
        const newText = currentValue.substring(0, startIndex) + textToInsert + currentValue.substring(endIndex);
        element.textContent = newText;
        setCursorPositionContentEditable(element, startIndex + textToInsert.length);
        handled = true;
        syntheticEventNeeded = true;
      } catch (error) {
        console.error('Text Saver //: ContentEditable fallback failed:', error);
      }
    }
  } else {
    const beforePattern = currentValue.substring(0, startIndex);
    const afterPattern = currentValue.substring(endIndex);
    const newText = beforePattern + textToInsert + afterPattern;

    element.value = newText;
    const newCursorPos = startIndex + textToInsert.length;
    element.selectionStart = element.selectionEnd = newCursorPos;
    handled = true;
    syntheticEventNeeded = true;
  }

  if (handled) {
    storeCursorOffset(targetOffset, element);
  }

  if (handled && syntheticEventNeeded) {
    dispatchSyntheticInputEvents(element, textToInsert);
  }

  if (handled && element.isContentEditable) {
    requestAnimationFrame(() => {
      if (document.contains(element)) {
        setCursorPositionContentEditable(element, targetOffset);
      }
    });
  }

  hideBookmarkSearchUI();
}


// --- Helper Functions (findTextNodeForContentEditable, getCursorPositionContentEditable, setCursorPositionContentEditable, insertTextAtCursor, updateSelectionVisuals) ---
// 이 함수들은 selectAndInsertBookmark 등에서 사용되므로 유지합니다.
// isFeatureEnabled 체크는 이 함수들 내부에는 없었으므로 그대로 둡니다.

function findTextNodeForContentEditable(element, globalCharOffset) {
    let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let currentNode;
    let accumulatedOffset = 0;
    while (currentNode = walker.nextNode()) {
        let nodeLength = currentNode.textContent.length;
        if (accumulatedOffset + nodeLength >= globalCharOffset) {
            return { node: currentNode, offsetInNode: globalCharOffset - accumulatedOffset };
        }
        accumulatedOffset += nodeLength;
    }
    walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let lastTextNode = null, lastOffset = 0;
    while(currentNode = walker.nextNode()) { 
        lastTextNode = currentNode;
        lastOffset = currentNode.textContent.length;
    }
    if (lastTextNode) return { node: lastTextNode, offsetInNode: lastOffset }; 
    return null; 
}

function getCursorPositionContentEditable(element) {
  if (!element) {
    return TextSaverContentState.lastKnownCursorOffset ?? 0;
  }

  try {
    element.focus({ preventScroll: true });
  } catch (_) {
    element.focus();
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    const fallback = TextSaverContentState.lastKnownCursorOffset ?? getElementContentLength(element);
    storeCursorOffset(fallback, element);
    return fallback;
  }

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) {
    const fallback = TextSaverContentState.lastKnownCursorOffset ?? getElementContentLength(element);
    storeCursorOffset(fallback, element);
    return fallback;
  }

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  const offset = preCaretRange.toString().length;
  storeCursorOffset(offset, element);
  return offset;
}

function setCursorPositionContentEditable(element, position) {
    if (!element) return;

    const totalLength = getElementContentLength(element);
    const targetPosition = Math.min(Math.max(position ?? totalLength, 0), totalLength);

    const selection = window.getSelection();
    if (!selection) {
        storeCursorOffset(targetPosition, element);
        try {
            element.focus({ preventScroll: true });
        } catch (_) {
            element.focus();
        }
        return;
    }

    const range = document.createRange();
    let charCount = 0, foundNode = false;
    function traverseNodes(node) {
        if (foundNode || !node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const nextCharCount = charCount + node.length;
            if (targetPosition >= charCount && targetPosition <= nextCharCount) {
                range.setStart(node, targetPosition - charCount);
                range.collapse(true);
                foundNode = true;
            }
            charCount = nextCharCount;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (let i = 0; i < node.childNodes.length && !foundNode; i++) {
                traverseNodes(node.childNodes[i]);
            }
        }
    }
    traverseNodes(element);

    if (foundNode) {
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    try {
        element.focus({ preventScroll: true });
    } catch (_) {
        element.focus();
    }

    storeCursorOffset(targetPosition, element);
}

function replaceContentEditableToken(element, currentText, startIndex, endIndex, replacementText) {
  const selection = window.getSelection();
  if (!selection) {
    return { success: false, syntheticEventNeeded: true };
  }

  const startInfo = findTextNodeForContentEditable(element, startIndex);
  const endInfo = findTextNodeForContentEditable(element, endIndex);

  if (!startInfo || !endInfo) {
    return { success: false, syntheticEventNeeded: true };
  }

  try {
    const range = document.createRange();
    range.setStart(startInfo.node, Math.min(startInfo.offsetInNode, startInfo.node.textContent.length));
    range.setEnd(endInfo.node, Math.min(endInfo.offsetInNode, endInfo.node.textContent.length));

    selection.removeAllRanges();
    selection.addRange(range);

    let execResult = false;
    try {
      execResult = document.execCommand('insertText', false, replacementText);
    } catch (error) {
      execResult = false;
    }

    if (!execResult) {
      range.deleteContents();
      const textNode = document.createTextNode(replacementText);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return { success: true, syntheticEventNeeded: true };
    }

    selection.collapseToEnd();
    return { success: true, syntheticEventNeeded: false };
  } catch (error) {
    console.warn('Text Saver //: Range replacement failed, applying manual fallback.', error);
    return { success: false, syntheticEventNeeded: true };
  }
}

function insertTextAtCursor(inputElement, text) {
  if (!inputElement) return null;

  let syntheticEventNeeded = false;

  if (inputElement.isContentEditable) {
    try {
      inputElement.focus({ preventScroll: true });
    } catch (_) {
      inputElement.focus();
    }

    let execResult = false;
    try {
      execResult = document.execCommand('insertText', false, text);
    } catch (error) {
      execResult = false;
    }

    if (!execResult) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        const newText = (inputElement.textContent || '') + text;
        inputElement.textContent = newText;
        setCursorPositionContentEditable(inputElement, newText.length);
      }
      syntheticEventNeeded = true;
    }
  } else {
    const currentValue = inputElement.value ?? '';
    const start = typeof inputElement.selectionStart === 'number' ? inputElement.selectionStart : currentValue.length;
    const end = typeof inputElement.selectionEnd === 'number' ? inputElement.selectionEnd : currentValue.length;
    inputElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);
    inputElement.selectionStart = inputElement.selectionEnd = start + text.length;
    syntheticEventNeeded = true;
  }

  if (syntheticEventNeeded) {
    dispatchSyntheticInputEvents(inputElement, text);
  }

  let resultingOffset = null;
  if (inputElement.isContentEditable) {
    resultingOffset = getCursorPositionContentEditable(inputElement);
  } else {
    const length = getElementContentLength(inputElement);
    const offset = typeof inputElement.selectionStart === 'number' ? inputElement.selectionStart : length;
    resultingOffset = Math.min(Math.max(offset, 0), length);
    storeCursorOffset(resultingOffset, inputElement);
  }

  return resultingOffset;
}

function dispatchSyntheticInputEvents(element, insertedText) {
  if (!element) return;

  let inputEvent;
  try {
    inputEvent = typeof InputEvent === 'function'
      ? new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: insertedText,
          inputType: 'insertText'
        })
      : new Event('input', { bubbles: true, cancelable: true });
  } catch (error) {
    inputEvent = new Event('input', { bubbles: true, cancelable: true });
  }

  element.dispatchEvent(inputEvent);

  if (!element.isContentEditable) {
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }
}

function updateSelectionVisuals() {
  if (!TextSaverContentState.bookmarkSearchUI) return;
  const items = TextSaverContentState.bookmarkSearchUI.querySelectorAll('ul li');
  items.forEach((item, idx) => {
    item.classList.toggle('selected', idx === TextSaverContentState.selectedIndex);
    if (idx === TextSaverContentState.selectedIndex) item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

// 입력창 위치에 따라 자동완성 UI를 위/아래로 배치
function positionBookmarkSearchUI() {
  if (!TextSaverContentState.bookmarkSearchUI || !TextSaverContentState.currentInputElement) return;

  const rect = TextSaverContentState.currentInputElement.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  // UI 실제 높이 계산 (maxHeight 고려)
  const desiredHeight = Math.min(TextSaverContentState.bookmarkSearchUI.scrollHeight, 200);
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  const shouldPlaceAbove = spaceBelow < (desiredHeight + 12) && spaceAbove >= spaceBelow;

  // 수직 위치
  const top = shouldPlaceAbove
    ? (window.scrollY + rect.top - desiredHeight - 5)
    : (window.scrollY + rect.bottom + 5);

  // 수평 위치 (좌우 화면 밖으로 나가지 않도록 보정)
  // 최소 너비는 입력창 너비, 실제 UI 너비 측정 후 보정
  const uiWidth = Math.max(TextSaverContentState.bookmarkSearchUI.offsetWidth, rect.width);
  let left = window.scrollX + rect.left;
  const minLeft = window.scrollX + 4;
  const maxLeft = window.scrollX + viewportWidth - uiWidth - 4;
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = Math.max(minLeft, maxLeft);

  TextSaverContentState.bookmarkSearchUI.style.top = `${top}px`;
  TextSaverContentState.bookmarkSearchUI.style.left = `${left}px`;
  TextSaverContentState.bookmarkSearchUI.dataset.placement = shouldPlaceAbove ? 'above' : 'below';
}

function textSaverRenderCachedResults(query) {
  TextSaverContentState.lastDisplayedQuery = query;
  TextSaverContentState.pendingQuery = query;
  if (TextSaverContentState.currentInputElement && TextSaverContentState.autoCompleteEnabled) {
    displayBookmarkSearchUI(TextSaverContentState.currentInputElement, TextSaverContentState.searchResults);
  }
}

function trimQueryCache() {
  if (queryResultCache.size <= MAX_CACHED_RESULTS) {
    return;
  }

  const keys = queryResultCache.keys();
  while (queryResultCache.size > MAX_CACHED_RESULTS) {
    const keyToDelete = keys.next().value;
    if (keyToDelete === TextSaverContentState.lastDisplayedQuery) {
      continue;
    }
    queryResultCache.delete(keyToDelete);
  }
}

// Input 이벤트 핸들러 (메인 로직)
function handleInputEvent(event) {
  if (!TextSaverContentState.autoCompleteEnabled) return;
  if (!event) return;
  if (event[INPUT_EVENT_FLAG]) return;
  event[INPUT_EVENT_FLAG] = true;

  const target = normalizeEditableTarget(event.target);
  if (!target) {
    hideBookmarkSearchUI();
    return;
  }

  if (!document.contains(target)) {
    hideBookmarkSearchUI();
    return;
  }

  TextSaverContentState.currentInputElement = target;
  const insertedData = typeof event.data === 'string' ? event.data : '';
  const shouldCheckForTrigger = insertedData.includes('/') || insertedData === '' || !!TextSaverContentState.activeTrigger;
  if (!shouldCheckForTrigger) {
    TextSaverContentState.pendingQuery = null;
    return;
  }

  const text = target.isContentEditable ? target.textContent : (target.value ?? '');
  const cursorPos = target.isContentEditable
    ? getCursorPositionContentEditable(target)
    : (typeof target.selectionStart === 'number' ? target.selectionStart : text.length);

  storeCursorOffset(cursorPos, target);

  const textBeforeCursor = text.slice(0, cursorPos);
  const match = textBeforeCursor.match(/\/\/([^\s\/]*)$/);

  if (match) {
    const query = match[1];
    TextSaverContentState.activeTrigger = {
      element: target,
      startOffset: match.index,
      endOffset: cursorPos
    };
    TextSaverContentState.pendingQuery = query;
    debouncedSearchBookmarks(query);
  } else {
    TextSaverContentState.activeTrigger = null;
    TextSaverContentState.pendingQuery = null;
    hideBookmarkSearchUI();
  }
}

// 키보드 이벤트 핸들러 (UI 네비게이션 및 선택/닫기)
function handleKeydownEvent(event) {
  if (!TextSaverContentState.autoCompleteEnabled) return; // 비활성화 시 조기 종료
  if (!TextSaverContentState.bookmarkSearchUI) return; // UI 없으면 아무것도 안함
  if (!event) return;
  if (event[KEYDOWN_EVENT_FLAG]) return;
  event[KEYDOWN_EVENT_FLAG] = true;

  const currentElement = normalizeEditableTarget(TextSaverContentState.currentInputElement);
  if (!currentElement || !document.contains(currentElement)) {
    hideBookmarkSearchUI();
    return;
  }

  TextSaverContentState.currentInputElement = currentElement;

  if (TextSaverContentState.searchResults.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      TextSaverContentState.selectedIndex = (TextSaverContentState.selectedIndex + 1) % TextSaverContentState.searchResults.length;
      updateSelectionVisuals();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      TextSaverContentState.selectedIndex = (TextSaverContentState.selectedIndex - 1 + TextSaverContentState.searchResults.length) % TextSaverContentState.searchResults.length;
      updateSelectionVisuals();
      return;
    }
  }

  if (event.key === 'Enter') {
    if (TextSaverContentState.selectedIndex !== -1 && TextSaverContentState.searchResults.length > 0) {
      event.preventDefault();
      selectAndInsertBookmark(TextSaverContentState.selectedIndex);
    } else {
      hideBookmarkSearchUI();
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    hideBookmarkSearchUI();
  }
}

// UI 외부 클릭 시 UI 숨기기
function handleClickOutside(event) {
  if (!TextSaverContentState.autoCompleteEnabled) return; // 비활성화 시 조기 종료
  if (TextSaverContentState.bookmarkSearchUI && !TextSaverContentState.bookmarkSearchUI.contains(event.target) && event.target !== TextSaverContentState.currentInputElement) {
    hideBookmarkSearchUI();
  }
}

// 토글 알림 표시 함수
function showToggleNotification(enabled) {
  // 기존 알림 제거
  const existingNotification = document.getElementById('text-saver-toggle-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'text-saver-toggle-notification';
  notification.style.cssText = `
    position: fixed; 
    top: 20px; 
    right: 20px; 
    z-index: 999999;
    background: ${enabled ? 'linear-gradient(135deg, #4CAF50, #45a049)' : 'linear-gradient(135deg, #f44336, #d32f2f)'}; 
    color: white;
    padding: 12px 20px; 
    border-radius: 8px; 
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform: translateY(-10px);
    opacity: 0;
  `;
  
  const icon = enabled ? '✓' : '✗';
  const message = enabled ? 'Text Saver // 자동완성 활성화' : 'Text Saver // 자동완성 비활성화';
  
  // XSS 방지: innerHTML 대신 안전한 DOM 조작 사용
  const iconSpan = document.createElement('span');
  iconSpan.style.marginRight = '8px';
  iconSpan.textContent = icon;
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  
  notification.appendChild(iconSpan);
  notification.appendChild(messageSpan);
  
  document.body.appendChild(notification);
  
  // 애니메이션으로 표시
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 10);
  
  // 3초 후 제거
  setTimeout(() => {
    notification.style.transform = 'translateY(-10px)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

document.addEventListener('input', handleInputEvent);
document.addEventListener('keydown', handleKeydownEvent); // keydown 리스너는 displayBookmarkSearchUI에서 동적으로 추가/제거하는 대신 항상 유지
document.addEventListener('focusin', (event) => {
  if (!TextSaverContentState.autoCompleteEnabled) return;
  const target = normalizeEditableTarget(event.target);
  if (target) {
    TextSaverContentState.currentInputElement = target;
  }
});

console.log("TextSaver //: Content script with message passing support loaded."); 

initPerplexitySupport();
