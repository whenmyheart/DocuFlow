# DocuFlow

강남대학교 공통 행정문서 양식으로 AI 초안을 작성하고 검토하는 웹 도구입니다.

## 학교 양식

- 모든 문서 종류에 동일한 A4 공지문 레이아웃 적용
- 검정·파랑 이중 제목 띠
- `1. → 가. → 1) → -` 행정문서 번호 체계
- 연한 파랑 머리글을 사용한 정보 표
- 문서 하단 작성일과 `강남대학교 담당 부서` 서명
- Word, PDF, 한글(HWPX) 미리보기 및 다운로드에 동일한 구조 적용

## 로컬 확인

```shell
npx firebase-tools emulators:start --only hosting
```

Firebase Hosting 기본 프로젝트는 `docu-flow-9fde2`로 설정되어 있습니다.
