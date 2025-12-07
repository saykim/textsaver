importScripts('utils.js');

const PRESET_PROMPTS = [
  {
    title: 'CoT (Chain-of-Thought) 분석 템플릿',
    tags: ['CoT', '분석', '템플릿'],
    content: `# CoT (Chain-of-Thought) 추론 프롬프트\n\n## 역할 정의\n당신은 논리적이고 체계적인 사고를 하는 전문 분석가입니다.\n\n## 과제\n다음 문제를 단계별로 분해하여 논리적으로 해결해 주세요.\n\n## 문제\n[여기에 해결하고자 하는 문제나 질문을 입력하세요]\n\n## 분석 방법\n1단계: 문제 이해\n- 핵심 요소들을 명확히 파악\n- 주어진 조건과 제약사항 정리\n\n2단계: 접근 방법 계획\n- 문제 해결을 위한 논리적 순서 수립\n- 각 단계에서 필요한 정보 식별\n\n3단계: 단계별 실행\n- 각 단계를 순차적으로 수행\n- 중간 결과를 명시하며 진행\n\n4단계: 검증 및 결론\n- 각 단계의 논리적 타당성 확인\n- 최종 답안에 대한 근거 제시\n\n## 출력 형식\n**1단계: 문제 이해**\n[문제 분석 내용]\n\n**2단계: 접근 방법**\n[해결 계획]\n\n**3단계: 단계별 해결**\n[각 단계별 상세 과정]\n\n**4단계: 최종 답안**\n[결론과 근거]\n\n이제 위의 단계를 따라 차근차근 해결해 주세요.`
  },
  {
    title: 'ToT (Tree-of-Thought) 전략 템플릿',
    tags: ['ToT', '전략', '아이디어'],
    content: `# ToT (Tree-of-Thought) 프롬프트\n\n## 역할 정의\n당신은 다양한 접근 방식을 체계적으로 탐색하는 전략적 사고 전문가입니다.\n\n## 문제\n[해결하고자 하는 문제를 명시하세요]\n\n## 탐색 과정\n\n### 1단계: 초기 접근 방법 생성\n가능한 3-5가지 서로 다른 접근 방법을 제시하세요.\n\n**방법 A**: [첫 번째 접근법]\n**방법 B**: [두 번째 접근법]\n**방법 C**: [세 번째 접근법]\n**방법 D**: [네 번째 접근법] (선택사항)\n**방법 E**: [다섯 번째 접근법] (선택사항)\n\n### 2단계: 각 방법 평가\n각 방법에 대해 다음 기준으로 평가하세요:\n- 실현 가능성 (1-10점)\n- 효과성 (1-10점)\n- 자원 소요 (1-10점)\n- 리스크 수준 (1-10점)\n\n**방법 A 평가**:\n- 실현 가능성: [점수] - [이유]\n- 효과성: [점수] - [이유]\n- 자원 소요: [점수] - [이유]\n- 리스크: [점수] - [이유]\n\n[각 방법에 대해 동일하게 평가]\n\n### 3단계: 상위 2-3개 방법 심화 분석\n점수가 높은 방법들에 대해 세부 실행 계획을 수립하세요.\n\n**[선택된 방법] 세부 계획**:\n1. [구체적 단계 1]\n2. [구체적 단계 2]\n3. [구체적 단계 3]\n...\n\n### 4단계: 최종 권장안\n모든 분석을 종합하여 최적의 방법을 선택하고 그 이유를 설명하세요.\n\n**최종 선택**: [선택된 방법]\n**선택 이유**: [상세한 근거]\n**실행 로드맵**: [단계별 실행 계획]\n\n이제 위의 과정을 따라 체계적으로 분석해 주세요.`
  },
  {
    title: 'ReAct (Reason+Act) 실행 템플릿',
    tags: ['ReAct', '추론', '행동'],
    content: `# ReAct (Reason + Act) 프롬프트\n\n## 시스템 역할\n당신은 문제를 해결하기 위해 추론과 행동을 반복하는 지능형 에이전트입니다.\n\n## 과제\n[여기에 해결하고자 하는 문제를 입력하세요]\n\n## 작업 방식\n다음 패턴을 반복하여 문제를 해결하세요:\n\n### 생각 (Thought)\n현재 상황을 분석하고 다음에 무엇을 해야 할지 추론합니다.\n\n### 행동 (Action)\n구체적인 행동을 수행합니다. 다음 중 하나를 선택:\n- 검색: [검색어] - 정보를 찾습니다\n- 계산: [수식] - 계산을 수행합니다\n- 분석: [대상] - 주어진 정보를 분석합니다\n- 확인: [내용] - 결과를 검증합니다\n\n### 관찰 (Observation)\n행동의 결과를 관찰하고 기록합니다.\n\n## 진행 예시\n**생각 1**: 이 문제를 해결하려면 먼저 최신 정보가 필요합니다.\n**행동 1**: 검색: [관련 검색어]\n**관찰 1**: [검색 결과 요약]\n\n**생각 2**: 검색 결과를 바탕으로 다음 단계를 계획합니다.\n**행동 2**: 분석: [검색된 정보]\n**관찰 2**: [분석 결과]\n\n## 최종 답안\n모든 추론과 행동을 완료한 후 최종 결론을 제시합니다.\n\n지금 시작하세요:`
  },
  {
    title: 'SCAMPER 창의성 템플릿',
    tags: ['SCAMPER', '아이디어', '창의성'],
    content: `# SCAMPER 창의적 사고 프롬프트\n\n## 역할 정의\n당신은 기존의 것을 새로운 관점에서 바라보며 혁신적 아이디어를 창출하는 창의성 전문가입니다.\n\n## 개선 대상\n[개선하고자 하는 제품/서비스/프로세스를 명시하세요]\n\n## SCAMPER 기법 적용\n\n### S - Substitute (대체하기)\n**질문**: 무엇을 다른 것으로 대체할 수 있을까?\n\n**분석 영역**:\n- 재료나 구성요소: [현재 사용되는 것들]\n- 사람이나 역할: [관련된 인력]\n- 장소나 환경: [진행되는 공간]\n- 프로세스나 방법: [현재 방식]\n\n**대체 아이디어**:\n1. [대체 아이디어 1]: [설명과 기대 효과]\n2. [대체 아이디어 2]: [설명과 기대 효과]\n3. [대체 아이디어 3]: [설명과 기대 효과]\n\n### C - Combine (결합하기)\n**질문**: 어떤 것들을 결합하거나 통합할 수 있을까?\n\n**결합 가능한 요소들**:\n- 기능이나 특성: [현재 분리된 기능들]\n- 다른 제품/서비스: [연관될 수 있는 것들]\n- 아이디어나 컨셉: [관련 개념들]\n\n**결합 아이디어**:\n1. [결합 아이디어 1]: [무엇과 무엇을 결합 + 효과]\n2. [결합 아이디어 2]: [무엇과 무엇을 결합 + 효과]\n3. [결합 아이디어 3]: [무엇과 무엇을 결합 + 효과]\n\n### A - Adapt (적응시키기)\n**질문**: 다른 분야의 아이디어를 어떻게 적용할 수 있을까?\n\n**참조 가능한 분야**:\n- 자연계의 해법: [생물학적 메커니즘]\n- 다른 산업의 사례: [타 업계의 성공 사례]\n- 과거의 솔루션: [역사적 해결책]\n\n**적응 아이디어**:\n1. [적응 아이디어 1]: [어디서 가져온 아이디어 + 적용 방법]\n2. [적응 아이디어 2]: [어디서 가져온 아이디어 + 적용 방법]\n3. [적응 아이디어 3]: [어디서 가져온 아이디어 + 적용 방법]\n\n### M - Modify/Magnify/Minify (수정/확대/축소하기)\n**질문**: 무엇을 더 크게, 작게, 또는 다르게 만들 수 있을까?\n\n**Magnify (확대)**:\n- [확대할 요소 1]: [어떻게 확대 + 기대 효과]\n- [확대할 요소 2]: [어떻게 확대 + 기대 효과]\n\n**Minify (축소/간소화)**:\n- [축소할 요소 1]: [어떻게 축소 + 기대 효과]\n- [축소할 요소 2]: [어떻게 축소 + 기대 효과]\n\n**Modify (수정)**:\n- [수정할 특성 1]: [어떻게 바꿀 것 + 이유]\n- [수정할 특성 2]: [어떻게 바꿀 것 + 이유]\n\n### P - Put to Other Use (다른 용도로 사용하기)\n**질문**: 이것을 어떤 다른 용도로 사용할 수 있을까?\n\n**새로운 용도 아이디어**:\n1. [새 용도 1]: [구체적 사용법과 대상]\n2. [새 용도 2]: [구체적 사용법과 대상]\n3. [새 용도 3]: [구체적 사용법과 대상]\n\n**타겟 시장 확장**:\n- [새로운 고객군 1]: [어떻게 활용할 것인가]\n- [새로운 고객군 2]: [어떻게 활용할 것인가]\n\n### E - Eliminate (제거하기)\n**질문**: 무엇을 제거하거나 단순화할 수 있을까?\n\n**제거 후보들**:\n- 불필요한 단계: [현재 프로세스의 비효율적 부분]\n- 과도한 기능: [실제로 잘 사용되지 않는 기능]\n- 복잡한 요소: [이해를 어렵게 하는 부분]\n\n**제거 아이디어**:\n1. [제거 대상 1]: [제거 이유 + 예상 효과]\n2. [제거 대상 2]: [제거 이유 + 예상 효과]\n3. [제거 대상 3]: [제거 이유 + 예상 효과]\n\n### R - Reverse/Rearrange (역순/재배열하기)\n**질문**: 순서를 바꾸거나 역순으로 하면 어떨까?\n\n**재배열 아이디어**:\n- 프로세스 순서 변경: [현재 순서 → 새로운 순서]\n- 역할 재배치: [기존 역할 분담 → 새로운 분담]\n- 위치나 레이아웃 변경: [현재 배치 → 새로운 배치]\n\n**역순 사고**:\n- [현재 방식의 반대]: [정반대로 접근했을 때의 가능성]\n- [고정관념의 뒤집기]: [당연하다고 생각하는 것의 반대]\n\n## 종합 및 선별\n\n### 가장 혁신적인 아이디어 TOP 3\n1. **[아이디어 제목]**: [SCAMPER 기법] - [간단한 설명]\n   - 혁신도: [1-10점]\n   - 실현가능성: [1-10점]\n   - 기대효과: [구체적 효과]\n\n2. **[아이디어 제목]**: [SCAMPER 기법] - [간단한 설명]\n   - 혁신도: [1-10점]\n   - 실현가능성: [1-10점]\n   - 기대효과: [구체적 효과]\n\n3. **[아이디어 제목]**: [SCAMPER 기법] - [간단한 설명]\n   - 혁신도: [1-10점]\n   - 실현가능성: [1-10점]\n   - 기대효과: [구체적 효과]\n\n### 실행 계획\n**우선 추진 아이디어**: [선택된 아이디어]\n**첫 번째 단계**: [당장 시작할 수 있는 것]\n**필요한 자원**: [인력, 예산, 시간 등]\n\n이제 SCAMPER 기법을 활용하여 창의적으로 사고해 보세요!`
  },
  {
    title: 'PCIO 문제분석 템플릿',
    tags: ['PCIO', '문제정의', '전략'],
    content: `# PCIO Framework 분석 프롬프트\n\n## 역할 정의\n당신은 체계적이고 근본적인 문제 분석을 수행하는 전략 컨설턴트입니다.\n\n## 분석 대상\n[분석하고자 하는 문제나 상황을 명시하세요]\n\n## PCIO 분석 프레임워크\n\n### P - Problem (문제 정의)\n**1. 현재 상황 분석**\n- 관찰되는 현상: [구체적 상황 기술]\n- 이해관계자: [영향받는 주체들]\n- 영향 범위: [문제의 파급효과]\n\n**2. 문제의 구체화**\n- 핵심 문제: [가장 중요한 문제점]\n- 부차적 문제들: [관련된 하위 문제들]\n- 문제의 긴급도: [1-10점 평가]\n\n### C - Context (맥락 분석)\n**1. 배경 상황**\n- 역사적 배경: [문제 발생 배경]\n- 현재 환경: [주변 상황과 조건]\n- 제약 조건: [해결을 제한하는 요소들]\n\n**2. 시스템적 요인**\n- 구조적 요인: [시스템/조직 차원의 원인]\n- 프로세스 요인: [절차나 방법의 문제]\n- 문화적 요인: [인식이나 관습의 영향]\n\n### I - Insight (통찰 도출)\n**1. 근본 원인 분석**\n- 표면적 원인: [겉으로 드러나는 원인]\n- 심층적 원인: [근본적인 원인]\n- 원인간 관계: [원인들의 상호작용]\n\n**2. 패턴 인식**\n- 반복되는 패턴: [유사한 문제의 패턴]\n- 예외적 사례: [다르게 해결된 경우]\n- 핵심 통찰: [가장 중요한 발견]\n\n### O - Opportunity (기회 식별)\n**1. 단기 기회**\n- 즉시 개선 가능한 영역: [빠른 효과를 볼 수 있는 부분]\n- 필요한 자원: [인력, 예산, 시간 등]\n- 예상 효과: [기대되는 결과]\n\n**2. 장기 기회**\n- 구조적 개선 기회: [시스템 차원의 변화]\n- 혁신적 접근법: [새로운 해결 방식]\n- 전략적 가치: [장기적 경쟁 우위]\n\n## 종합 결론\n**핵심 메시지**: [분석의 핵심 결론]\n**우선순위**: [가장 먼저 해결해야 할 것]\n**실행 계획**: [구체적인 다음 단계]\n\n이제 위의 PCIO 프레임워크를 활용하여 체계적으로 분석해 주세요.`
  }
];

