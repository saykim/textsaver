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
      
      const authUrl = `https://accounts.google.com/o/oauth2/auth` + 
                      `?client_id=${clientId}` + 
                      `&response_type=token` + 
                      `&redirect_uri=${encodeURIComponent(redirectUri)}` + 
                      `&scope=${encodeURIComponent(scopes)}`;

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
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  },

  // 파일 업로드 (백업)
  uploadFile: async (data) => {
    const token = await GoogleDrive.getAuthToken(true);
    const fileContent = JSON.stringify(data);
    const file = new Blob([fileContent], { type: 'application/json' });
    const metadata = {
      name: GoogleDrive.BACKUP_FILENAME,
      mimeType: 'application/json'
    };

    const existingFile = await GoogleDrive.findBackupFile(token);
    
    let url, method;
    const form = new FormData();

    if (existingFile) {
      // 기존 파일 업데이트 (PATCH)
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
      method = 'PATCH';
      // 메타데이터는 업데이트 시 필요 없을 수 있으나, 명시적으로 보냄
      form.append('metadata', new Blob([JSON.stringify({ mimeType: 'application/json' })], { type: 'application/json' }));
    } else {
      // 새 파일 생성 (POST)
      url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      method = 'POST';
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    }
    
    form.append('file', file);

    const response = await fetch(url, {
      method: method,
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }
    return await response.json();
  },

  // 파일 다운로드 (복원)
  downloadFile: async () => {
    const token = await GoogleDrive.getAuthToken(true);
    const existingFile = await GoogleDrive.findBackupFile(token);

    if (!existingFile) {
      throw new Error('No backup file found');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Download failed');
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

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error getting cloud backup info:', error);
      return null;
    }
  }
};

// 전역 스코프에 노출 (popup.js에서 사용)
window.GoogleDrive = GoogleDrive;
