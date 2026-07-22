import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

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

test("server-renders the single-input document review prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>문서체크 \| 신청서 양식 본문 검토<\/title>/i);
  assert.match(html, /신청서 양식 전체 텍스트/);
  assert.match(html, /AI로 본문 검토하기/);
  assert.match(html, /문서 스타일 자동 구성/);
  assert.match(html, /AI가 본문 전체의 맥락을 읽습니다/);
  assert.match(html, /AI 문맥 검토/);
  assert.doesNotMatch(html, /부서 피드백에서 확인할 가정과 질문/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("keeps one document input and removes the starter preview", async () => {
  const [page, aiReview, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="documentText"/);
  assert.match(page, /reviewDocumentWithAi/);
  assert.doesNotMatch(page, /function analyzeDocument|const reviewRules/);
  assert.match(aiReview, /GoogleAIBackend/);
  assert.match(aiReview, /고정된 필수 항목 목록을 대입하지 마세요/);
  assert.match(aiReview, /responseJsonSchema/);
  assert.doesNotMatch(aiReview, /AIza/);
  assert.match(page, /형식은 자유입니다/);
  assert.match(page, /createStyledBlocks/);
  assert.match(page, /배포 문서 스타일 미리보기/);
  assert.match(page, /규칙 기반 자동 서식 예시/);
  assert.match(page, /원문에 서식 적용/);
  assert.match(page, /서식 적용 실행 취소/);
  assert.match(page, /서식 적용 다시 실행/);
  assert.match(page, /updateStyledBlock/);
  assert.match(page, /제목이나 문장을 클릭해 바로 수정/);
  assert.match(page, /emptyField/);
  assert.match(page, /styled-empty-field/);
  assert.doesNotMatch(page, /id="formTitle"|id="audience"|id="applicationPeriod"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", templateRoot)));
});
