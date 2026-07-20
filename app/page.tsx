"use client";

import { useMemo, useRef, useState } from "react";

type FieldKey =
  | "formTitle"
  | "audience"
  | "applicationPeriod"
  | "submissionMethod"
  | "attachments"
  | "formFields"
  | "guidance";

type FormValues = Record<FieldKey, string>;
type ReviewState = "idle" | "issues" | "complete" | "error";

type Issue = {
  id: string;
  title: string;
  evidence: string;
  focusKey: FieldKey;
  kind: "누락" | "불일치";
};

const fields: Array<{
  key: FieldKey;
  label: string;
  helper: string;
  placeholder: string;
  multiline?: boolean;
  wide?: boolean;
}> = [
  {
    key: "formTitle",
    label: "양식명",
    helper: "배포할 신청서의 공식 명칭",
    placeholder: "예: 마을공유공간 이용 신청서",
    wide: true,
  },
  {
    key: "audience",
    label: "신청 대상·자격",
    helper: "누가 신청할 수 있는지",
    placeholder: "예: 한빛시 거주 주민 또는 관내 단체",
  },
  {
    key: "applicationPeriod",
    label: "신청 기간",
    helper: "접수 시작일과 마감일",
    placeholder: "예: 2026. 8. 1. ~ 2026. 8. 31.",
  },
  {
    key: "submissionMethod",
    label: "제출 방법·접수처",
    helper: "방문, 이메일 등 제출 경로",
    placeholder: "예: 새롬행정센터 방문 제출",
  },
  {
    key: "attachments",
    label: "필수 첨부서류",
    helper: "없다면 ‘없음’으로 입력",
    placeholder: "예: 단체 소개서 1부",
  },
  {
    key: "formFields",
    label: "신청서에 배치할 작성 항목",
    helper: "신청자가 직접 작성할 칸을 한 줄에 하나씩 입력",
    placeholder: "성명\n주소\n연락처\n이용 희망 일시\n이용 목적",
    multiline: true,
    wide: true,
  },
  {
    key: "guidance",
    label: "신청 안내문·본문",
    helper: "양식 상단이나 하단에 함께 배포할 안내 문구",
    placeholder: "신청 방법, 유의사항, 동의 및 서명 안내 등을 입력해 주세요.",
    multiline: true,
    wide: true,
  },
];

const emptyValues: FormValues = {
  formTitle: "",
  audience: "",
  applicationPeriod: "",
  submissionMethod: "",
  attachments: "",
  formFields: "",
  guidance: "",
};

const sampleValues: FormValues = {
  formTitle: "마을공유공간 이용 신청서",
  audience: "한빛시 거주 주민 또는 관내 단체",
  applicationPeriod: "2026. 8. 1. ~ 2026. 8. 31.",
  submissionMethod: "새롬행정센터 방문 제출",
  attachments: "단체 신청 시 단체 소개서 1부",
  formFields: "성명\n주소\n연락처\n이용 희망 일시\n이용 목적",
  guidance:
    "이용 신청자는 개인정보 수집·이용에 동의해야 하며, 신청서 하단에 서명해야 합니다. 단체 신청 시 단체 소개서를 첨부해 주세요.",
};

const contentRules: Array<{
  id: string;
  title: string;
  guidanceTerms: string[];
  fieldTerms: string[];
  focusKey: FieldKey;
}> = [
  {
    id: "signature",
    title: "서명란",
    guidanceTerms: ["서명"],
    fieldTerms: ["서명", "날인"],
    focusKey: "formFields",
  },
  {
    id: "privacy",
    title: "개인정보 수집·이용 동의 항목",
    guidanceTerms: ["개인정보", "수집·이용"],
    fieldTerms: ["개인정보", "동의"],
    focusKey: "formFields",
  },
  {
    id: "contact",
    title: "연락처 작성란",
    guidanceTerms: ["연락처", "전화"],
    fieldTerms: ["연락처", "전화", "휴대전화"],
    focusKey: "formFields",
  },
];

function includesAny(source: string, terms: string[]) {
  return terms.some((term) => source.includes(term));
}

