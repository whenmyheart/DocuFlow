"use client";

import { useMemo, useRef, useState } from "react";

type ReviewState = "idle" | "issue" | "complete" | "error";

type ReviewRule = {
  id: string;
  label: string;
  title: string;
  trigger: RegExp;
  information: RegExp;
  explanation: string;
  fixExample: string;
};

type ReviewIssue = ReviewRule & { evidence: string };

const sampleText = `[마을공유공간 이용 신청 안내]

한빛시 주민과 관내 단체는 마을공유공간 이용을 신청할 수 있습니다.
신청 기간과 자세한 신청 방법은 아래 사이트에서 확인해 주세요.
문의가 있으신 분은 아래 기재되어 있는 문의처로 연락해 주세요.`;

const reviewRules: ReviewRule[] = [
  {
    id: "contact",
    label: "문의처",
    title: "문의처 정보 누락",
    trigger: /(문의처|문의가|문의\s|연락해\s*주|연락\s*바랍)/,
    information: /0\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}|\b1\d{2,3}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:문의처|담당부서|담당자|연락처)\s*(?:[:：]|은|는)\s*(?!아래|다음|별도|추후)[가-힣A-Z0-9][^\n.!?]{1,50}/i,
    explanation: "문의 또는 연락을 안내했지만 실제 전화번호나 이메일이 기재되어 있지 않습니다.",
    fixExample: "문의처: 새롬행정센터 02-1234-5678",
  },
  {
    id: "website",
    label: "사이트",
    title: "사이트 주소 누락",
    trigger: /(사이트|홈페이지|웹\s*사이트|링크|접속)/,
    information: /https?:\/\/\S+|www\.\S+|[a-z0-9-]+\.(?:go\.kr|or\.kr|co\.kr|kr|com|net)(?:\/\S*)?|(?:사이트|홈페이지)\s*(?:[:：]|은|는)\s*(?!아래|다음|별도|추후)[가-힣A-Z0-9][^\n.!?]{1,40}/i,
    explanation: "사이트 또는 홈페이지를 확인하라고 안내했지만 실제 웹 주소가 기재되어 있지 않습니다.",
    fixExample: "신청 사이트: https://example.go.kr",
  },
  {
    id: "period",
    label: "신청 기간",
    title: "신청 기간 정보 누락",
    trigger: /((신청|접수).{0,12}(기간|마감|기한)|마감일|기간\s*내)/,
    information: /20\d{2}\s*[년./-]\s*\d{1,2}|\d{1,2}\s*[월./-]\s*(?:\d{1,2}\s*일?)?|상시\s*(접수|신청)?|매월|공고일로부터\s*\d+\s*일|\d+\s*일간/,
    explanation: "신청 기간이나 마감일을 언급했지만 실제 날짜 또는 상시 접수 여부가 기재되어 있지 않습니다.",
    fixExample: "신청 기간: 2026. 8. 1. ~ 2026. 8. 31.",
  },
  {
    id: "submission",
    label: "제출처",
    title: "제출처 정보 누락",
    trigger: /(아래|다음).{0,12}(접수처|제출처|주소)|(?:접수처|제출처).{0,10}(방문|제출|접수)/,
    information: /(?:접수처|제출처|주소)\s*(?:[:：]|은|는)\s*(?!아래|다음|별도|추후)[^\n.!?]{2,}|[가-힣]+(?:센터|과|팀|부서)\s*(?:방문|접수|제출)?|(?:온라인|이메일|우편|방문)\s*(?:제출|접수)/,
    explanation: "접수처나 제출처를 안내했지만 실제 기관명 또는 주소가 기재되어 있지 않습니다.",
    fixExample: "제출처: 새롬행정센터 주민지원과",
  },
  {
    id: "attachment",
    label: "첨부서류",
    title: "첨부서류 정보 누락",
    trigger: /(첨부해|첨부하여|구비서류|제출서류|서류를\s*제출)/,
    information: /(?:첨부서류|구비서류|제출서류)\s*(?:[:：]|은|는)\s*(?!아래|다음|별도|추후)[^\n.!?]{2,}|(?:증명서|등본|사본|계획서|동의서|확인서|신분증)\s*(?:\d+\s*부)?/,
    explanation: "서류를 첨부하거나 제출하라고 안내했지만 실제 서류명이 기재되어 있지 않습니다.",
    fixExample: "첨부서류: 주민등록등본 1부",
  },
  {
    id: "fee",
    label: "비용",
    title: "비용 정보 누락",
    trigger: /(수수료|이용료|참가비|납부|입금)/,
    information: /무료|없음|면제|\d{1,3}(?:,\d{3})*\s*원|(?:일|이|삼|사|오|육|칠|팔|구|십|백|천|만)+\s*원|계좌\s*(?:[:：]|은|는)\s*[^\n.!?]{2,}|(?:은행|농협|신협)\s+\d/,
    explanation: "비용이나 납부를 안내했지만 실제 금액, 무료 여부 또는 납부 정보가 기재되어 있지 않습니다.",
    fixExample: "이용료: 무료",
  },
];

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?。]|다\.)\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function analyzeDocument(text: string): ReviewIssue[] {
  const sentences = splitSentences(text);

  return reviewRules.flatMap((rule) => {
    if (!rule.trigger.test(text) || rule.information.test(text)) return [];
    const evidence = sentences.find((sentence) => rule.trigger.test(sentence)) ?? text.trim();
    return [{ ...rule, evidence }];
  });
}

