/*
 * Text Saver - 텍스트 저장 및 관리 확장 프로그램
 * 
 * @bdk-auth: KIMS-9587-TS-242507
 * @license: Private use only
 * @ts-sig: BDK-TS-24072025-KIMS-9587
 * 
 * 이 코드는 원작자의 워터마크를 포함하고 있습니다.
 * 무단 복제 및 수정 시 법적 조치를 취할 수 있습니다.
 */
// Copyright (c) 2025 syk

// 자동 저장을 위한 키 상수 정의
const TEMP_STORAGE_KEY = 'textSaver_temp';
const AUTO_SAVE_INTERVAL = 1000; // 1초마다 자동 저장
let autoSaveTimer = null;

// 전역 변수 선언 (스코프 문제 해결)
let autoCompleteToggle = null;
let featureStatusText = null;
let inAppNotification = null;
const detectedLocale = (chrome?.i18n?.getUILanguage?.() || navigator.language || 'ko').toLowerCase();
const isKoreanLocale = detectedLocale.startsWith('ko');
const useEnglishLocale = !isKoreanLocale && !!(chrome?.i18n?.getMessage);

function getLocaleMessage(key, fallback, substitutions = []) {
  if (!useEnglishLocale) return fallback;
  try {
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || fallback;
  } catch (error) {
    return fallback;
  }
}

// 보안: 입력 검증 및 Sanitization 함수들
function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  
  return input
    // HTML 태그 제거
    .replace(/[<>]/g, '')
    // JavaScript 스키마 제거
    .replace(/javascript:/gi, '')
    // SQL 인젝션 방지 기본 패턴
    .replace(/['";\\]/g, '')
    // 스크립트 관련 키워드 제거
    .replace(/(<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>)/gi, '')
    // 이벤트 핸들러 속성 제거
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // 길이 제한 (제목: 200자, 내용: 10000자)
    .slice(0, 10000)
    .trim();
}

function sanitizeTitle(input) {
  return sanitizeText(input).slice(0, 200);
}

function sanitizeTags(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/['";\\]/g, '')
    .slice(0, 500)
    .trim();
}

function validateTextData(data) {
  if (!data || typeof data !== 'object') return false;

  if (!data.title || typeof data.title !== 'string' ||
      data.title.length === 0 || data.title.length > 200) {
    return false;
  }

  if (!data.content || typeof data.content !== 'string' ||
      data.content.length === 0 || data.content.length > 10000) {
    return false;
  }

  if (data.tags && (!Array.isArray(data.tags) ||
      data.tags.some(tag => typeof tag !== 'string' || tag.length > 50))) {
    return false;
  }

  return true;
}

function applyLocaleText() {
  if (!useEnglishLocale) return;
  const textMap = [
    { selector: '#saveTabBtn .tab-label', key: 'tab_save_label' },
    { selector: '#viewTabBtn .tab-label', key: 'tab_view_label' },
    { selector: '#bookmarkTabBtn .tab-label', key: 'tab_bookmark_label' },
    { selector: '#settingsTabBtn .tab-label', key: 'tab_settings_label' },
    { selector: '#saveBtn .btn-content span', key: 'button_save' },
    { selector: '#bookmarkTab .section-header h3', key: 'bookmark_section_title' },
    { selector: '#bookmarkTab .section-header p', key: 'bookmark_section_desc' },
    { selector: '#emptyBookmarkMessage h4', key: 'bookmark_empty_title' },
    { selector: '#emptyBookmarkMessage p', key: 'bookmark_empty_desc' },
    { selector: '#settingsTab .settings-section:nth-of-type(1) .header-title', key: 'settings_feature_title' },
    { selector: '#settingsTab .settings-section:nth-of-type(1) .header-description', key: 'settings_feature_desc' },
    { selector: '#settingsTab .settings-section:nth-of-type(1) .setting-info h4', key: 'toggle_label' },
    { selector: '#settingsTab .settings-section:nth-of-type(1) .setting-info p', key: 'toggle_desc' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .header-title', key: 'data_section_title' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .header-description', key: 'data_section_desc' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .setting-item:nth-of-type(1) .setting-info h4', key: 'import_title' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .setting-item:nth-of-type(1) .setting-info p', key: 'import_desc' },
    { selector: '#importBrowseBtn span', key: 'import_button' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .setting-item:nth-of-type(2) .setting-info h4', key: 'export_title' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .setting-item:nth-of-type(2) .setting-info p', key: 'export_desc' },
    { selector: '#exportBtn span', key: 'export_button' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .setting-item:nth-of-type(3) .setting-info h4', key: 'restore_presets_title' },
    { selector: '#settingsTab .settings-section:nth-of-type(2) .setting-item:nth-of-type(3) .setting-info p', key: 'restore_presets_desc' },
    { selector: '#restorePresetsBtn span', key: 'restore_presets_button' },
    { selector: '.settings-card.danger .setting-info h4', key: 'reset_title' },
    { selector: '.settings-card.danger .setting-info p', key: 'reset_desc' },
    { selector: '#resetDataBtn span', key: 'reset_button' }
  ];
  textMap.forEach(({ selector, key }) => {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = getLocaleMessage(key, el.textContent);
    }
  });

  const placeholders = [
    { input: '#titleInput', key: 'placeholder_title' },
    { input: '#textInput', key: 'placeholder_content' },
    { input: '#tagInput', key: 'placeholder_tags' },
    { input: '#searchInput', key: 'placeholder_search' }
  ];
  placeholders.forEach(({ input, key }) => {
    const element = document.querySelector(input);
    if (!element) return;
    const label = element.closest('.input-wrapper')?.querySelector('.floating-label');
    if (label) {
      label.textContent = getLocaleMessage(key, label.textContent);
    }
  });

  const searchOptions = [
    { selector: 'label[for="searchTitle"] .checkbox-label', key: 'search_option_title' },
    { selector: 'label[for="searchContent"] .checkbox-label', key: 'search_option_content' },
    { selector: 'label[for="searchTags"] .checkbox-label', key: 'search_option_tags' }
  ];
  searchOptions.forEach(({ selector, key }) => {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = getLocaleMessage(key, el.textContent);
    }
  });

  const statusEl = document.getElementById('featureStatusText');
  if (statusEl) {
    statusEl.textContent = `${getLocaleMessage('feature_status_prefix', '기능 상태:')} ${getLocaleMessage('feature_status_enabled', '활성화됨')}`;
  }
}

// 날짜 포맷 함수 (전역으로 이동)
function formatDate(dateString) {
  if (!dateString) return getLocaleMessage('date_missing', '날짜 없음');
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return getLocaleMessage('date_invalid', '잘못된 날짜');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    console.error('날짜 포맷 오류:', error);
    return getLocaleMessage('date_error', '날짜 오류');
  }
}

