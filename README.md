# DocuFlow

문서 종류를 선택하고 알고 있는 정보를 입력하면 Firebase AI Logic의 Gemini가 공지문, 신청서, 기획서, 보고서, 회의록, 행사 안내문, 협조 공문 초안을 작성하는 웹 애플리케이션입니다.

## 실행

```bash
npm install
npm run dev
```

## 확인

```bash
npm run build
npm run lint
npm run build:firebase
node --test tests/rendered-html.test.mjs
```

생성된 문서는 직접 수정할 수 있고, 익명 Firebase 사용자별 Firestore 저장 목록에서 다시 불러오거나 삭제할 수 있습니다. AI 결과는 예시 초안이므로 실제 배포 전 담당자가 사실관계와 개인정보를 최종 확인해야 합니다.