function buildPresetTexts() {
  const now = Date.now();
  return PRESET_PROMPTS.map((item, idx) => ({
    id: `preset-${now}-${idx}`,
    title: item.title,
    content: item.content,
    tags: item.tags,
    createdAt: new Date(now + idx).toISOString(),
    updatedAt: new Date(now + idx).toISOString(),
    isBookmarked: idx < 2, // 자주 쓰는 템플릿을 기본 북마크
    metadata: {
      source: 'preset',
      createdBy: 'extension',
      presetKey: item.tags[0]
    }
  }));
}

function restorePresetTexts(sendResponse) {
  chrome.storage.local.get('savedTexts', (result) => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: chrome.runtime.lastError.message });
      return;
    }

    const existingTexts = Array.isArray(result.savedTexts) ? [...result.savedTexts] : [];
    const presets = buildPresetTexts();
    let added = 0;
    let updated = 0;

    presets.forEach((preset) => {
      const presetKey = preset.metadata?.presetKey;
      if (!presetKey) {
        return;
      }

      const existingIndex = existingTexts.findIndex((item) => item?.metadata?.presetKey === presetKey);
      if (existingIndex >= 0) {
        const preservedId = existingTexts[existingIndex]?.id || preset.id;
        existingTexts[existingIndex] = {
          ...preset,
          id: preservedId
        };
        updated += 1;
      } else {
        existingTexts.push(preset);
        added += 1;
      }
    });

    chrome.storage.local.set({ savedTexts: existingTexts }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ success: true, added, updated });
    });
  });
}

