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
  assert.match(html, /본문 누락 검토하기/);
  assert.match(html, /문서 스타일 자동 구성/);
  assert.match(html, /실제 AI가 아닌 규칙 기반 예시/);
  assert.match(html, /검토 가능한 정보/);
  assert.doesNotMatch(html, /부서 피드백에서 확인할 가정과 질문/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("keeps one document input and removes the starter preview", async () => {
  const [page, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="documentText"/);
  assert.match(page, /문의처 정보 누락/);
  assert.match(page, /사이트 주소 누락/);
  assert.match(page, /신청 기간 정보 누락/);
  assert.match(page, /제출처 정보 누락/);
  assert.match(page, /첨부서류 정보 누락/);
  assert.match(page, /비용 정보 누락/);
  assert.match(page, /형식은 자유입니다/);
  assert.match(page, /createStyledBlocks/);
  assert.match(page, /배포 문서 스타일 미리보기/);
  assert.match(page, /규칙 기반 자동 서식 예시/);
  assert.match(page, /담당부서\|담당자\|연락처/);
  assert.doesNotMatch(page, /id="formTitle"|id="audience"|id="applicationPeriod"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", templateRoot)));
});