export default function Home() {
  const [documentText, setDocumentText] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [emptyMessage, setEmptyMessage] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const issues = useMemo(
    () => (reviewState === "issue" || reviewState === "complete" ? analyzeDocument(documentText) : []),
    [documentText, reviewState],
  );

  const review = () => {
    setEmptyMessage("");

    if (!documentText.trim()) {
      setReviewState("idle");
      setEmptyMessage("검토할 신청서 양식의 본문을 먼저 입력해 주세요.");
      editorRef.current?.focus();
      return;
    }

    try {
      setReviewState(analyzeDocument(documentText).length > 0 ? "issue" : "complete");
    } catch {
      setReviewState("error");
    }
  };

  const updateText = (value: string) => {
    setDocumentText(value);
    setEmptyMessage("");

    if (reviewState === "issue" || reviewState === "complete") {
      setReviewState(value.trim() && analyzeDocument(value).length > 0 ? "issue" : value.trim() ? "complete" : "idle");
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
          <p>담당자가 만든 신청서 양식의 전체 본문을 입력하면, 안내한 내용과 실제로 적힌 정보가 일치하는지 확인합니다.</p>
        </div>
        <div className="trust-note">
          <span aria-hidden="true">i</span>
          <p><strong>가상 양식으로 검토해 주세요</strong>실제 개인정보는 입력하지 마세요. 현재 검토 결과는 실제 AI가 아닌 규칙 기반 예시입니다.</p>
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
            <div className="editor-meta expanded-criteria">
              <div id="review-rule">
                <p><strong>검토 항목</strong> 본문에서 안내한 항목에 실제 정보가 함께 기재되어 있는지 확인합니다.</p>
                <div className="review-tags" aria-label="검토 가능한 정보">
                  {reviewRules.map((rule) => <span key={rule.id}>{rule.label}</span>)}
                </div>
              </div>
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
              <div className="document-preview" aria-hidden="true"><span></span><span></span><span></span><b>✓</b></div>
              <h4>아직 본문을 검토하지 않았습니다</h4>
              <p>왼쪽에 양식 전체 텍스트를 입력한 뒤<br />‘본문 누락 검토하기’를 눌러주세요.</p>
            </div>
          )}

          {reviewState === "issue" && (
            <div className="review-content">
              <div className="result-summary warning">
                <span className="summary-icon" aria-hidden="true">!</span>
                <div><strong>오류 {issues.length}건</strong><p>안내했지만 기재하지 않은 정보를 추가해 주세요.</p></div>
              </div>

              <div className="result-list multi-rule-results">
                {issues.map((issue, index) => (
                  <article className="issue-card contact-issue" key={issue.id}>
                    <div className="issue-topline">
                      <span>{String(index + 1).padStart(2, "0")}</span><strong>{issue.title}</strong><b>오류</b>
                    </div>
                    <p className="evidence-label">오류 판단 근거 문장</p>
                    <blockquote><mark>{issue.evidence}</mark></blockquote>
                    <p className="issue-explanation">{issue.explanation}</p>
                    <div className="fix-guide">
                      <span>수정 예시 · 형식은 자유입니다</span>
                      <code>{issue.fixExample}</code>
                      <small>위 문구와 같지 않아도 실제 정보가 확인되면 기재된 것으로 인식합니다.</small>
                    </div>
                  </article>
                ))}
              </div>

              <button className="next-button" type="button" onClick={() => editorRef.current?.focus()}>
                본문에 누락 정보 추가하기 <span>→</span>
              </button>
            </div>
          )}

          {reviewState === "complete" && (
            <div className="complete-result">
              <div className="complete-mark" aria-hidden="true">✓</div>
              <p className="result-kicker">배포 전 검토 완료</p>
              <h4>현재 기준에서 발견된<br />누락이 없습니다.</h4>
              <p>본문에서 안내한 항목과 실제 정보가 함께 기재되어 있습니다. 배포 전 내용의 사실 여부를 최종 확인해 주세요.</p>
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

      <footer>문서체크 1-Day Prototype · 입력한 양식 내용은 브라우저를 벗어나 전송되지 않습니다.</footer>
    </main>
  );
}