// 확장 프로그램이 설치될 때 초기 데이터 설정 및 단일 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
  
  // 컨텍스트 메뉴를 생성하기 전에 기존의 모든 메뉴 항목을 제거합니다.
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error("Error removing context menus: ", chrome.runtime.lastError.message);
    }
    // 단일 컨텍스트 메뉴 생성
    chrome.contextMenus.create({
      id: "saveSelectedTextWithUrlAndAutoTags",
      title: "선택 내용 저장",
      contexts: ["selection"]
    });
    
    // 사이드 패널 열기 메뉴 추가
    chrome.contextMenus.create({
      id: "openSidePanel",
      title: "사이드 패널 열기",
      contexts: ["all"]
    });
    
  });

  // 저장된 텍스트 목록이 없으면 프리셋 텍스트 초기화
  chrome.storage.local.get(['savedTexts', 'presetInitialized'], (result) => {
    if (!result.presetInitialized && (!Array.isArray(result.savedTexts) || result.savedTexts.length === 0)) {
      chrome.storage.local.set({
        savedTexts: buildPresetTexts(),
        presetInitialized: true
      });
      return;
    }

    if (!result.presetInitialized) {
      chrome.storage.local.set({ presetInitialized: true });
    }
  });

  // 자동완성 기능 기본값 설정 및 아이콘 동기화
  chrome.storage.sync.get(['autoCompleteEnabled'], (result) => {
    if (result.autoCompleteEnabled === undefined) {
      chrome.storage.sync.set({ autoCompleteEnabled: true }, () => {
        updateExtensionIcon(true);
      });
      return;
    }

    updateExtensionIcon(!!result.autoCompleteEnabled);
  });
});