// 태그 미리보기 업데이트 함수 (전역으로 이동)
function updateTagPreview() {
  const tagInput = document.getElementById('tagInput');
  const tagPreview = document.getElementById('tagPreview');
  if (!tagInput || !tagPreview) return;
  
  const tagsString = tagInput.value.trim();
  tagPreview.textContent = '';
  
  if (tagsString) {
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    tags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'preview-tag';
      tagElement.textContent = tag;
      tagPreview.appendChild(tagElement);
    });
  }
}

// 인앱 알림 표시 함수 (전역으로 이동)
function showInAppNotification(message, type = 'info', duration = 3000) {
  if (!inAppNotification) {
    inAppNotification = document.getElementById('inAppNotification');
  }
  if (!inAppNotification) return; // 알림 요소가 없으면 중단

  // 새로운 구조: notification-content 안의 요소들 업데이트
  const notificationIcon = inAppNotification.querySelector('.notification-icon');
  const notificationText = inAppNotification.querySelector('.notification-text');
  
  if (!notificationIcon || !notificationText) return;

  // 기본 클래스 리셋
  inAppNotification.className = 'in-app-notification';

  let iconText = 'ℹ️'; // 기본 아이콘
  if (type === 'success') {
    inAppNotification.classList.add('success');
    iconText = '✅';
  } else if (type === 'error') {
    inAppNotification.classList.add('error');
    iconText = '❌';
  }

  // 아이콘과 텍스트 업데이트
  notificationIcon.className = 'notification-icon';
  notificationIcon.textContent = iconText;
  notificationText.textContent = message;

  // 알림 표시
  inAppNotification.classList.add('show');

  // duration 이후 알림 숨기기
  setTimeout(() => {
    inAppNotification.classList.remove('show');
  }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
  // 팝업 창 크기 강제 설정 (Chrome 확장 프로그램 팝업 크기 문제 해결)
  function setPopupSize() {
    const targetWidth = 500;
    const targetHeight = 600; // 600px로 통일
    
    // 🔥 브라우저 스크롤바 완전 차단
    document.documentElement.style.cssText = `
      width: ${targetWidth}px !important;
      height: ${targetHeight}px !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    `;
    
    document.body.style.cssText = `
      width: ${targetWidth}px !important;
      height: ${targetHeight}px !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    `;
    
    // 🔥 MutationObserver로 동적 변경 감지 및 차단
    const observer = new MutationObserver(() => {
      const container = document.querySelector('.container');
      if (container && container.scrollHeight > 600) {
        container.style.height = '600px';
        container.style.overflow = 'hidden';
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }
  
  // 즉시 크기 설정
  setPopupSize();
  
  // 페이지 로드 완료 후에도 한 번 더 설정
  setTimeout(setPopupSize, 100);
  
  // UI 요소 참조
  const saveTabBtn = document.getElementById('saveTabBtn');
  const viewTabBtn = document.getElementById('viewTabBtn');
  const bookmarkTabBtn = document.getElementById('bookmarkTabBtn');
  const settingsTabBtn = document.getElementById('settingsTabBtn');
  const saveTab = document.getElementById('saveTab');
  const viewTab = document.getElementById('viewTab');
  const bookmarkTab = document.getElementById('bookmarkTab');
  const settingsTab = document.getElementById('settingsTab');
  const titleInput = document.getElementById('titleInput');
  const textInput = document.getElementById('textInput');
  const tagInput = document.getElementById('tagInput');
  const tagPreview = document.getElementById('tagPreview');
  const saveBtn = document.getElementById('saveBtn');
  const searchInput = document.getElementById('searchInput');
  const searchTitle = document.getElementById('searchTitle');
  const searchContent = document.getElementById('searchContent');
  const searchTags = document.getElementById('searchTags');
  const textList = document.getElementById('textList');
  const bookmarkList = document.getElementById('bookmarkList');
  const emptyBookmarkMessage = document.getElementById('emptyBookmarkMessage');
  const editingId = document.getElementById('editingId');
  const textCounter = document.getElementById('textCounter');
  const bookmarkCounter = document.getElementById('bookmarkCounter');
  const exportBtn = document.getElementById('exportBtn');
  const importBrowseBtn = document.getElementById('importBrowseBtn');
  const importInput = document.getElementById('importInput');
  const importResult = document.getElementById('importResult');
  const restorePresetsBtn = document.getElementById('restorePresetsBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');
  applyLocaleText();
  
  // Auto-complete toggle 관련 요소 (전역 변수 초기화)
  autoCompleteToggle = document.getElementById('autoCompleteToggle');
  featureStatusText = document.getElementById('featureStatusText');
  inAppNotification = document.getElementById('inAppNotification');
  
  // 자동 저장 UI 요소 추가
  const autoSaveStatus = document.createElement('div');
  autoSaveStatus.className = 'auto-save-status';
  const statusDot = document.createElement('span');
  statusDot.className = 'status-dot';
  const statusText = document.createElement('span');
  statusText.className = 'status-text';
  statusText.textContent = getLocaleMessage('auto_save_ready', '자동 저장 준비됨');
  autoSaveStatus.appendChild(statusDot);
  autoSaveStatus.appendChild(statusText);
  // Save 버튼 바로 뒤에 자동 저장 상태 표시 추가
  saveBtn.insertAdjacentElement('afterend', autoSaveStatus);
  
  // 임시 저장 데이터 복원
  restoreTempData();
  
  // 자동 저장 타이머 시작
  startAutoSave();
  
  // Auto-complete 토글 초기화 및 이벤트 리스너
  initAutoCompleteToggle();
  
  // 탭 클릭 이벤트 리스너
  saveTabBtn.addEventListener('click', () => switchTab(saveTabBtn, saveTab));
  viewTabBtn.addEventListener('click', () => switchTab(viewTabBtn, viewTab));
  bookmarkTabBtn.addEventListener('click', () => switchTab(bookmarkTabBtn, bookmarkTab));
  settingsTabBtn.addEventListener('click', () => switchTab(settingsTabBtn, settingsTab));
  
  // 탭 전환 함수
  function switchTab(tabBtn, tabContent) {
    // 모든 탭 버튼에서 active 클래스 제거
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 모든 탭 컨텐츠에서 active 클래스 제거
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // 선택한 탭 활성화
    tabBtn.classList.add('active');
    tabContent.classList.add('active');
    
    // 보기 탭으로 전환했을 때 텍스트 목록 로드
    if (tabContent === viewTab) {
      loadTextList();
    } else if (tabContent === bookmarkTab) {
      loadBookmarkList();
    }
  }
  
  // 태그 입력 이벤트 리스너
  tagInput.addEventListener('input', updateTagPreview);
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === ',') {
      setTimeout(updateTagPreview, 0);
    }
  });
  
  // 입력 필드 초기화 함수
  function resetForm() {
    titleInput.value = '';
    textInput.value = '';
    tagInput.value = '';
    tagPreview.textContent = '';
    editingId.value = '';
    
    // 새로운 HTML 구조에 맞게 버튼 텍스트 업데이트
    const btnText = saveBtn.querySelector('.btn-content span');
    if (btnText) {
      btnText.textContent = getLocaleMessage('button_save', '저장하기');
    }
  }
  
  // 텍스트 저장 함수
  function saveText() {
    // 보안: 입력값 sanitization
    const rawTitle = titleInput.value.trim();
    const rawText = textInput.value.trim();
    const rawTagsString = tagInput.value.trim();
    
    const title = sanitizeTitle(rawTitle);
    const text = sanitizeText(rawText);
    const tagsString = sanitizeTags(rawTagsString);
    
    // 기본 검증
    if (!title) {
      showInAppNotification(getLocaleMessage('input_need_title', '제목을 입력해주세요.'), 'error');
      return;
    }
    
    if (!text) {
      showInAppNotification(getLocaleMessage('input_need_content', '내용을 입력해주세요.'), 'error');
      return;
    }
    
    // 보안 검증: 원본과 sanitized 버전이 다르면 경고
    if (rawTitle !== title || rawText !== text || rawTagsString !== tagsString) {
      showInAppNotification(getLocaleMessage('input_sanitized_warning', '입력값에서 보안상 위험한 내용이 제거되었습니다.'), 'error');
      // sanitized 값으로 입력 필드 업데이트
      titleInput.value = title;
      textInput.value = text;
      tagInput.value = tagsString;
      return;
    }
    
    // 태그 파싱 (쉼표로 구분)
    let tags = [];
    if (tagsString) {
      tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    // 저장된 텍스트 목록 가져오기
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      
      // 수정 모드인지 확인
      const isEditing = editingId.value !== '';
      
      if (isEditing) {
        // 기존 항목 업데이트
        const index = savedTexts.findIndex(item => item.id === editingId.value);
        if (index !== -1) {
          const isBookmarked = savedTexts[index].isBookmarked || false;
          const currentMetadata = savedTexts[index].metadata; // 기존 메타데이터 유지
          const updatedItem = {
            ...savedTexts[index],
            title: title,
            content: text,
            tags: tags,
            updatedAt: new Date().toISOString(),
            isBookmarked: isBookmarked,
            metadata: currentMetadata // 기존 메타데이터 보존
          };

          if (!validateTextData(updatedItem)) {
            showInAppNotification(getLocaleMessage('data_invalid', '데이터 형식이 올바르지 않습니다.'), 'error');
            return;
          }

          savedTexts[index] = updatedItem;
        }
      } else {
        // 새 텍스트 객체 생성
        const newText = {
          id: Date.now().toString(),
          title: title,
          content: text,
          tags: tags,
          createdAt: new Date().toISOString(),
          isBookmarked: false,
          // metadata: {} // 새 텍스트 저장 시 metadata는 background에서 추가되므로 여기서는 불필요
        };

        if (!validateTextData(newText)) {
          showInAppNotification(getLocaleMessage('data_invalid', '데이터 형식이 올바르지 않습니다.'), 'error');
          return;
        }
        
        // 새 텍스트 추가
        savedTexts.push(newText);
      }
      
      // 업데이트된 목록 저장
      chrome.storage.local.set({ savedTexts }, () => {
        // 입력 필드 초기화
        resetForm();
        
        // 알림 표시 (기존 alert 대신 사용)
        showInAppNotification(
          isEditing ? getLocaleMessage('text_update_success', '텍스트가 수정되었습니다!') : getLocaleMessage('text_save_success', '텍스트가 저장되었습니다!'),
          'success'
        );
        
        // 성공적으로 저장된 후 임시 데이터 삭제
        localStorage.removeItem(TEMP_STORAGE_KEY);
        
        // 보기 탭으로 전환
        switchTab(viewTabBtn, viewTab);
      });
    });
  }
  
  // 저장 버튼 클릭 이벤트 리스너
  saveBtn.addEventListener('click', saveText);
  
  // 북마크 토글 함수
  function toggleBookmark(textId) {
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      const index = savedTexts.findIndex(text => text.id === textId);
      
      if (index !== -1) {
        savedTexts[index].isBookmarked = !savedTexts[index].isBookmarked;
        
        chrome.storage.local.set({ savedTexts }, () => {
          // 목록 다시 로드
          loadTextList(searchInput.value);
          // 북마크 탭일 경우 북마크 목록도 업데이트
          if (bookmarkTab.classList.contains('active')) {
            loadBookmarkList();
          }
          // 카운터 업데이트
          updateCounters();
        });
      }
    });
  }
  
  // 카운터 업데이트 함수
  function updateCounters() {
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      const bookmarkedTexts = savedTexts.filter(text => text.isBookmarked);
      
      textCounter.textContent = savedTexts.length;
      bookmarkCounter.textContent = bookmarkedTexts.length;
      
      // 북마크 목록이 비어있을 때 메시지 표시/숨김
      if (bookmarkedTexts.length === 0) {
        emptyBookmarkMessage.style.display = 'block';
      } else {
        emptyBookmarkMessage.style.display = 'none';
      }
    });
  }
  
  // 텍스트 목록 로드 함수
  function loadTextList(searchQuery = '') {
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      textList.textContent = '';
      
      const searchInTitle = searchTitle ? searchTitle.checked : true;
      const searchInContent = searchContent ? searchContent.checked : true;
      const searchInTags = searchTags ? searchTags.checked : true;
      
      let filteredTexts = savedTexts;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredTexts = savedTexts.filter(text => {
          if (searchInTitle && text.title && text.title.toLowerCase().includes(query)) return true;
          if (searchInContent && text.content && text.content.toLowerCase().includes(query)) return true;
          if (searchInTags && text.tags && text.tags.some(tag => tag.toLowerCase().includes(query))) return true;
          return false;
        });
      }
      
      filteredTexts.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      
      if (filteredTexts.length === 0) {
        const emptyMessage = searchQuery
          ? getLocaleMessage('view_empty_search', `"${searchQuery}" 검색 결과가 없습니다.`, [searchQuery])
          : getLocaleMessage('view_empty_texts', '저장된 텍스트가 없습니다.');
        
        const emptyStateDiv = document.createElement('div');
        emptyStateDiv.className = 'empty-state';
        const emptyIconDiv = document.createElement('div');
        emptyIconDiv.className = 'empty-icon';
        const icon = document.createElement('i');
        icon.className = 'fas fa-file-text';
        emptyIconDiv.appendChild(icon);
        const h4 = document.createElement('h4');
        h4.textContent = emptyMessage;
        const p = document.createElement('p');
        p.textContent = searchQuery
          ? getLocaleMessage('view_try_another', '다른 검색어를 시도해보세요.')
          : getLocaleMessage('view_save_prompt', '새로운 텍스트를 저장해보세요.');
        emptyStateDiv.appendChild(emptyIconDiv);
        emptyStateDiv.appendChild(h4);
        emptyStateDiv.appendChild(p);
        
        textList.appendChild(emptyStateDiv);
        updateCounters();
        return;
      }
      
      filteredTexts.forEach(text => {
        const textItem = createTextItem(text);
        textList.appendChild(textItem);
      });
      
      updateCounters();
    });
  }
  
  // 북마크 목록 로드 함수
  function loadBookmarkList() {
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      const bookmarkedTexts = savedTexts.filter(text => text.isBookmarked);
      
      bookmarkList.textContent = '';
      
      if (bookmarkedTexts.length === 0) {
        emptyBookmarkMessage.style.display = 'block';
        updateCounters();
        return;
      }
      
      emptyBookmarkMessage.style.display = 'none';
      bookmarkedTexts.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      
      bookmarkedTexts.forEach(text => {
        const textItem = createTextItem(text, true);
        bookmarkList.appendChild(textItem);
      });
    });
  }
  
  // 텍스트 수정 함수
  function editText(textId) {
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      const textToEdit = savedTexts.find(text => text.id === textId);
      
      if (textToEdit) {
        titleInput.value = textToEdit.title || '';
        textInput.value = textToEdit.content || '';
        tagInput.value = textToEdit.tags ? textToEdit.tags.join(', ') : '';
        editingId.value = textId;
        const btnText = saveBtn.querySelector('.btn-content span');
        if (btnText) btnText.textContent = getLocaleMessage('button_edit_mode', '수정하기');
        
        updateTagPreview();
        switchTab(saveTabBtn, saveTab);
      }
    });
  }
  
  // 클립보드에 복사 함수
  function copyToClipboard(text, textItem, titleElement = null) {
    navigator.clipboard.writeText(text).then(() => {
      const feedbackElement = textItem.querySelector('.copy-feedback');
      if (feedbackElement) {
        feedbackElement.textContent = getLocaleMessage('copied_feedback', '복사됨!');
        feedbackElement.style.display = 'inline';
        setTimeout(() => { feedbackElement.style.display = 'none'; }, 2000);
      }
      
      // 제목 더블클릭인 경우 제목 하이라이트 효과 추가
      if (titleElement) {
        highlightTitle(titleElement);
      }
    }).catch(err => {
      fallbackCopyToClipboard(text);
      showInAppNotification(getLocaleMessage('clipboard_failed', '클립보드 복사에 실패했습니다.'), 'error');
    });
  }
  
  // 제목 하이라이트 효과 함수
  function highlightTitle(titleElement) {
    if (!titleElement) return;
    
    // 하이라이트 클래스 추가
    titleElement.classList.add('title-copied');
    
    // 애니메이션 완료 후 클래스 제거
    setTimeout(() => {
      titleElement.classList.remove('title-copied');
    }, 600); // CSS 애니메이션 지속 시간과 맞춤
  }

  // 대체 복사 방법 (fallback)
  function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = 0;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showInAppNotification(getLocaleMessage('copy_success', '텍스트가 복사되었습니다!'), 'success');
    } catch (err) {
      showInAppNotification(getLocaleMessage('copy_failed', '복사에 실패했습니다.'), 'error');
    }
    document.body.removeChild(textarea);
  }
  
  // 텍스트 삭제 함수
  function deleteText(textId) {
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      const textToDelete = savedTexts.find(text => text.id === textId);
      if (!textToDelete) {
        showInAppNotification(getLocaleMessage('delete_missing', '삭제할 텍스트를 찾을 수 없습니다.'), 'error');
        return;
      }
      const updatedTexts = savedTexts.filter(text => text.id !== textId);
      chrome.storage.local.set({ savedTexts: updatedTexts }, () => {
        const displayTitle = textToDelete.title || getLocaleMessage('untitled_text', '제목 없음');
        showInAppNotification(
          getLocaleMessage('delete_success', `"${displayTitle}" 텍스트가 삭제되었습니다.`, [displayTitle]),
          'success'
        );
        if (viewTab.classList.contains('active')) {
          loadTextList(searchInput.value);
        }
        if (bookmarkTab.classList.contains('active')) {
          loadBookmarkList();
        }
        updateCounters();
      });
    });
  }
  
  // 검색 이벤트 리스너
  searchInput.addEventListener('input', () => loadTextList(searchInput.value));
  searchTitle.addEventListener('change', () => loadTextList(searchInput.value));
  searchContent.addEventListener('change', () => loadTextList(searchInput.value));
  searchTags.addEventListener('change', () => loadTextList(searchInput.value));
  
  // 내보내기 기능
  function exportData() {
    chrome.storage.local.get('savedTexts', (result) => {
      const savedTexts = result.savedTexts || [];
      if (savedTexts.length === 0) {
        showImportResult(getLocaleMessage('view_empty_texts', '저장된 텍스트가 없습니다.'), 'info');
        return;
      }
      const exportData = { version: '1.0', savedTexts: savedTexts, exportDate: new Date().toISOString() };
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `text-saver-export-${new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')}-${Math.random().toString(36).substring(2,6)}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showImportResult(getLocaleMessage('export_success', '데이터가 성공적으로 내보내졌습니다.'), 'success');
      }, 100);
    });
  }
  
  function showImportResult(message, type = 'info') {
    if (importResult) {
      importResult.textContent = message;
      importResult.className = `import-result ${type}`;
      importResult.style.display = 'block';
      setTimeout(() => { importResult.style.display = 'none'; }, 5000);
    }
    showInAppNotification(message, type);
  }

  function validateAndFilterImportData(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.savedTexts)) {
      return { valid: false, error: getLocaleMessage('import_invalid_json', '유효하지 않은 JSON 형식입니다.'), data: [], skipped: [] };
    }
    
    // 보안: 최대 항목 수 제한
    if (data.savedTexts.length > 1000) {
      return { valid: false, error: getLocaleMessage('import_security_limit', '보안상 최대 1000개 항목까지만 가져올 수 있습니다.'), data: [], skipped: [] };
    }
    
    const validItems = [];
    const invalidIndexes = [];
    data.savedTexts.forEach((text, idx) => {
      if (text && typeof text === 'object' && text.id && text.title && text.content && text.createdAt) {
        // 보안: 각 항목에 대해 sanitization 수행
        const sanitizedTitle = sanitizeTitle(text.title);
        const sanitizedContent = sanitizeText(text.content);

        if (!sanitizedTitle || !sanitizedContent) {
          invalidIndexes.push(idx + 1);
          return;
        }

        // 원본과 sanitized 버전이 크게 다르면 제외
        if (text.title.length - sanitizedTitle.length > 10 || 
            text.content.length - sanitizedContent.length > 50) {
          console.warn('보안상 위험한 항목이 필터링되었습니다:', text.title);
          invalidIndexes.push(idx + 1);
          return;
        }

        // 깨끗한 데이터로 복사
        const cleanText = {
          ...text,
          title: sanitizedTitle,
          content: sanitizedContent
        };
        
        // 태그 검증 및 sanitization
        if (text.tags && Array.isArray(text.tags)) {
          cleanText.tags = text.tags
            .filter(tag => typeof tag === 'string')
            .map(tag => sanitizeTags(tag))
            .filter(tag => tag.length > 0)
            .slice(0, 10); // 최대 10개 태그
        }

        if (!validateTextData(cleanText)) {
          invalidIndexes.push(idx + 1);
          return;
        }
        
        validItems.push(cleanText);
      } else {
        invalidIndexes.push(idx + 1);
      }
    });
    if (validItems.length === 0 && data.savedTexts.length > 0) {
      return { valid: false, error: getLocaleMessage('import_no_valid_items', '가져올 수 있는 유효한 텍스트 항목이 없습니다.'), data: [], skipped: invalidIndexes };
    }
    return { valid: true, data: validItems, skipped: invalidIndexes };
  }

  function showImportModeDialog(importedTexts, onModeSelected) {
    chrome.storage.local.get('savedTexts', (result) => {
      const existingTexts = result.savedTexts || [];
      if (existingTexts.length === 0) {
        onModeSelected('replace', importedTexts);
        return;
      }
      const message = getLocaleMessage(
        'import_dialog_message',
        `기존에 ${existingTexts.length}개의 텍스트가 저장되어 있습니다. 가져온 ${importedTexts.length}개의 텍스트를 어떻게 처리할까요?\n확인: 기존 데이터에 추가 | 취소: 가져오기를 취소`,
        [existingTexts.length, importedTexts.length]
      );
      if (confirm(message)) {
        onModeSelected('merge', importedTexts);
      } else {
        showImportResult(getLocaleMessage('import_cancelled', '가져오기를 취소했습니다.'), 'info');
      }
    });
  }

  function importData(file) {
    if (!file) {
      showImportResult(getLocaleMessage('import_no_file', '파일이 선택되지 않았습니다.'), 'error');
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showImportResult(getLocaleMessage('import_file_too_large', '파일 크기가 너무 큽니다. (최대 10MB)'), 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        const validation = validateAndFilterImportData(importedData);
        if (!validation.valid) {
          showImportResult(
            getLocaleMessage('import_failed_prefix', `가져오기 실패: ${validation.error}`, [validation.error]),
            'error'
          );
          return;
        }
        const importedTexts = validation.data;
        const skippedIndexes = validation.skipped;
        if (importedTexts.length === 0) {
          const emptyMessage = skippedIndexes.length > 0
            ? getLocaleMessage('import_missing_fields', '모든 항목에 필수 필드가 누락되어 가져오지 못했습니다.')
            : getLocaleMessage('import_no_records', '가져올 데이터가 없습니다.');
          showImportResult(emptyMessage, 'info');
          return;
        }
        showImportModeDialog(importedTexts, (mode, texts) => {
          if (mode === 'merge') {
            chrome.storage.local.get('savedTexts', (result) => {
              const existingTexts = result.savedTexts || [];
              const mergedTexts = [...existingTexts, ...texts];
              chrome.storage.local.set({ savedTexts: mergedTexts }, () => {
                showImportResult(getLocaleMessage('import_add_success', `${texts.length}개의 텍스트를 추가했습니다.`, [texts.length]), 'success');
                loadTextList();
                if (bookmarkTab.classList.contains('active')) loadBookmarkList();
                updateCounters();
              });
            });
          } else {
            chrome.storage.local.set({ savedTexts: texts }, () => {
              showImportResult(getLocaleMessage('import_replace_success', `${texts.length}개의 텍스트로 대체했습니다.`, [texts.length]), 'success');
              loadTextList();
              if (bookmarkTab.classList.contains('active')) loadBookmarkList();
              updateCounters();
            });
          }
        });
      } catch (error) {
        showImportResult(getLocaleMessage('import_invalid_json', 'JSON 파일 형식이 올바르지 않습니다.'), 'error');
      }
    };
    reader.onerror = () => showImportResult(getLocaleMessage('import_file_read_error', '파일을 읽는 중 오류가 발생했습니다.'), 'error');
    reader.readAsText(file, 'UTF-8');
  }

  function restorePresetData() {
    const confirmed = confirm(
      getLocaleMessage('preset_restore_confirm', '기본 프롬프트 5개를 다시 불러옵니다. 기존 동일 템플릿은 덮어써집니다. 진행하시겠습니까?')
    );
    if (!confirmed) {
      showInAppNotification(getLocaleMessage('preset_restore_cancelled', '기본 프롬프트 복원이 취소되었습니다.'), 'info');
      return;
    }

    chrome.runtime.sendMessage({ action: 'restorePresets' }, (response) => {
      if (chrome.runtime.lastError) {
        showInAppNotification(getLocaleMessage('preset_restore_failed', '프롬프트 복원에 실패했습니다. 다시 시도해주세요.'), 'error');
        return;
      }

      if (!response || response.error) {
        showInAppNotification(
          response?.error || getLocaleMessage('preset_restore_generic_error', '프롬프트 복원 중 오류가 발생했습니다.'),
          'error'
        );
        return;
      }

      const added = response.added ?? 0;
      const updated = response.updated ?? 0;
      showInAppNotification(
        getLocaleMessage('preset_restore_summary', `기본 프롬프트 복원 완료 (추가 ${added}개 · 갱신 ${updated}개)`, [added, updated]),
        'success'
      );
      loadTextList(searchInput.value);
      if (bookmarkTab.classList.contains('active')) {
        loadBookmarkList();
      }
      updateCounters();
    });
  }
  
  function resetAllData() {
    showInAppNotification(getLocaleMessage('reset_confirm_toast', '정말로 모든 데이터를 초기화하시겠습니까?'), 'error', 10000);
    const userConfirmed = confirm(getLocaleMessage('reset_confirm_dialog', '[주의] 정말로 모든 데이터를 영구적으로 삭제하시겠습니까?'));
    if (userConfirmed) {
      chrome.storage.local.set({ savedTexts: [] }, () => {
        showInAppNotification(getLocaleMessage('reset_done', '모든 데이터가 초기화되었습니다.'), 'success');
        resetForm();
        loadTextList();
        loadBookmarkList();
        updateCounters();
      });
    } else {
      showInAppNotification(getLocaleMessage('reset_cancelled', '데이터 초기화가 취소되었습니다.'), 'info');
    }
  }
  
  exportBtn.addEventListener('click', exportData);
  importBrowseBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isJsonFile = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (!isJsonFile) {
      showImportResult(getLocaleMessage('import_only_json', 'JSON 파일만 가져올 수 있습니다.'), 'error');
      importInput.value = '';
      return;
    }
    showImportResult(getLocaleMessage('import_in_progress', '파일을 가져오는 중입니다...'), 'info');
    importData(file);
    importInput.value = '';
  });

  if (restorePresetsBtn) {
    restorePresetsBtn.addEventListener('click', restorePresetData);
  }
  resetDataBtn.addEventListener('click', resetAllData);
  
  loadTextList();
  updateCounters();

  [textList, bookmarkList].forEach(list => {
    list.addEventListener('click', (e) => {
      const textItem = e.target.closest('.text-item');
      if (!textItem) return;

      const textId = textItem.dataset.id;
      const contentWrapper = textItem.querySelector('.content-wrapper');

      if (e.target.closest('.bookmark-btn')) {
        toggleBookmark(textId);
        e.stopPropagation();
        return;
      }
      
      if (e.target.closest('.copy-btn')) {
        const textToCopy = textItem.querySelector('.text-content p').textContent;
        copyToClipboard(textToCopy, textItem);
        e.stopPropagation();
        return;
      }
      
      if (e.target.closest('.edit-btn')) {
        editText(textId);
        e.stopPropagation();
        return;
      }

      if (e.target.closest('.delete-btn')) {
        const actionGroup = textItem.querySelector('.action-buttons-group');
        const confirmGroup = textItem.querySelector('.delete-confirm-group');
        if (actionGroup && confirmGroup) {
          actionGroup.style.display = 'none';
          confirmGroup.style.display = 'flex';
        }
        e.stopPropagation();
        return;
      }
      
      if (e.target.closest('.confirm-yes-btn')) {
        deleteText(textId);
        e.stopPropagation();
        return;
      }
      
      if (e.target.closest('.confirm-no-btn')) {
        const actionGroup = textItem.querySelector('.action-buttons-group');
        const confirmGroup = textItem.querySelector('.delete-confirm-group');
        if (actionGroup && confirmGroup) {
          actionGroup.style.display = 'flex';
          confirmGroup.style.display = 'none';
        }
        e.stopPropagation();
        return;
      }

      // 버튼이 아닌 영역을 클릭했을 때 내용 펼치기/접기
      if (contentWrapper && !e.target.closest('.item-btn')) {
        const isExpanded = textItem.classList.toggle('expanded');
        // 애니메이션을 위해 max-height를 동적으로 조절
        if (isExpanded) {
          // 펼칠 때: 실제 스크롤 높이만큼 설정
          contentWrapper.style.maxHeight = `${contentWrapper.scrollHeight}px`;
        } else {
          // 접을 때: CSS에 정의된 초기값으로 (또는 0으로)
          contentWrapper.style.maxHeight = null; // CSS의 기본값으로 돌아가게 함
        }
      }
    });
  });

  function createTextItem(text, isBookmarkView = false) {
    const textItem = document.createElement('div');
    textItem.className = 'text-item';
    textItem.dataset.id = text.id;
  
    // Header
    const headerElement = document.createElement('div');
    headerElement.className = 'text-header';
    const titleElement = document.createElement('h3');
    titleElement.className = 'text-title';
    titleElement.textContent = text.title;
    
    // 제목 더블클릭으로 복사 기능 추가
    titleElement.addEventListener('dblclick', (e) => {
      e.stopPropagation(); // 기존 클릭 이벤트 전파 방지
      const textToCopy = text.content || '';
      if (textToCopy) {
        copyToClipboard(textToCopy, textItem, titleElement);
      }
    });
    
    // 제목에 호버 시 힌트 표시
    titleElement.title = getLocaleMessage('copy_hint', '더블클릭하여 복사');
    
    const dateElement = document.createElement('span');
    dateElement.className = 'text-date';
    dateElement.textContent = formatDate(text.createdAt);
    headerElement.appendChild(titleElement);
    headerElement.appendChild(dateElement);
  
    // Content (펼치기/접기 대상)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    const contentElement = document.createElement('div');
    contentElement.className = 'text-content';
    const contentParagraph = document.createElement('p');
    contentParagraph.textContent = text.content;
    contentElement.appendChild(contentParagraph);
    contentWrapper.appendChild(contentElement);
    
    // 항상 보이는 정보 (태그, 출처)
    const infoContainer = document.createElement('div');
    infoContainer.className = 'info-container';

    // Tags
    const tagsElement = document.createElement('div');
    tagsElement.className = 'text-tags';
    if (text.tags && text.tags.length > 0) {
      text.tags.forEach(tagText => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        tagElement.textContent = tagText;
        tagsElement.appendChild(tagElement);
      });
    }
    infoContainer.appendChild(tagsElement);
  
    // Source URL
    if (text.sourceURL) {
      const sourceElement = document.createElement('div');
      sourceElement.className = 'text-source';
      const sourceLink = document.createElement('a');
      sourceLink.href = text.sourceURL;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';

      const linkIcon = document.createElement('i');
      linkIcon.className = 'fas fa-link';
      sourceLink.appendChild(linkIcon);
      sourceLink.appendChild(document.createTextNode(` ${text.metadata?.pageTitle || text.sourceURL}`));
      
      sourceElement.appendChild(sourceLink);
      infoContainer.appendChild(sourceElement);
    }
  
    // Actions
    const actionsElement = document.createElement('div');
    actionsElement.className = 'text-actions';
  
    // Bookmark Button
    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'item-btn bookmark-btn';
    // 보안: Font Awesome 대신 유니코드 문자 사용
    bookmarkBtn.textContent = text.isBookmarked ? '★' : '☆';
    bookmarkBtn.setAttribute('aria-label', text.isBookmarked ? getLocaleMessage('bookmark_remove', '북마크 해제') : getLocaleMessage('bookmark_add', '북마크'));
    bookmarkBtn.title = text.isBookmarked ? getLocaleMessage('bookmark_remove', '북마크 해제') : getLocaleMessage('bookmark_add', '북마크');
  
    // Action Buttons Group
    const actionButtonsGroup = document.createElement('div');
    actionButtonsGroup.className = 'action-buttons-group';
  
    // Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'item-btn copy-btn';
    // 보안: Font Awesome 대신 유니코드 문자 사용
    copyBtn.textContent = getLocaleMessage('button_copy_label', '📋 복사');
    copyBtn.setAttribute('aria-label', getLocaleMessage('button_copy_title', '텍스트 복사'));
    copyBtn.title = getLocaleMessage('button_copy_title', '텍스트 복사');
  
    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'item-btn edit-btn';
    // 보안: Font Awesome 대신 유니코드 문자 사용
    editBtn.textContent = getLocaleMessage('button_edit_label', '✏️ 수정');
    editBtn.setAttribute('aria-label', getLocaleMessage('button_edit_title', '텍스트 수정'));
    editBtn.title = getLocaleMessage('button_edit_title', '텍스트 수정');
  
    // Delete Button (Toggles confirm UI)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'item-btn delete-btn';
    // 보안: Font Awesome 대신 유니코드 문자 사용
    deleteBtn.textContent = getLocaleMessage('button_delete_label', '🗑️ 삭제');
    deleteBtn.setAttribute('aria-label', getLocaleMessage('button_delete_title', '텍스트 삭제'));
    deleteBtn.title = getLocaleMessage('button_delete_title', '텍스트 삭제');
  
    // Copy Feedback Message
    const copyFeedback = document.createElement('span');
    copyFeedback.className = 'copy-feedback';
    copyFeedback.textContent = getLocaleMessage('copied_feedback', '복사됨!');
    copyFeedback.style.display = 'none';
  
    // Delete Confirmation UI
    const deleteConfirmGroup = document.createElement('div');
    deleteConfirmGroup.className = 'delete-confirm-group';
    deleteConfirmGroup.style.display = 'none';
  
    const confirmText = document.createElement('span');
    confirmText.className = 'delete-confirm-text';
    confirmText.textContent = getLocaleMessage('confirm_delete_prompt', '정말 삭제할까요?');
  
    const confirmYesBtn = document.createElement('button');
    confirmYesBtn.className = 'item-btn confirm-yes-btn';
    confirmYesBtn.textContent = getLocaleMessage('confirm_yes', '예');
  
    const confirmNoBtn = document.createElement('button');
    confirmNoBtn.className = 'item-btn confirm-no-btn';
    confirmNoBtn.textContent = getLocaleMessage('confirm_no', '아니요');
  
    deleteConfirmGroup.appendChild(confirmText);
    deleteConfirmGroup.appendChild(confirmYesBtn);
    deleteConfirmGroup.appendChild(confirmNoBtn);
  
    // Assemble Action Buttons
    actionButtonsGroup.appendChild(copyBtn);
    actionButtonsGroup.appendChild(editBtn);
    actionButtonsGroup.appendChild(deleteBtn);
    actionButtonsGroup.appendChild(copyFeedback);
  
    // Assemble Actions Element
    actionsElement.appendChild(bookmarkBtn);
    actionsElement.appendChild(actionButtonsGroup);
    actionsElement.appendChild(deleteConfirmGroup);
  
    // Assemble Text Item
    textItem.appendChild(headerElement);
    textItem.appendChild(contentWrapper);
    textItem.appendChild(infoContainer);
    textItem.appendChild(actionsElement);
  
    // 호버 시 동적 미리보기 높이 설정
    setupHoverPreview(textItem, contentWrapper);
  
    return textItem;
  }
  
  // 호버 시 내용 미리보기 설정 함수
  function setupHoverPreview(textItem, contentWrapper) {
    // 호버 시작 시
    textItem.addEventListener('mouseenter', () => {
      // 이미 펼쳐진 상태면 무시
      if (textItem.classList.contains('expanded')) return;
      
      // 실제 내용 높이 계산 (DOM에 추가된 후에만 정확함)
      requestAnimationFrame(() => {
        const scrollHeight = contentWrapper.scrollHeight;
        const computedStyle = getComputedStyle(contentWrapper);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 1.5 * 0.85 * 16; // 기본 line-height
        const minPreviewHeight = 4.5 * lineHeight; // 기본 높이 (4.5em)
        const maxPreviewHeight = Math.min(scrollHeight + 10, 15 * lineHeight); // 최대 15줄, 여유 공간 추가
        
        // 실제 내용이 기본 높이보다 크면 동적으로 설정
        if (scrollHeight > minPreviewHeight) {
          contentWrapper.style.maxHeight = `${maxPreviewHeight}px`;
        }
      });
    });
    
    // 호버 종료 시 원래대로
    textItem.addEventListener('mouseleave', () => {
      if (!textItem.classList.contains('expanded')) {
        contentWrapper.style.maxHeight = ''; // CSS 기본값으로 복원
      }
    });
  }

  // 초기 로드 시 보기 탭 활성화
  switchTab(viewTabBtn, viewTab);
});

function startAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(() => {
    if (document.getElementById('titleInput').value.trim() || document.getElementById('textInput').value.trim() || document.getElementById('tagInput').value.trim()) {
      saveTempData();
    }
  }, AUTO_SAVE_INTERVAL);
  window.addEventListener('beforeunload', saveTempData);
}

function saveTempData() {
  const tempData = {
    title: document.getElementById('titleInput').value,
    content: document.getElementById('textInput').value,
    tags: document.getElementById('tagInput').value,
    editingId: document.getElementById('editingId').value,
    lastUpdated: new Date().toISOString()
  };
  localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(tempData));
  updateAutoSaveStatus('저장됨');
}

function restoreTempData() {
  const tempDataJson = localStorage.getItem(TEMP_STORAGE_KEY);
  if (tempDataJson) {
    try {
      const tempData = JSON.parse(tempDataJson);
      const lastUpdated = new Date(tempData.lastUpdated);
      const now = new Date();
      if ((now - lastUpdated) / (1000 * 60 * 60) < 24) {
        document.getElementById('titleInput').value = tempData.title || '';
        document.getElementById('textInput').value = tempData.content || '';
        document.getElementById('tagInput').value = tempData.tags || '';
        document.getElementById('editingId').value = tempData.editingId || '';
        updateTagPreview();
        if (tempData.editingId) {
          const btnText = document.getElementById('saveBtn').querySelector('.btn-content span');
          if (btnText) btnText.textContent = '수정하기';
        }
        updateAutoSaveStatus('복원됨', 3000);
      } else {
        localStorage.removeItem(TEMP_STORAGE_KEY);
      }
    } catch (error) {
      localStorage.removeItem(TEMP_STORAGE_KEY);
    }
  }
}

function updateAutoSaveStatus(status, duration = 2000) {
  const statusEl = document.querySelector('.auto-save-status');
  if (!statusEl) return;
  const statusDot = statusEl.querySelector('.status-dot');
  const statusText = statusEl.querySelector('.status-text');
  const savedLabel = getLocaleMessage('auto_save_saved', '저장됨');
  const restoredLabel = getLocaleMessage('auto_save_restored', '복원됨');
  const prefix = getLocaleMessage('auto_label', '자동');
  let localizedStatus = status;
  if (status === '저장됨') localizedStatus = savedLabel;
  if (status === '복원됨') localizedStatus = restoredLabel;
  statusText.textContent = `${prefix} ${localizedStatus}`;
  statusDot.className = `status-dot ${status === '저장됨' ? 'saved' : (status === '복원됨' ? 'restored' : '')}`;
  
  if (duration) {
    setTimeout(() => {
      statusText.textContent = getLocaleMessage('auto_save_ready', '자동 저장 준비됨');
      statusDot.className = 'status-dot';
    }, duration);
  }
}

// Auto-complete toggle 관련 함수들
function initAutoCompleteToggle() {
  if (!autoCompleteToggle || !featureStatusText) return;
  
  // 초기 상태 로드
  chrome.storage.sync.get(['autoCompleteEnabled'], (result) => {
    const enabled = result.autoCompleteEnabled !== false; // 기본값: true
    autoCompleteToggle.checked = enabled;
    updateFeatureStatus(enabled);
  });
  
  // 토글 변경 이벤트 리스너
  autoCompleteToggle.addEventListener('change', function() {
    const enabled = this.checked;
    
    // 즉시 현재 탭에 메시지 전송 (Message Passing)
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleAutoComplete',
          enabled: enabled
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not ready:', chrome.runtime.lastError.message);
          } else {
            console.log('Toggle message sent successfully:', response);
          }
        });
      }
    });
    
    // Storage에 저장
    chrome.storage.sync.set({autoCompleteEnabled: enabled});
    
    // UI 상태 업데이트
    updateFeatureStatus(enabled);
    
    // 🎯 Background Script에 아이콘 업데이트 메시지 전송 (임시 뱃지 표시 요청)
    chrome.runtime.sendMessage({
      action: 'updateIcon',
      enabled: enabled,
      showTemporary: true
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Background script message failed:', chrome.runtime.lastError.message);
      } else {
        console.log('Icon update message sent:', response);
      }
    });
    
    // 시각적 피드백
    showInAppNotification(
      enabled
        ? getLocaleMessage('toggle_enabled_toast', '//' + ' 자동완성 기능이 활성화되었습니다')
        : getLocaleMessage('toggle_disabled_toast', '//' + ' 자동완성 기능이 비활성화되었습니다'),
      enabled ? 'success' : 'info'
    );
  });
}

function updateFeatureStatus(enabled) {
  if (!featureStatusText) return;
  const prefix = getLocaleMessage('feature_status_prefix', '기능 상태:');
  const enabledLabel = getLocaleMessage('feature_status_enabled', '활성화됨');
  const disabledLabel = getLocaleMessage('feature_status_disabled', '비활성화됨');
  featureStatusText.textContent = `${prefix} ${enabled ? enabledLabel : disabledLabel}`;
  featureStatusText.style.color = enabled ? '#4CAF50' : '#f44336';
}
