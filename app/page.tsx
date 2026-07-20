"use client";

import { useMemo, useRef, useState } from "react";

type ReviewState = "idle" | "issue" | "complete" | "error";

const sampleText = `[마을공유공간 이용 신청 안내]

한빛시 주민과 관내 단체는 마을공유공간 이용을 신청할 수 있습니다.
신청서를 작성한 뒤 새롬행정센터에 방문하여 제출해 주세요.
문의가 있으신 분은 아래 기재되어 있는 문의처로 연락해 주세요.`;

const contactRequestPattern = /(문의처|문의가|문의s|연락해s*주|연락s*바랍)/;
const phonePattern = /0\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}/;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function findContactEvidence(text: string) {
  const sentences = text
    .split(/(?<=[.!?。]|다\.)\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.find((sentence) => contactRequestPattern.test(sentence)) ?? "";
}

function hasContactError(text: string) {
  const asksForContact = contactRequestPattern.test(text);
  const hasContactInformation = phonePattern.test(text) || emailPattern.test(text);
  return asksForContact && !hasContactInformation;
}

export default function Home() {
  const [documentText, setDocumentText] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [emptyMessage, setEmptyMessage] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const evidence = useMemo(() => findContactEvidence(documentText), [documentText]);

  const review = () => {
    setEmptyMessage("");

    if (!documentText.trim()) {
      setReviewState("idle");
      setEmptyMessage("검토할 신청서 양식의 본문을 먼저 입력해 주세요.");
      editorRef.current?.focus();
      return;
    }

    try {
      setReviewState(hasContactError(documentText) ? "issue" : "complete");
    } catch {
      setReviewState("error");
    }
  };

  const updateText = (value: string) => {
    setDocumentText(value);
    setEmptyMessage("");

    if (reviewState === "issue" || reviewState === "complete") {
      setReviewState(value.trim() && hasContactError(value) ? "issue" : value.trim() ? "complete" : "idle");
    }
  };

  const loadSample = () => {
    setDocumentText(sampleText);
    setReviewState("idle");
    setEmptyMessage("");
    window.requestAnimationFrame(() => editorRef.current?.focus());
  };

  const reset = () => {
    setDocumentText("");
    setReviewState("idle");
    setEmptyMessage("");
    window.requestAnimationFrame(() => editorRef.current?.focus());
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">문</div>
        <div>
          <p className="eyebrow">행정 양식 배포 전 검토</p>
          <h1>문서체크</h1>
        </div>
        <span className="prototype-badge">양식 제작자용</span>
      </header>

      <section className="intro" aria-labelledby="intro-title">
        <div>
          <p className="step-label">본문 하나만 붙여 넣으면</p>
          <h2 id="intro-title">언급했지만 빠뜨린 정보,<br />배포 전에 확인하세요.</h2>
          <p>
            담당자가 만든 신청서 양식의 전체 본문을 입력하면, 안내한 내용과 실제로 적힌 정보가 일치하는지 확인합니다.
          </p>
        </div>
        <div className="trust-note">
          <span aria-hidden="true">i</span>
          <p>
            <strong>가상 양식으로 검토해 주세요</strong>
            실제 개인정보는 입력하지 마세요. 현재 검토 결과는 실제 AI가 아닌 규칙 기반 예시입니다.
          </p>
        </div>
      </section>

      <div className="scope-strip" aria-label="현재 작업 흐름">
        <span>01 본문 붙여 넣기</span><b>→</b><span>02 누락 검토</span><b>→</b><span>03 수정 후 다시 검토</span>
      </div>

      <section className="workspace single-editor-workspace" aria-label="신청서 양식 본문 검토">
        <div className="form-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-number">01</span>
              <div>
                <h3>배포할 양식 본문</h3>
                <p>신청서 양식과 안내 문구를 포함한 전체 텍스트를 한 번에 입력해 주세요.</p>
              </div>
            </div>
            <button className="text-button" type="button" onClick={loadSample}>오류 예시 불러오기</button>
          </div>

          <div className="document-editor">
            <label htmlFor="documentText">신청서 양식 전체 텍스트</label>
            <textarea
              id="documentText"
              ref={editorRef}
              value={documentText}
              onChange={(event) => updateText(event.target.value)}
              placeholder="여기에 배포할 신청서 양식의 본문을 붙여 넣어 주세요."
              aria-invalid={reviewState === "issue"}
              aria-describedby="review-rule"
              maxLength={10000}
            />
            <div className="editor-meta">
              <p id="review-rule"><strong>현재 검토 기준</strong> 문의·연락 안내가 있다면 전화번호 또는 이메일이 본문에 있어야 합니다.</p>
              <span>{documentText.length.toLocaleString()} / 10,000자</span>
            </div>
          </div>

          {emptyMessage && <p className="form-message" role="alert">{emptyMessage}</p>}

          <div className="form-actions">
            <button className="primary-button" type="button" onClick={review}>본문 누락 검토하기 <span>→</span></button>
            <button className="secondary-button" type="button" onClick={reset}>본문 지우기</button>
          </div>
        </div>

        <aside className="result-panel" aria-live="polite" aria-atomic="false">
          <div className="panel-heading result-heading">
            <div>
              <span className="panel-number">02</span>
              <div>
                <h3>배포 전 검토 결과</h3>
                <p>누락된 정보와 판단에 사용한 본문 문장을 함께 보여줍니다.</p>
              </div>
            </div>
          </div>

          {reviewState === "idle" && (
            <div className="empty-result">
              <div className="document-preview" aria-hidden="true">
                <span></span><span></span><span></span><b>✓</b>
              </div>
              <h4>아직 본문을 검토하지 않았습니다</h4>
              <p>왼쪽에 양식 전체 텍스트를 입력한 뒤<br />‘본문 누락 검토하기’를 눌러주세요.</p>
            </div>
          )}

          {reviewState === "issue" && (
            <div className="review-content single-issue-result">
              <div className="result-summary warning">
                <span className="summary-icon" aria-hidden="true">!</span>
                <div><strong>오류 1건</strong><p>배포 전에 문의처 정보를 추가해 주세요.</p></div>
              </div>

              <article className="issue-card contact-issue">
                <div className="issue-topline">
                  <span>01</span><strong>문의처 정보 누락</strong><b>오류</b>
                </div>
                <p className="evidence-label">오류 판단 근거 문장</p>
                <blockquote><mark>{evidence}</mark></blockquote>
                <p className="issue-explanation">
                  본문에서 문의처로 연락하라고 안내했지만 실제 전화번호나 이메일이 기재되어 있지 않습니다.
                </p>
                <div className="fix-guide">
                  <span>수정 예시</span>
                  <code>문의처: 새롬행정센터 02-1234-5678</code>
                </div>
              </article>

              <button className="next-button" type="button" onClick={() => editorRef.current?.focus()}>
                본문에 문의처 추가하기 <span>→</span>
              </button>
            </div>
          )}

          {reviewState === "complete" && (
            <div className="complete-result">
              <div className="complete-mark" aria-hidden="true">✓</div>
              <p className="result-kicker">배포 전 검토 완료</p>
              <h4>현재 기준에서 발견된<br />누락이 없습니다.</h4>
              <p>문의 안내와 문의처 정보가 함께 기재되어 있습니다. 배포 전 문구와 정보의 사실 여부를 최종 확인해 주세요.</p>
              <button className="next-button" type="button" onClick={review}>수정 내용 다시 검토하기 <span>↻</span></button>
            </div>
          )}

          {reviewState === "error" && (
            <div className="error-result" role="alert">
              <span aria-hidden="true">!</span>
              <h4>검토 결과를 만들지 못했습니다</h4>
              <p>입력한 본문은 유지되었습니다. 잠시 후 다시 검토해 주세요.</p>
              <button className="next-button" type="button" onClick={review}>다시 검토하기</button>
            </div>
          )}
        </aside>
      </section>

      <details className="feedback-note">
        <summary>부서 피드백에서 확인할 가정과 질문</summary>
        <div className="feedback-grid">
          <div><span>가정</span><p>양식 전체 본문을 한 번에 입력하는 방식이 세분화된 입력보다 담당자가 사용하기 쉽다.</p></div>
          <div><span>질문 1</span><p>본문 한 곳만 입력하는 현재 방식으로 검토를 시작하기 쉬운가?</p></div>
          <div><span>질문 2</span><p>누락 근거 문장과 수정 예시가 실제 양식 수정에 도움이 되는가?</p></div>
        </div>
      </details>

      <footer>문서체크 1-Day Prototype · 입력한 양식 내용은 브라우저를 벗어나 전송되지 않습니다.</footer>
    </main>
  );
}