// Service Worker 활성 상태 유지를 위한 keep-alive 로직 (Alarms API 사용으로 개선)
chrome.runtime.onStartup.addListener(() => {
  setupKeepAlive();

  chrome.storage.sync.get(['autoCompleteEnabled'], (result) => {
    const enabled = result.autoCompleteEnabled !== false;
    updateExtensionIcon(enabled);
  });
});

// Keep-alive 설정 (메모리 효율적인 Alarms API 사용)
function setupKeepAlive() {
  // 기존 알람이 있으면 먼저 제거
  chrome.alarms.clear('keepAlive', () => {
    // 5분마다 알람 생성 (setInterval보다 효율적)
    chrome.alarms.create('keepAlive', {
      periodInMinutes: 5
    });
  });
}

// 알람 이벤트 리스너
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // 간단한 storage 체크로 Service Worker 유지
    chrome.storage.local.get(['keepAlive'], () => {
      // no-op: 호출 자체로 Service Worker 유지
    });
  }
});

// 확장 프로그램 시작 시 keep-alive 활성화
setupKeepAlive();

// Side Panel 상태 추적을 위한 변수
const sidePanelState = {}; // windowId -> boolean

// 키보드 단축키 처리 (Ctrl+Shift+T)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-auto-complete') {
    // 현재 활성 탭에 토글 메시지 전송
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'quickToggle'
        }, (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '';
            // bfcache 오류는 조용히 무시
          } else {
            // 🎯 아이콘 상태 업데이트 (임시 뱃지 표시)
            if (response && typeof response.newState === 'boolean') {
              updateExtensionIcon(response.newState, true); // showTemporaryBadge=true 추가
            }
          }
        });
      }
    });
  } else if (command === 'open-side-panel') {
    // 사이드 패널 토글 로직
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.windows.getCurrent({ populate: false }, (window) => {
        if (!window || !window.id) return;
        
        const windowId = window.id;
        // 현재 상태가 열려있으면 닫기 (비활성화 후 재활성화 트릭)
        if (sidePanelState[windowId]) {
          chrome.sidePanel.setOptions({ enabled: false }, () => {
            chrome.sidePanel.setOptions({ enabled: true });
            sidePanelState[windowId] = false; // 상태 업데이트
          });
        } else {
          // 닫혀있으면 열기
          chrome.sidePanel.open({ windowId: windowId })
            .catch(error => console.error("Error opening side panel via shortcut:", error));
        }
      });
    }
  }
});

