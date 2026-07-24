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
  assert.match(html, /빈 문서 앞에서 고민하지 마세요/);
  assert.match(html, /초안은 AI가 작성합니다/);
  assert.match(html, /문서 선택하러 가기/);
  assert.match(html, /저장 목록 보기/);
  assert.doesNotMatch(html, /어떤 문서를 작성할까요/);
  assert.doesNotMatch(html, /본문 누락 검토하기|규칙 기반/);
});

test("uses Gemini generation and keeps editable, saved drafts", async () => {
  const [page, ai] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai-review.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /DOCUMENT_TYPES/);
  assert.match(page, /freeformInput/);
  assert.match(page, /문서에 들어갈 기본 정보/);
  assert.match(page, /자유 입력 방식/);
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
  assert.match(page, /application\/owpml/);
  assert.match(page, /getStyledPreviewMarkup/);
  assert.match(page, /HwpxWriter/);
  assert.match(page, /createFromPlainText/);
  assert.match(page, /html2canvas/);
  assert.match(page, /전체 화면 미리보기/);
  assert.match(page, /exportPreviewFormat/);
  assert.match(page, /downloadPreviewedDocument/);
  assert.match(page, /EXPORT_FORMAT_DESCRIPTIONS/);
  assert.match(page, /공공문서 스타일/);
  assert.match(page, /문서 주요 정보/);
  assert.match(page, /exportPreviewDetails/);
  assert.match(page, /official-notice-preview/);
  assert.match(page, /official-notice-rule/);
  assert.match(page, /official-notice-list/);
  assert.match(page, /official-notice-footer/);
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
  assert.match(page, /AUTOSAVE_DRAFT_KEY/);
  assert.match(page, /docuflow-current-draft/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /이전에 임시저장한 작업을 불러왔습니다/);
  assert.match(page, /autosaved-draft-card/);
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
  const firestoreRules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(firestoreRules, /hasOnly\(\['title', 'text', 'savedAt', 'documentTypeId'\]\)/);
  assert.match(firestoreRules, /'documentTypeId' in request\.resource\.data/);
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
  assert.match(pageSource, /const verticalMargin = 794/);
  assert.match(pageSource, /margin: \{ top: verticalMargin, right: 1077, bottom: verticalMargin, left: 1077/);
  assert.match(pageSource, /keepLines: false/);
  assert.match(pageSource, /keepNext: false/);
  assert.match(pageSource, /widowControl: false/);
  assert.match(pageSource, /new TableRow\(\{ cantSplit: false/);
  assert.match(pageSource, /TableLayoutType\.FIXED/);
  assert.match(pageSource, /if \(documentTypeId\)/);
  assert.match(pageSource, /documentTypeId === "application"/);
  assert.match(pageSource, /documentTypeId === "proposal"/);
  assert.match(pageSource, /documentTypeId === "report" \|\| documentTypeId === "minutes"/);
  assert.match(pageSource, /documentTypeId === "event"/);
  assert.match(pageSource, /documentTypeId === "official"/);
  assert.match(pageSource, /noticeRuleTable/);
  assert.match(pageSource, /columnWidths: \[pageWidth\]/);
  assert.match(pageSource, /alignment: AlignmentType\.RIGHT/);
  assert.match(pageSource, /columnWidths: \[460, 660, 660, 660, 660\]/);
  assert.doesNotMatch(pageSource, /columnWidths: \[6652, 460, 660, 660, 660, 660\]/);
  assert.doesNotMatch(pageSource, /children\.push\(sectionHeading\("확인 및 기타 사항"\), \.\.\.bodyParagraphs\)/);
  assert.match(pageSource, /subjectTable/);
  assert.match(pageSource, /createPaginatedPreviewPages/);
  assert.match(pageSource, /PaginatedExportPreview/);
  assert.match(pageSource, /page\.style\.width = "210mm"/);
  assert.match(pageSource, /page\.style\.height = "297mm"/);
  assert.match(pageSource, /page\.scrollHeight <= page\.clientHeight \+ 2/);
  assert.match(pageSource, /splitParagraphToFillPage/);
  assert.match(pageSource, /splitTableToFillPage/);
  assert.match(pageSource, /splitContainerToFillPage/);
  assert.match(pageSource, /container\.classList\.contains\("template-section-block"\) && parent\.childElementCount > 0/);
  assert.match(pageSource, /class=\"document-page-frame\"/);
  assert.match(pageSource, /pageBorderTop: \{ style: BorderStyle\.SINGLE, size: 10, color: "666666", space: 18 \}/);
  assert.match(pageSource, /pageBorderBottom: \{ style: BorderStyle\.SINGLE, size: 10, color: "666666", space: 18 \}/);
  assert.match(pageSource, /carryHeading/);
  assert.match(pageSource, /className="template-section-heading"/);
  assert.match(pageSource, /className="template-section-content"/);
  assert.match(pageSource, /getVisibleExportPreviewPages/);
  assert.match(pageSource, /visiblePages\.map/);
  assert.match(pageSource, /page-break-after:always/);
  assert.match(pageSource, /pdf\.addImage\([^\n]+0, 0, 210, 297/);
  assert.match(pageSource, /pdf\.addImage/);
  assert.match(pageSource, /getStyledPreviewClone/);
  assert.match(pageSource, /clone\.style\.padding = "0"/);
  assert.match(pageSource, /eventInformationTable/);
  assert.doesNotMatch(pageSource, /remainingHeight|offsetY = remainingHeight - imageHeight/);
  assert.match(pageSource, /noticeRuleTable/);
  assert.match(pageSource, /formatKoreanDocumentDate/);
  const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(cssSource, /\.proposal-section \{[^}]*break-inside: avoid/);
  assert.match(cssSource, /\.template-table-row \{[^}]*page-break-inside: avoid/);
  assert.doesNotMatch(cssSource, /\.proposal-section \{[^}]*min-height/);
  assert.doesNotMatch(cssSource, /\.template-writing-area \{[^}]*min-height/);
  assert.match(cssSource, /\.template-section-block \{[^}]*break-inside: avoid/);
  assert.match(cssSource, /\.form-template \.template-section-body/);
  assert.match(cssSource, /\.template-section-content \{[^}]*border: 1px solid #777;[^}]*border-top: 0/);
  assert.match(cssSource, /\.export-preview-document \{[^}]*padding: 14mm 19mm/);
  assert.match(cssSource, /\.export-preview-viewport \.document-page-frame \{[^}]*inset: 6mm;[^}]*border: 1\.25px solid #666/);
  assert.doesNotMatch(cssSource, /\.proposal-template, \.report-template, \.minutes-template \{ padding-top:/);
  assert.match(cssSource, /format-hwpx[\s\S]*font-family: "Malgun Gothic", "맑은 고딕", Arial, sans-serif/);
  assert.doesNotMatch(cssSource, /format-hwpx[\s\S]{0,180}함초롬바탕/);
  assert.match(cssSource, /\.event-template \{[^}]*padding-inline: 19mm/);
  assert.doesNotMatch(cssSource, /\.event-template::before|border-inline: 4px solid #238caf/);
  assert.match(cssSource, /\.autosave-message/);
  assert.match(cssSource, /\.autosaved-draft-card/);
  assert.ok(template.length > 1000);
  assert.ok(font.length > 1000000);
});

test("creates a readable standards-compliant HWPX download", async () => {
  const { HwpxReader, HwpxWriter } = await import("@ssabrojs/hwpxjs");
  const input = "DocuFlow HWPX compatibility check\n2026 campus club application form";
  const bytes = await new HwpxWriter().createFromPlainText(input, {
    title: "DocuFlow HWPX test",
    creator: "DocuFlow",
  });

  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const reader = new HwpxReader();
  await reader.loadFromArrayBuffer(buffer);
  const text = await reader.extractText();
  assert.match(text, /DocuFlow HWPX compatibility check/);
  assert.match(text, /2026 campus club application form/);
});
