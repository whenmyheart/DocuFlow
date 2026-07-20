"use client";

import { useMemo, useRef, useState } from "react";

type FieldKey =
  | "documentTitle"
  | "applicantName"
  | "address"
  | "purpose"
  | "details"
  | "contact";

type FormValues = Record<FieldKey, string>;
type ReviewState = "idle" | "incomplete" | "complete" | "error";

const fields: Array<{
  key: FieldKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  {
    key: "documentTitle",
    label: "서류명",
    placeholder: "예: 주민편의시설 이용 신청서",
  },
  {
    key: "applicantName",
    label: "신청인 성명",
    placeholder: "예: 김가람",
  },
  {
    key: "address",
    label: "주소",
    placeholder: "예: 한빛시 새롬로 12",
  },
  {
    key: "purpose",
    label: "신청 목적",
    placeholder: "신청 목적을 구체적으로 입력해 주세요.",
    multiline: true,
  },
  {
    key: "details",
    label: "신청 내용",
    placeholder: "신청 대상과 요청 사항을 입력해 주세요.",
    multiline: true,
  },
  {
    key: "contact",
    label: "연락처",
    placeholder: "예: 010-1234-5678 (가상 번호)",
  },
];

const emptyValues: FormValues = {
  documentTitle: "",
  applicantName: "",
  address: "",
  purpose: "",
  details: "",
  contact: "",
};

const sampleValues: FormValues = {
  documentTitle: "주민편의시설 이용 신청서",
  applicantName: "김가람",
  address: "한빛시 새롬로 12",
  purpose: "지역 주민 대상 회의 공간을 이용하기 위해 신청합니다.",
  details: "2026년 8월 5일 오후 2시부터 4시까지 새롬회의실 이용을 요청합니다.",
  contact: "010-1234-5678",
};

function findMissing(values: FormValues) {
  return fields.filter(({ key }) => values[key].trim().length === 0);
}