chrome.runtime.onConnect.addListener((port) => {
  // Side Panel 연결 추적
  if (port.name === 'sidepanel-open') {
    const sender = port.sender;
    // sender.tab.windowId 또는 sender.windowId 사용 (컨텍스트에 따라 다름)
    // 일반적으로 사이드 패널은 탭과 연동되거나 윈도우와 연동됨. 
    // 여기서는 popup.js에서 보낸 windowId를 활용하거나 sender를 통해 추론
    
    // 포트 메시지로 windowId를 받는 것이 가장 확실하지만, 
    // 간단하게 sender 정보를 활용: side panel은 보통 tab이 없을 수도 있지만 windowId는 있어야 함
    // 하지만 sender.tab?.windowId 가 가장 확실한 방법 (만약 탭 관련 패널이라면)
    
    // 여기서는 간단히 sender가 있는 연결된 윈도우를 찾기 위해 메시지 리스너 추가
    port.onMessage.addListener((msg) => {
      if (msg.windowId) {
        sidePanelState[msg.windowId] = true;
        
        port.onDisconnect.addListener(() => {
          sidePanelState[msg.windowId] = false;
        });
      }
    });

    return;
  }

  if (port.name !== 'text-saver-keepalive') {
    return;
  }
  
  // Keep-alive 로직
  port.onDisconnect.addListener(() => {
    // bfcache 오류 무시 처리
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message || '';
      // bfcache 관련 오류는 조용히 처리
      if (errorMsg.includes('back/forward cache')) {
        return;
      }
      // 다른 오류는 오류로 기록
      console.error('Text Saver: Port disconnect error:', errorMsg);
    }
  });
});