function analyzeForm(values: FormValues): Issue[] {
  const issues: Issue[] = [];

  for (const field of fields) {
    if (!values[field.key].trim()) {
      issues.push({
        id: `empty-${field.key}`,
        title: field.label,
        evidence: `배포 전 확인이 필요한 “${field.label}” 내용이 입력되지 않았습니다.`,
        focusKey: field.key,
        kind: "누락",
      });
    }
  }

  const guidance = values.guidance.trim();
  const formFields = values.formFields.trim();

  if (guidance && formFields) {
    for (const rule of contentRules) {
      if (
        includesAny(guidance, rule.guidanceTerms) &&
        !includesAny(formFields, rule.fieldTerms)
      ) {
        const matchedTerm = rule.guidanceTerms.find((term) => guidance.includes(term));
        issues.push({
          id: `mismatch-${rule.id}`,
          title: rule.title,
          evidence: `안내문에는 “${matchedTerm}” 내용이 있지만 실제 작성 항목에는 해당 입력란이 없습니다.`,
          focusKey: rule.focusKey,
          kind: "불일치",
        });
      }
    }
  }

  if (
    values.attachments.trim() &&
    values.attachments.trim() !== "없음" &&
    guidance &&
    !includesAny(guidance, ["첨부", "제출서류", "구비서류"])
  ) {
    issues.push({
      id: "mismatch-attachments",
      title: "첨부서류 안내 문구",
      evidence: "필수 첨부서류가 설정되어 있지만 신청 안내문에는 첨부 또는 제출 안내가 없습니다.",
      focusKey: "guidance",
      kind: "불일치",
    });
  }

  return issues;
}