export default function Home() {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [emptyMessage, setEmptyMessage] = useState("");
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const missingFields = useMemo(
    () => (reviewState === "idle" || reviewState === "error" ? [] : findMissing(values)),
    [reviewState, values],
  );

  const review = () => {
    setEmptyMessage("");

    if (Object.values(values).every((value) => value.trim().length === 0)) {
      setReviewState("idle");
      setEmptyMessage("작성 내용을 먼저 입력해 주세요. 한 항목 이상 입력하면 검토할 수 있습니다.");
      fieldRefs.current.documentTitle?.focus();
      return;
    }

    try {
      const missing = findMissing(values);
      setReviewState(missing.length > 0 ? "incomplete" : "complete");
    } catch {
      setReviewState("error");
    }
  };

  const updateValue = (key: FieldKey, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setEmptyMessage("");

    if (reviewState === "incomplete" || reviewState === "complete") {
      setReviewState(findMissing(next).length > 0 ? "incomplete" : "complete");
    }
  };

  const loadSample = () => {
    setValues(sampleValues);
    setReviewState("idle");
    setEmptyMessage("");
  };

  const reset = () => {
    setValues(emptyValues);
    setReviewState("idle");
    setEmptyMessage("");
    window.requestAnimationFrame(() => fieldRefs.current.documentTitle?.focus());
  };

  const focusFirstMissing = () => {
    const first = findMissing(values)[0];
    if (first) fieldRefs.current[first.key]?.focus();
  };

  const reviewed = reviewState === "incomplete" || reviewState === "complete";

  return (
    <main>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">문</div>
        <div>
          <p className="eyebrow">행정 문서 사전 검토</p>
          <h1>문서체크</h1>
        </div>
        <span className="prototype-badge">프로토타입</span>
      </header>

      <section className="intro" aria-labelledby="intro-title">
        <div>
          <p className="step-label">배포 전 마지막 한 번</p>
          <h2 id="intro-title">빠진 항목을 찾고,<br />바로 고쳐보세요.</h2>
          <p>신청서 내용을 항목별로 입력하면 필수 정보의 누락 여부와 근거를 한 화면에서 확인할 수 있습니다.</p>
        </div>
        <div className="trust-note">
          <span aria-hidden="true">i</span>
          <p><strong>가상 데이터 전용</strong>실제 개인정보는 입력하지 마세요. 현재 검토 결과는 실제 AI가 아닌 규칙 기반 예시입니다.</p>
        </div>
      </section>

      <section className="workspace" aria-label="문서 작성 및 검토">
        <div className="form-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-number">01</span>
              <div>
                <h3>신청서 내용 입력</h3>
                <p>필수 항목 6개 · 모든 데이터는 저장되지 않습니다.</p>
              </div>
            </div>
            <button className="text-button" type="button" onClick={loadSample}>가상 샘플 불러오기</button>
          </div>

          <div className="form-grid">
            {fields.map((field) => {
              const isMissing = reviewed && values[field.key].trim().length === 0;
              const commonProps = {
                id: field.key,
                value: values[field.key],
                placeholder: field.placeholder,
                onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  updateValue(field.key, event.target.value),
                "aria-invalid": isMissing,
                "aria-describedby": isMissing ? `${field.key}-error` : undefined,
                maxLength: field.multiline ? 500 : 100,
              };

              return (
                <div className={`field ${field.multiline ? "field-wide" : ""}`} key={field.key}>
                  <label htmlFor={field.key}>{field.label}<span>필수</span></label>
                  {field.multiline ? (
                    <textarea
                      {...commonProps}
                      rows={4}
                      ref={(node) => { fieldRefs.current[field.key] = node; }}
                    />
                  ) : (
                    <input
                      {...commonProps}
                      type="text"
                      ref={(node) => { fieldRefs.current[field.key] = node; }}
                    />
                  )}
                  {isMissing && <p className="field-error" id={`${field.key}-error`}>필수 내용이 비어 있습니다.</p>}
                </div>
              );
            })}
          </div>

          {emptyMessage && <p className="form-message" role="alert">{emptyMessage}</p>}

          <div className="form-actions">
            <button className="primary-button" type="button" onClick={review}>누락 항목 검토하기 <span>→</span></button>
            <button className="secondary-button" type="button" onClick={reset}>다시 입력</button>
          </div>
        </div>

        <aside className="result-panel" aria-live="polite" aria-atomic="false">
          <div className="panel-heading result-heading">
            <div>
              <span className="panel-number">02</span>
              <div>
                <h3>검토 결과</h3>
                <p>입력 내용과 누락 근거를 함께 표시합니다.</p>
              </div>
            </div>
          </div>

          {reviewState === "idle" && (
            <div className="empty-result">
              <div className="document-preview" aria-hidden="true">
                <span></span><span></span><span></span><b>✓</b>
              </div>
              <h4>아직 검토 전입니다</h4>
              <p>왼쪽의 항목을 입력한 뒤<br />‘누락 항목 검토하기’를 눌러주세요.</p>
            </div>
          )}

          {reviewState === "incomplete" && (
            <div className="review-content">
              <div className="result-summary warning">
                <span className="summary-icon" aria-hidden="true">!</span>
                <div><strong>누락 {missingFields.length}건</strong><p>배포 전 아래 항목을 보완해 주세요.</p></div>
              </div>
              <div className="result-list">
                {missingFields.map((field, index) => (
                  <article className="issue-card" key={field.key}>
                    <div className="issue-topline"><span>{String(index + 1).padStart(2, "0")}</span><strong>{field.label}</strong><b>누락</b></div>
                    <p className="evidence-label">판단 근거</p>
                    <p>“{field.label}” 입력란이 비어 있어 필수 내용을 확인할 수 없습니다.</p>
                  </article>
                ))}
              </div>
              <button className="next-button" type="button" onClick={focusFirstMissing}>첫 누락 항목 수정하기 <span>→</span></button>
            </div>
          )}

          {reviewState === "complete" && (
            <div className="complete-result">
              <div className="complete-mark" aria-hidden="true">✓</div>
              <p className="result-kicker">검토 완료</p>
              <h4>필수 항목이 모두<br />입력되었습니다.</h4>
              <p>현재 규칙 기준으로 발견된 누락이 없습니다. 배포 전 내용의 사실 여부를 최종 확인해 주세요.</p>
              <button className="next-button" type="button" onClick={review}>입력 내용 다시 검토하기 <span>↻</span></button>
            </div>
          )}

          {reviewState === "error" && (
            <div className="error-result" role="alert">
              <span aria-hidden="true">!</span>
              <h4>검토 결과를 만들지 못했습니다</h4>
              <p>입력 내용은 유지되었습니다. 잠시 후 다시 시도해 주세요.</p>
              <button className="next-button" type="button" onClick={review}>다시 검토하기</button>
            </div>
          )}
        </aside>
      </section>

      <details className="feedback-note">
        <summary>부서 피드백에서 확인할 가정과 질문</summary>
        <div className="feedback-grid">
          <div><span>가정</span><p>텍스트 작성칸을 세분화하면 누락 요소를 더 정확히 판별할 수 있다.</p></div>
          <div><span>질문 1</span><p>실제로 비슷한 양식의 문서를 작성할 때 기존 문서 검색에 시간이 소요되는가?</p></div>
          <div><span>질문 2</span><p>문서를 육안으로 검토할 때 수정하지 못하는 부분이 많은가?</p></div>
        </div>
      </details>

      <footer>문서체크 1-Day Prototype · 입력 내용은 브라우저를 벗어나 전송되지 않습니다.</footer>
    </main>
  );
}