// 임시 뱃지 관리를 위한 타이머 변수
let temporaryBadgeTimer = null;

// 뱃지 설정 유틸 함수 (중복 제거)
function setBadge(text, color, title) {
  chrome.action.setBadgeText({ text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color });
  }
  chrome.action.setTitle({ title });
}

// 확장 프로그램 아이콘 상태 업데이트 함수 (개선된 버전)
function updateExtensionIcon(enabled, showTemporaryBadge = false) {
  try {
    if (showTemporaryBadge) {
      showTemporaryStatusBadge(enabled);
    } else {
      setPermanentIconState(enabled);
    }
  } catch (e) {
    console.error('Text Saver //: Error updating icon:', e);
  }
}

// 임시 상태 뱃지 표시 (3초 후 자동 제거, 메모리 누수 방지)
function showTemporaryStatusBadge(enabled) {
  // 기존 타이머 정리 (메모리 누수 방지)
  if (temporaryBadgeTimer) {
    clearTimeout(temporaryBadgeTimer);
    temporaryBadgeTimer = null;
  }

  // 임시 뱃지 표시
  setBadge(
    enabled ? '✓' : '⏸️',
    enabled ? '#4CAF50' : '#9E9E9E',
    `Text Saver: ${enabled ? '자동완성 활성화됨' : '자동완성 일시정지됨'}`
  );

  // 3초 후 영구 상태로 변경
  temporaryBadgeTimer = setTimeout(() => {
    setPermanentIconState(enabled);
    temporaryBadgeTimer = null;
  }, 3000);
}

// 영구 아이콘 상태 설정 (평상시)
function setPermanentIconState(enabled) {
  const title = enabled
    ? "Text Saver: 자동완성 활성화됨"
    : "Text Saver (일시정지됨) - Ctrl+Shift+T로 토글";

  setBadge('', null, title);
}



// Storage 변경 감지하여 아이콘 상태 동기화
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.autoCompleteEnabled) {
    const enabled = changes.autoCompleteEnabled.newValue;
    updateExtensionIcon(enabled);
  }
});

