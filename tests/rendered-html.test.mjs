import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the AI document drafting service", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>DocuFlow \| AI 문서 초안 작성<\/title>/i);
  assert.match(html, /어떤 문서를 작성할까요/);
  assert.match(html, /공지문/);
  assert.match(html, /신청서/);
  assert.match(html, /기획서/);
  assert.match(html, /보고서/);
  assert.match(html, /AI 초안/);
  assert.doesNotMatch(html, /본문 누락 검토하기|규칙 기반/);
});

test("uses Gemini generation and keeps editable, saved drafts", async () => {
  const [page, ai] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai-review.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /DOCUMENT_TYPES/);
  assert.match(page, /generateDocumentWithAi/);
  assert.match(page, /DraftEditor/);
  assert.match(page, /formatted-document/);
  assert.match(page, /saveCloudDocument/);
  assert.match(page, /목록에 저장/);
  assert.match(page, /searchDocumentsWithAi/);
  assert.match(page, /문서 종류 다시 선택/);
  assert.match(page, /신청자에게 받을 정보/);
  assert.match(page, /신청자 작성 항목/);
  assert.match(page, /copyGeneratedDocument/);
  assert.match(page, /downloadWordDocument/);
  assert.match(page, /buildWordDocumentBlob/);
  assert.match(page, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(page, /downloadHangulDocument/);
  assert.match(page, /downloadPdfDocument/);
  assert.match(page, /application\/hwp\+zip/);
  assert.match(page, /getStyledPreviewMarkup/);
  assert.match(page, /htmlToHwpx/);
  assert.match(page, /html2canvas/);
  assert.match(page, /전체 화면 미리보기/);
  assert.match(page, /exportPreviewFormat/);
  assert.match(page, /downloadPreviewedDocument/);
  assert.match(page, /EXPORT_FORMAT_DESCRIPTIONS/);
  assert.match(page, /공공문서 스타일/);
  assert.match(page, /문서 주요 정보/);
  assert.match(page, /exportPreviewDetails/);
  assert.match(page, /official-notice-preview/);
  assert.match(page, /공 지/);
  assert.match(page, /운영 내용 및 일정/);
  assert.match(page, /application-template/);
  assert.match(page, /proposal-template/);
  assert.match(page, /report-template/);
  assert.match(page, /minutes-template/);
  assert.match(page, /event-template/);
  assert.match(page, /official-letter-template/);
  assert.match(page, /document-name-editor/);
  assert.match(page, /문서명 수정/);
  assert.match(ai, /항목명: 내용/);
  assert.match(page, /AI 검수하기/);
  assert.match(page, /본문 지우기/);
  assert.match(page, /clearDocument/);
  assert.match(ai, /GoogleAIBackend/);
  assert.match(ai, /입력하지 않은 날짜, 연락처, 금액/);
  assert.match(ai, /입력된 항목이 하나뿐이어도/);
  assert.match(ai, /sentences\.length < 3 && line\.length < 135/);
  assert.match(ai, /sentenceCount >= 2/);
  assert.match(ai, /신청자가 빈칸을 직접 작성해 제출/);
  assert.match(ai, /improveDocumentSpacing/);
  assert.ok(ai.includes("(?<=[가-힣][.!?。])"));
  assert.match(ai, /reviewGeneratedDocumentWithAi/);
  assert.match(ai, /신청서 양식의 빈칸은 신청자가 작성할 영역/);
  assert.match(ai, /responseJsonSchema/);
  assert.match(ai, /의미 기반 검색 도우미/);
  assert.doesNotMatch(ai, /reviewDocumentWithAi|AIza/);
});

test("supports editable saved document names", async () => {
  const firebaseDocuments = await readFile(new URL("../lib/firebase-documents.ts", import.meta.url), "utf8");
  assert.match(firebaseDocuments, /updateCloudDocumentTitle/);
  assert.match(firebaseDocuments, /updateDoc/);
  assert.match(firebaseDocuments, /documentTypeId/);
});

test("ships compatible export assets and conversion libraries", async () => {
  const [config, packageJson] = await Promise.all([
    readFile(new URL("../vite.firebase.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const [template, font] = await Promise.all([
    readFile(new URL("../public/docuflow-template.hwpx", import.meta.url)),
    readFile(new URL("../public/fonts/NanumGothic-Regular.ttf", import.meta.url)),
  ]);
  assert.match(config, /publicDir:\s*"\.\.\/public"/);
  assert.match(packageJson, /@ssabrojs\/hwpxjs/);
  assert.match(packageJson, /html2canvas/);
  assert.match(packageJson, /"docx"/);
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /width: 11906, height: 16838/);
  assert.match(pageSource, /margin: \{ top: 1134, right: 1077, bottom: 1134, left: 1077/);
  assert.match(pageSource, /TableLayoutType\.FIXED/);
  assert.match(pageSource, /documentTypeId === "notice"/);
  assert.match(pageSource, /documentTypeId === "application"/);
  assert.match(pageSource, /documentTypeId === "proposal"/);
  assert.match(pageSource, /documentTypeId === "report" \|\| documentTypeId === "minutes"/);
  assert.match(pageSource, /documentTypeId === "event"/);
  assert.match(pageSource, /documentTypeId === "official"/);
  assert.match(pageSource, /noticeInformationTable/);
  assert.match(pageSource, /columnWidths: \[pageWidth\]/);
  assert.match(pageSource, /alignment: AlignmentType\.RIGHT/);
  assert.match(pageSource, /columnWidths: \[460, 660, 660, 660, 660\]/);
  assert.doesNotMatch(pageSource, /columnWidths: \[6652, 460, 660, 660, 660, 660\]/);
  assert.doesNotMatch(pageSource, /children\.push\(sectionHeading\("확인 및 기타 사항"\), \.\.\.bodyParagraphs\)/);
  assert.match(pageSource, /subjectTable/);
  assert.match(pageSource, /createPaginatedPreviewPages/);
  assert.match(pageSource, /PaginatedExportPreview/);
  assert.match(pageSource, /pageHeightPx = 257 \* 96 \/ 25\.4/);
  assert.match(pageSource, /currentPage\.scrollHeight > pageHeightPx/);
  assert.match(pageSource, /pdf\.addImage/);
  assert.match(pageSource, /getStyledPreviewClone/);
  assert.match(pageSource, /clone\.style\.padding = "0"/);
  assert.doesNotMatch(pageSource, /remainingHeight|offsetY = remainingHeight - imageHeight/);
  assert.match(pageSource, /운영 내용 및 일정/);
  const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(cssSource, /\.proposal-section \{[^}]*break-inside: avoid/);
  assert.match(cssSource, /\.template-table-row \{[^}]*page-break-inside: avoid/);
  assert.doesNotMatch(cssSource, /\.proposal-section \{[^}]*min-height/);
  assert.doesNotMatch(cssSource, /\.template-writing-area \{[^}]*min-height/);
  assert.match(cssSource, /format-hwpx[\s\S]*font-family: "Malgun Gothic", "맑은 고딕", Arial, sans-serif/);
  assert.doesNotMatch(cssSource, /format-hwpx[\s\S]{0,180}함초롬바탕/);
  assert.ok(template.length > 1000);
  assert.ok(font.length > 1000000);
});
