function createOAuthState() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function readGoogleApiError(response) {
  try {
    const text = await response.text();
    if (!text) {
      return `HTTP ${response.status}`;
    }
    try {
      const data = JSON.parse(text);
      return (
        data?.error?.message ||
        data?.error_description ||
        data?.error ||
        text ||
        `HTTP ${response.status}`
      );
    } catch (_) {
      return text;
    }
  } catch (_) {
    return `HTTP ${response?.status ?? 'unknown'}`;
  }
}

function removeCachedAuthTokenSafe(token) {
  return new Promise((resolve) => {
    try {
      if (!token) return resolve();
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    } catch (_) {
      resolve();
    }
  });
}

function buildDriveUploadMultipart(existingFile, fileBlob) {
  const form = new FormData();

  if (existingFile?.id) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
    const method = 'PATCH';
    // 업데이트에서는 name 변경이 불필요하므로 mimeType만 전달
    form.append(
      'metadata',
      new Blob([JSON.stringify({ mimeType: 'application/json' })], { type: 'application/json' })
    );
    form.append('file', fileBlob);
    return { url, method, form };
  }

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const method = 'POST';
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: GoogleDrive.BACKUP_FILENAME, mimeType: 'application/json' })], { type: 'application/json' })
  );
  form.append('file', fileBlob);
  return { url, method, form };
}

const GoogleDrive = {
  // 백업 파일명
  BACKUP_FILENAME: 'text_saver_backup.json',
  
  // Edge/기타 브라우저용 Web Application Client ID (GCP에서 "웹 애플리케이션" 유형으로 생성)
  EDGE_CLIENT_ID: '138881851224-qfjhr4fn9pv92j7vmrkp7eham0qs3kob.apps.googleusercontent.com',
  
  // 인증 토큰 가져오기 (Hybrid: Chrome Native + Web Auth Flow)
  getAuthToken: (interactive = true) => {
    return new Promise((resolve, reject) => {
      // 1. Chrome Native 방식 시도
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError || !token) {
          // 2. 실패 시 (Edge 등) Web Auth Flow 시도
          if (interactive) {
            GoogleDrive.getWebAuthToken(interactive).then(resolve).catch(reject);
          } else {
            reject(chrome.runtime.lastError);
          }
        } else {
          resolve(token);
        }
      });
    });
  },

  // Web Auth Flow (Edge/Whale 등 호환용)
  getWebAuthToken: (interactive) => {
    return new Promise((resolve, reject) => {
      const manifest = chrome.runtime.getManifest();
      // Edge 등 비-Chrome 브라우저는 Web Application Client ID 사용
      const clientId = GoogleDrive.EDGE_CLIENT_ID;
      const scopes = manifest.oauth2.scopes.join(' ');
      const redirectUri = chrome.identity.getRedirectURL();
      const state = createOAuthState();
      
      const authUrl = `https://accounts.google.com/o/oauth2/auth` + 
                      `?client_id=${clientId}` + 
                      `&response_type=token` + 
                      `&redirect_uri=${encodeURIComponent(redirectUri)}` + 
                      `&scope=${encodeURIComponent(scopes)}` +
                      `&include_granted_scopes=true` +
                      `&state=${encodeURIComponent(state)}`;

      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: interactive
      }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Web Auth Flow failed';
          console.error('Text Saver: Web Auth Flow Error:', errorMsg);
          reject(chrome.runtime.lastError || new Error('Web Auth Flow failed'));
        } else {
          // URL에서 토큰 추출
          const params = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
          const oauthError = params.get('error') || params.get('error_description');
          if (oauthError) {
            reject(new Error(String(oauthError)));
            return;
          }

          const returnedState = params.get('state');
          if (returnedState && returnedState !== state) {
            reject(new Error('OAuth state mismatch'));
            return;
          }
          const token = params.get('access_token');
          if (token) {
            resolve(token);
          } else {
            reject(new Error('No access token found'));
          }
        }
      });
    });
  },

  // 사용자 정보 가져오기 (연결 확인용)
  getUserInfo: async () => {
    try {
      const token = await GoogleDrive.getAuthToken(false);
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch user info');
      return await response.json();
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  },

  // 백업 파일 찾기
  findBackupFile: async (token) => {
    const query = `name = '${GoogleDrive.BACKUP_FILENAME}' and trashed = false and 'root' in parents`;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const message = await readGoogleApiError(response);
      throw new Error(`Drive list failed: ${message}`);
    }
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  },

  // 파일 업로드 (백업)
  uploadFile: async (data) => {
    const fileContent = JSON.stringify(data);
    const fileBlob = new Blob([fileContent], { type: 'application/json' });

    const doUpload = async (token) => {
      const existingFile = await GoogleDrive.findBackupFile(token);
      const { url, method, form } = buildDriveUploadMultipart(existingFile, fileBlob);
      return fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
    };

    let token = await GoogleDrive.getAuthToken(true);
    let response = await doUpload(token);

    // 토큰 만료/권한 문제인 경우 1회 재시도
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      await removeCachedAuthTokenSafe(token);
      token = await GoogleDrive.getAuthToken(true);
      response = await doUpload(token);
    }

    if (!response.ok) {
      const message = await readGoogleApiError(response);
      throw new Error(`Upload failed: ${message}`);
    }

    return await response.json();
  },

  // 파일 다운로드 (복원)
  downloadFile: async () => {
    const doDownload = async (token) => {
      const existingFile = await GoogleDrive.findBackupFile(token);
      if (!existingFile) {
        throw new Error('No backup file found');
      }
      return fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    };

    let token = await GoogleDrive.getAuthToken(true);
    let response = await doDownload(token);

    // 토큰 만료/권한 문제인 경우 1회 재시도
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      await removeCachedAuthTokenSafe(token);
      token = await GoogleDrive.getAuthToken(true);
      response = await doDownload(token);
    }

    if (!response.ok) {
      const message = await readGoogleApiError(response);
      throw new Error(`Download failed: ${message}`);
    }

    return await response.json();
  },

  // 클라우드 백업 정보 조회 (타임스탬프 비교용, 인터랙티브 없이)
  getCloudBackupInfo: async () => {
    try {
      const token = await GoogleDrive.getAuthToken(false);
      if (!token) return null;
      
      const existingFile = await GoogleDrive.findBackupFile(token);
      if (!existingFile) return null;

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting cloud backup info:', error);
      return null;
    }
  }
};

// 전역 스코프에 노출 (popup.js에서 사용)
window.GoogleDrive = GoogleDrive;
