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
  assert.match(ai, /GoogleAIBackend/);
  assert.match(ai, /입력하지 않은 날짜, 연락처, 금액/);
  assert.match(ai, /신청자가 빈칸을 직접 작성해 제출/);
  assert.match(ai, /improveDocumentSpacing/);
  assert.ok(ai.includes("([가-힣][.!?])"));
  assert.match(ai, /responseJsonSchema/);
  assert.match(ai, /의미 기반 검색 도우미/);
  assert.doesNotMatch(ai, /reviewDocumentWithAi|AiReviewIssue|AIza/);
});
