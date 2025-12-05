CP 버전 안정성 코드 적용 검증 결과
✅ 검증 완료
항목	CP 버전	개인용 버전 (수정 후)	일치
manifest.json			
action.default_popup	popup.html?view=popup	popup.html?view=popup	✅
side_panel.default_path	popup.html?view=panel	popup.html?view=panel	✅
popup.js			
URL 파라미터 상수	FORCE_POPUP_MODE, FORCE_PANEL_MODE	FORCE_POPUP_MODE, FORCE_PANEL_MODE	✅
applyLayoutMode()
 함수	동일 로직	동일 로직	✅
리사이즈 이벤트 리스너	requestAnimationFrame	requestAnimationFrame	✅
캐싱 변수	savedTextsCache, dataChanged	savedTextsCache, dataChanged	✅
popup.css			
.tab-buttons flex-wrap	nowrap	nowrap	✅
360px 미디어쿼리	포함	포함	✅
사이드패널 컨테이너	display: flex	display: flex	✅
viewTab/bookmarkTab Flex	flex: 1 1 auto	flex: 1 1 auto	✅
text-list 스크롤	overflow-y: auto	overflow-y: auto	✅
📝 수정된 파일
manifest.json
 - URL 파라미터 추가
popup.js
 - applyLayoutMode 교체, 캐싱 변수 추가
popup.css
 - 반응형 스타일 추가
🔧 보존된 기능
✅ Google Drive 백업 (oauth2 설정 유지)
✅ identity 권한 유지
✅ utils.js 포함 유지