export default function Home() {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [emptyMessage, setEmptyMessage] = useState("");
  const fieldRefs = useRef<
    Partial<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement | null>>
  >({});

  const issues = useMemo(
    () => (reviewState === "issues" || reviewState === "complete" ? analyzeForm(values) : []),
    [reviewState, values],
  );

  const review = () => {
    setEmptyMessage("");

    if (Object.values(values).every((value) => !value.trim())) {
      setReviewState("idle");
      setEmptyMessage("검토할 양식 내용을 먼저 입력해 주세요. 가상 샘플로 흐름을 확인할 수도 있습니다.");
      fieldRefs.current.formTitle?.focus();
      return;
    }

    try {
      setReviewState(analyzeForm(values).length > 0 ? "issues" : "complete");
    } catch {
      setReviewState("error");
    }
  };

  const updateValue = (key: FieldKey, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setEmptyMessage("");

    if (reviewState === "issues" || reviewState === "complete") {
      setReviewState(analyzeForm(next).length > 0 ? "issues" : "complete");
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
    window.requestAnimationFrame(() => fieldRefs.current.formTitle?.focus());
  };

  const focusIssue = (issue: Issue) => {
    fieldRefs.current[issue.focusKey]?.focus();
  };

  const reviewed = reviewState === "issues" || reviewState === "complete";
  const issueKeys = new Set(issues.map((issue) => issue.focusKey));

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
          <p className="step-label">신청서 양식을 만드는 담당자를 위해</p>
          <h2 id="intro-title">양식을 올리기 전,<br />빠진 항목부터 확인하세요.</h2>
          <p>
            담당자가 설계한 양식의 구성과 안내문을 대조해 필수 정보 누락과 서로 맞지 않는 내용을 배포 전에 찾아냅니다.
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
        <span>01 양식 구성 입력</span><b>→</b><span>02 누락·불일치 검토</span><b>→</b><span>03 수정 후 배포 준비</span>
      </div>

      <section className="workspace" aria-label="신청서 양식 설계 및 검토">
        <div className="form-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-number">01</span>
              <div>
                <h3>배포할 양식 내용 입력</h3>
                <p>신청자 정보가 아니라, 담당자가 만들 신청서의 구성과 안내 문구를 입력합니다.</p>
              </div>
            </div>
            <button className="text-button" type="button" onClick={loadSample}>가상 양식 불러오기</button>
          </div>

          <div className="form-grid">
            {fields.map((field) => {
              const hasIssue = reviewed && issueKeys.has(field.key);
              const commonProps = {
                id: field.key,
                value: values[field.key],
                placeholder: field.placeholder,
                onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  updateValue(field.key, event.target.value),
                "aria-invalid": hasIssue,
                maxLength: field.multiline ? 1200 : 180,
              };

              return (
                <div className={`field ${field.wide ? "field-wide" : ""}`} key={field.key}>
                  <label htmlFor={field.key}>{field.label}<span>검토 대상</span></label>
                  <p className="field-helper">{field.helper}</p>
                  {field.multiline ? (
                    <textarea
                      {...commonProps}
                      rows={field.key === "guidance" ? 6 : 5}
                      ref={(node) => { fieldRefs.current[field.key] = node; }}
                    />
                  ) : (
                    <input
                      {...commonProps}
                      type="text"
                      ref={(node) => { fieldRefs.current[field.key] = node; }}
                    />
                  )}
                  {hasIssue && <p className="field-error">검토 결과에서 보완할 내용을 확인해 주세요.</p>}
                </div>
              );
            })}
          </div>

          {emptyMessage && <p className="form-message" role="alert">{emptyMessage}</p>}

          <div className="form-actions">
            <button className="primary-button" type="button" onClick={review}>양식 누락 검토하기 <span>→</span></button>
            <button className="secondary-button" type="button" onClick={reset}>새 양식 작성</button>
          </div>
        </div>

        <aside className="result-panel" aria-live="polite" aria-atomic="false">
          <div className="panel-heading result-heading">
            <div>
              <span className="panel-number">02</span>
              <div>
                <h3>배포 전 검토 결과</h3>
                <p>양식 구성과 안내문의 누락·불일치를 근거와 함께 표시합니다.</p>
              </div>
            </div>
          </div>

          {reviewState === "idle" && (
            <div className="empty-result">
              <div className="document-preview" aria-hidden="true">
                <span></span><span></span><span></span><b>✓</b>
              </div>
              <h4>아직 양식을 검토하지 않았습니다</h4>
              <p>왼쪽에 배포할 양식의 내용을 입력한 뒤<br />‘양식 누락 검토하기’를 눌러주세요.</p>
            </div>
          )}

          {reviewState === "issues" && (
            <div className="review-content">
              <div className="result-summary warning">
                <span className="summary-icon" aria-hidden="true">!</span>
                <div><strong>보완 필요 {issues.length}건</strong><p>배포하기 전에 아래 내용을 양식에 반영해 주세요.</p></div>
              </div>
              <div className="result-list">
                {issues.map((issue, index) => (
                  <article className="issue-card" key={issue.id}>
                    <div className="issue-topline">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{issue.title}</strong>
                      <b>{issue.kind}</b>
                    </div>
                    <p className="evidence-label">판단 근거</p>
                    <p>{issue.evidence}</p>
                    <button className="issue-fix" type="button" onClick={() => focusIssue(issue)}>해당 내용 수정하기</button>
                  </article>
                ))}
              </div>
              <button className="next-button" type="button" onClick={() => issues[0] && focusIssue(issues[0])}>
                첫 번째 보완 항목 수정하기 <span>→</span>
              </button>
            </div>
          )}

          {reviewState === "complete" && (
            <div className="complete-result">
              <div className="complete-mark" aria-hidden="true">✓</div>
              <p className="result-kicker">배포 전 검토 완료</p>
              <h4>현재 기준에서 발견된<br />누락이 없습니다.</h4>
              <p>양식 구성과 안내문의 필수 요소가 서로 일치합니다. 배포 전 문구와 일정의 사실 여부를 최종 확인해 주세요.</p>
              <button className="next-button" type="button" onClick={review}>수정 내용 다시 검토하기 <span>↻</span></button>
            </div>
          )}

          {reviewState === "error" && (
            <div className="error-result" role="alert">
              <span aria-hidden="true">!</span>
              <h4>검토 결과를 만들지 못했습니다</h4>
              <p>작성 중인 양식은 유지되었습니다. 잠시 후 다시 검토해 주세요.</p>
              <button className="next-button" type="button" onClick={review}>다시 검토하기</button>
            </div>
          )}
        </aside>
      </section>

      <details className="feedback-note">
        <summary>부서 피드백에서 확인할 가정과 질문</summary>
        <div className="feedback-grid">
          <div><span>가정</span><p>양식 구성과 안내문을 나누어 입력하면 담당자가 놓친 누락과 불일치를 더 정확히 찾을 수 있다.</p></div>
          <div><span>질문 1</span><p>자주 반복해서 사용하는 안내 문구와 실제로 자주 누락되는 양식 요소는 무엇인가?</p></div>
          <div><span>질문 2</span><p>오류나 누락을 발견하지 못한 채 신청서 양식을 배포한 경험이 있는가?</p></div>
        </div>
      </details>

      <footer>문서체크 1-Day Prototype · 입력한 양식 내용은 브라우저를 벗어나 전송되지 않습니다.</footer>
    </main>
  );
}