// 컨텍스트 메뉴 클릭 이벤트 처리 (개선된 버전)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // 사이드 패널 열기 처리
  if (info.menuItemId === "openSidePanel") {
    // Chrome 116+ 사이드 패널 열기 API 사용
    if (chrome.sidePanel && chrome.sidePanel.open) {
      // 현재 윈도우 ID를 사용하여 사이드 패널 열기
      chrome.windows.getCurrent({ populate: false }, (window) => {
        if (window && window.id) {
          chrome.sidePanel.open({ windowId: window.id })
            .catch(error => console.error("Error opening side panel:", error));
        }
      });
    }
    return;
  }

  if (info.menuItemId !== "saveSelectedTextWithUrlAndAutoTags" || !info.selectionText || !tab?.url) {
    return;
  }

  // 보안: 입력 검증
  if (typeof info.selectionText !== 'string' || info.selectionText.length > 100000) {
    console.error("[Text Saver] Invalid or too long selection text");
    return;
  }

  // 보안: URL 검증 - 화이트리스트 방식 (안전한 프로토콜만 허용)
  const SAFE_URL_SCHEMES = ['http:', 'https:'];
  try {
    const urlObj = new URL(tab.url);
    if (!SAFE_URL_SCHEMES.includes(urlObj.protocol)) {
      console.error("[Text Saver] Unsafe URL scheme detected:", urlObj.protocol);
      return;
    }
  } catch (error) {
    console.error("[Text Saver] Invalid URL format:", error);
    return;
  }

  // 데이터 준비
  const currentTime = new Date();
  const dateTag = `${currentTime.getFullYear()}/${String(currentTime.getMonth() + 1).padStart(2, '0')}/${String(currentTime.getDate()).padStart(2, '0')}`;

  // 보안: 텍스트 sanitization
  const sanitizedText = info.selectionText
    .replace(/[<>]/g, '')
    .substring(0, 50000); // 최대 길이 제한

  const newTextEntry = {
    id: Date.now().toString(),
    title: sanitizedText.substring(0, 30) + (sanitizedText.length > 30 ? "..." : ""),
    content: sanitizedText,
    tags: ["웹페이지", dateTag],
    createdAt: currentTime.toISOString(),
    updatedAt: currentTime.toISOString(),
    isBookmarked: false,
    sourceURL: tab.url.substring(0, 2000), // URL 길이 제한
    metadata: {
      source: "contextMenu",
      pageTitle: (tab.title || "N/A").substring(0, 200) // 제목 길이 제한
    }
  };

  // 저장 처리
  chrome.storage.local.get({ savedTexts: [] }, (result) => {
    const savedTexts = [...result.savedTexts, newTextEntry];

    chrome.storage.local.set({ savedTexts }, () => {
      // 뱃지 표시 (통합 함수 사용)
      try {
        setBadge('저장', '#4CAF50', 'Text Saver: 텍스트 저장됨');
        setTimeout(() => setBadge('', null, 'Text Saver'), 2000);
      } catch (e) {
        console.error("[Text Saver] Error setting badge:", e);
      }

      // 브라우저 알림 표시
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../icons/icon48.png',
        title: 'Text Saver',
        message: '선택한 텍스트와 URL이 자동 태그와 함께 저장되었습니다!'
      });
    });
  });
});


// 검색 결과 최대 개수 상수
const MAX_SEARCH_RESULTS = 50;

// 최신순 정렬 함수 (재사용 가능하도록 분리)

function computeMatchScore(value, query) {
  if (!query || typeof value !== 'string') {
    return 0;
  }

  const normalizedValue = value.toLowerCase();
  if (normalizedValue.startsWith(query)) {
    return 3;
  }
  if (normalizedValue.includes(query)) {
    return 1;
  }
  return 0;
}

function computeTagScore(tags, query) {
  if (!query || !Array.isArray(tags)) {
    return 0;
  }

  let bestScore = 0;
  tags.forEach(tag => {
    if (typeof tag !== 'string') {
      return;
    }
    const score = computeMatchScore(tag, query);
    if (score > bestScore) {
      bestScore = score;
    }
  });
  return bestScore;
}

