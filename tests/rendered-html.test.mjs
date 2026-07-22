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
  assert.match(page, /downloadHangulDocument/);
  assert.match(page, /downloadPdfDocument/);
  assert.match(page, /application\/hwp\+zip/);
  assert.match(page, /NanumGothic-Regular\.ttf/);
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

test("ships direct PDF and HWPX download assets", async () => {
  const config = await readFile(new URL("../vite.firebase.config.ts", import.meta.url), "utf8");
  const [template, font] = await Promise.all([
    readFile(new URL("../public/docuflow-template.hwpx", import.meta.url)),
    readFile(new URL("../public/fonts/NanumGothic-Regular.ttf", import.meta.url)),
  ]);
  assert.match(config, /publicDir:\s*"\.\.\/public"/);
  assert.ok(template.length > 1000);
  assert.ok(font.length > 1000000);
});