function sortByRelevance(items, query) {
  const normalizedQuery = typeof query === 'string' ? query.toLowerCase() : '';
  const hasQuery = normalizedQuery.length > 0;

  return (Array.isArray(items) ? [...items] : []).sort((a, b) => {
    const bookmarkDiff =
      Number(Boolean(b?.isBookmarked)) - Number(Boolean(a?.isBookmarked));
    if (bookmarkDiff !== 0) {
      return bookmarkDiff;
    }

    if (hasQuery) {
      const titleDiff =
        computeMatchScore(b?.title, normalizedQuery) -
        computeMatchScore(a?.title, normalizedQuery);
      if (titleDiff !== 0) {
        return titleDiff;
      }

      const tagDiff =
        computeTagScore(b?.tags, normalizedQuery) -
        computeTagScore(a?.tags, normalizedQuery);
      if (tagDiff !== 0) {
        return tagDiff;
      }

      const metaDiff =
        computeMatchScore(b?.metadata?.pageTitle, normalizedQuery) -
        computeMatchScore(a?.metadata?.pageTitle, normalizedQuery);
      if (metaDiff !== 0) {
        return metaDiff;
      }

      const contentDiff =
        computeMatchScore(b?.content, normalizedQuery) -
        computeMatchScore(a?.content, normalizedQuery);
      if (contentDiff !== 0) {
        return contentDiff;
      }
    }

    return getItemTimestamp(b) - getItemTimestamp(a);
  });
}

// 검색 필터 함수 (분리하여 재사용성 향상)
function filterItems(items, query) {
  if (!query) return [...items]; // 원본 배열 보호를 위한 복사

  // 안전한 쿼리 문자열 처리
  const lowerQuery = String(query).toLowerCase().substring(0, 100);

  return items.filter(item => {
    // 아이템 유효성 검사
    if (!item || typeof item !== 'object') return false;

    try {
      return (
        (typeof item.title === 'string' && item.title.toLowerCase().includes(lowerQuery)) ||
        (typeof item.content === 'string' && item.content.toLowerCase().includes(lowerQuery)) ||
        (Array.isArray(item.tags) && item.tags.some(tag =>
          typeof tag === 'string' && tag.toLowerCase().includes(lowerQuery)
        )) ||
        (typeof item.sourceURL === 'string' && item.sourceURL.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error("Text Saver: Error filtering item:", error);
      return false;
    }
  });
}

// 메시지 리스너 (개선된 에러 처리 및 모듈화)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // 검색 기능
    if (request.action === "searchItems") {
      handleSearchRequest(request, sendResponse);
      return true; // 비동기 응답
    }

    // 아이콘 업데이트 요청 처리
    if (request.action === "updateIcon") {
      updateExtensionIcon(request.enabled, request.showTemporary || false);
      sendResponse({ success: true, enabled: request.enabled });
      return true;
    }

    if (request.action === "restorePresets") {
      restorePresetTexts(sendResponse);
      return true;
    }

    // 알 수 없는 액션
    console.error("Text Saver: Unknown action:", request.action);
    sendResponse({ error: "Unknown action" });

  } catch (error) {
    console.error("Text Saver: Message listener error:", error);
    sendResponse({ error: error.message });
  }

  return false; // 동기 응답
});

// 검색 요청 처리 함수 (분리하여 가독성 향상)
function handleSearchRequest(request, sendResponse) {
  // 입력 유효성 검사
  if (!request || typeof request.query !== 'string') {
    sendResponse({ error: 'Invalid query parameter', items: [] });
    return;
  }

  const query = request.query.substring(0, 100).trim(); // 쿼리 길이 제한

  chrome.storage.local.get('savedTexts', (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error retrieving savedTexts:", chrome.runtime.lastError);
      sendResponse({ error: chrome.runtime.lastError.message, items: [] });
      return;
    }

    try {
      const savedTexts = result.savedTexts || [];

      // 데이터 타입 검증
      if (!Array.isArray(savedTexts)) {
        console.error("Text Saver: savedTexts is not an array");
        sendResponse({ error: 'Invalid data format', items: [] });
        return;
      }

      const filteredItems = filterItems(savedTexts, query);
      const sortedItems = sortByRelevance(filteredItems, query);
      const limitedItems = sortedItems.slice(0, MAX_SEARCH_RESULTS);
      sendResponse({ items: limitedItems });
    } catch (error) {
      console.error("Text Saver: Error processing search:", error);
      sendResponse({ error: error.message, items: [] });
    }
  });
} 
