"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteCloudDocument,
  loadCloudDocuments,
  saveCloudDocument,
  updateCloudDocumentTitle,
  type CloudDocument,
} from "@/lib/firebase-documents";
import {
  generateDocumentWithAi,
  reviewGeneratedDocumentWithAi,
  searchDocumentsWithAi,
  type AiDocumentReview,
} from "@/lib/ai-review";

type DocumentType = {
  id: string;
  name: string;
  description: string;
  symbol: string;
  fields: Array<{ id: string; label: string; placeholder: string; wide?: boolean }>;
};

const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: "notice",
    name: "공지문",
    symbol: "알림",
    description: "일정과 참여 방법을 한눈에 전달하는 안내문",
    fields: [
      { id: "subject", label: "공지 제목", placeholder: "예: 여름방학 도서관 운영 안내", wide: true },
      { id: "audience", label: "안내 대상", placeholder: "예: 재학생 및 교직원" },
      { id: "organizer", label: "담당 부서·기관", placeholder: "예: 강남대학교 학술정보팀" },
      { id: "schedule", label: "기간·일시", placeholder: "예: 2026. 8. 1. ~ 8. 31." },
      { id: "location", label: "장소·접속 주소", placeholder: "예: 강남대학교 중앙도서관 1층" },
      { id: "method", label: "신청·참여 방법", placeholder: "예: 학교 포털에서 신청", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 학술정보팀 031-1234-5678" },
    ],
  },
  {
    id: "application",
    name: "신청서 양식",
    symbol: "접수",
    description: "작성자가 채워 제출할 항목과 안내를 구성하는 양식",
    fields: [
      { id: "applicationName", label: "양식 제목", placeholder: "예: 교내 동아리 활동비 지원 신청서", wide: true },
      { id: "audience", label: "신청 대상", placeholder: "예: 교내 등록 동아리" },
      { id: "organizer", label: "담당 부서·기관", placeholder: "예: 강남대학교 학생지원팀" },
      { id: "purpose", label: "신청 안내·목적", placeholder: "예: 동아리의 자율적인 활동과 행사 운영을 지원", wide: true },
      { id: "collectionFields", label: "신청자에게 받을 정보", placeholder: "예: 성명, 학번, 소속, 전화번호, 신청 사유, 지원 금액", wide: true },
      { id: "period", label: "신청 기간", placeholder: "예: 2026. 8. 1. ~ 8. 10." },
      { id: "submission", label: "제출 방법·제출처", placeholder: "예: 학생 포털에서 작성 후 제출", wide: true },
      { id: "attachments", label: "필요한 첨부서류", placeholder: "예: 활동 계획서, 예산 사용 계획서", wide: true },
      { id: "confirmation", label: "확인·동의 문구", placeholder: "예: 기재 내용이 사실임을 확인합니다.", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 학생지원팀 031-1234-5678" },
    ],
  },
  {
    id: "proposal",
    name: "기획서",
    symbol: "기획",
    description: "아이디어의 배경부터 실행 계획까지 설득력 있게 정리",
    fields: [
      { id: "projectName", label: "기획명", placeholder: "예: 캠퍼스 플리마켓 운영", wide: true },
      { id: "proposer", label: "기획자·부서", placeholder: "예: 강남대학교 총학생회" },
      { id: "target", label: "대상", placeholder: "예: 전체 재학생" },
      { id: "background", label: "기획 배경", placeholder: "예: 학생 간 교류와 자원 순환 활성화", wide: true },
      { id: "goal", label: "목표", placeholder: "예: 참여 부스 30개 모집", wide: true },
      { id: "plan", label: "주요 실행 계획", placeholder: "예: 참가팀 모집, 부스 배치, 현장 운영", wide: true },
      { id: "schedule", label: "일정", placeholder: "예: 9월 모집, 10월 행사 진행" },
      { id: "budget", label: "예산", placeholder: "예: 총 200만 원" },
    ],
  },
  {
    id: "report",
    name: "보고서",
    symbol: "보고",
    description: "업무 과정과 결과, 후속 계획을 명료하게 보고",
    fields: [
      { id: "reportTitle", label: "보고서 제목", placeholder: "예: 2026 상반기 만족도 조사 결과", wide: true },
      { id: "author", label: "작성자·부서", placeholder: "예: 강남대학교 기획예산팀" },
      { id: "period", label: "대상 기간", placeholder: "예: 2026. 1. ~ 6." },
      { id: "purpose", label: "보고 목적", placeholder: "예: 사업 성과와 개선사항 공유", wide: true },
      { id: "activities", label: "주요 내용", placeholder: "예: 설문 520건 분석, 인터뷰 12회", wide: true },
      { id: "results", label: "성과·결과", placeholder: "예: 평균 만족도 4.3점", wide: true },
      { id: "issues", label: "문제점·개선사항", placeholder: "예: 응답률 제고 방안 필요", wide: true },
      { id: "next", label: "향후 계획", placeholder: "예: 9월 개선안 시범 운영", wide: true },
    ],
  },
  {
    id: "minutes",
    name: "회의록",
    symbol: "회의",
    description: "논의 내용과 결정 사항, 담당 업무를 정확히 기록",
    fields: [
      { id: "meetingName", label: "회의명", placeholder: "예: 제3차 축제 준비위원회", wide: true },
      { id: "dateTime", label: "일시", placeholder: "예: 2026. 8. 3. 14:00" },
      { id: "location", label: "장소", placeholder: "예: 본관 2층 회의실" },
      { id: "attendees", label: "참석자", placeholder: "예: 김하늘, 이가람, 박새봄", wide: true },
      { id: "agenda", label: "안건", placeholder: "예: 행사 동선과 안전관리 계획", wide: true },
      { id: "discussion", label: "주요 논의", placeholder: "예: 입구를 동문으로 일원화", wide: true },
      { id: "decisions", label: "결정 사항", placeholder: "예: 안전요원 8명 배치", wide: true },
      { id: "actions", label: "후속 업무·담당자", placeholder: "예: 배치도 수정 — 김하늘, 8월 7일까지", wide: true },
    ],
  },
  {
    id: "event",
    name: "행사 안내문",
    symbol: "행사",
    description: "행사 소개부터 참여 방법까지 친절하게 안내",
    fields: [
      { id: "eventName", label: "행사명", placeholder: "예: 2026 진로 탐색 주간", wide: true },
      { id: "audience", label: "참여 대상", placeholder: "예: 1~4학년 재학생" },
      { id: "host", label: "주최·주관", placeholder: "예: 강남대학교 대학일자리플러스센터" },
      { id: "dateTime", label: "일시", placeholder: "예: 9월 14일 10:00~17:00" },
      { id: "location", label: "장소", placeholder: "예: 샬롬관 대강당" },
      { id: "program", label: "주요 프로그램", placeholder: "예: 직무 상담, 현직자 특강, 모의 면접", wide: true },
      { id: "participation", label: "참여 방법", placeholder: "예: 포털 사전 신청, 현장 참여 가능", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 대학일자리플러스센터 031-1234-5678" },
    ],
  },
  {
    id: "official",
    name: "협조 공문",
    symbol: "공문",
    description: "다른 부서나 기관에 협조 사항을 정중하게 요청",
    fields: [
      { id: "recipient", label: "수신", placeholder: "예: 각 학과장" },
      { id: "sender", label: "발신", placeholder: "예: 학생처장" },
      { id: "subject", label: "제목", placeholder: "예: 학생 설문조사 참여 협조 요청", wide: true },
      { id: "background", label: "요청 배경·목적", placeholder: "예: 교육환경 개선을 위한 의견 수렴", wide: true },
      { id: "request", label: "협조 요청 사항", placeholder: "예: 소속 학생에게 설문 링크 안내", wide: true },
      { id: "deadline", label: "기한", placeholder: "예: 2026. 8. 14.까지" },
      { id: "contact", label: "담당자·문의처", placeholder: "예: 학생지원팀 담당자 031-1234-5678" },
    ],
  },
  {
    id: "custom",
    name: "자유 문서",
    symbol: "자유",
    description: "정해진 형식 없이 목적에 맞는 문서를 새로 구성",
    fields: [
      { id: "title", label: "문서 제목", placeholder: "예: 새 학기 운영 방향 안내", wide: true },
      { id: "author", label: "작성자·부서", placeholder: "예: 강남대학교 교무팀" },
      { id: "audience", label: "읽는 사람", placeholder: "예: 전 부서 구성원" },
      { id: "purpose", label: "작성 목적", placeholder: "예: 변경된 업무 절차 안내", wide: true },
      { id: "details", label: "반드시 들어갈 내용", placeholder: "예: 변경 사항, 시행일, 담당자 역할", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 교무팀 031-1234-5678" },
    ],
  },
];

const SAMPLE_VALUES: Record<string, Record<string, string>> = {
  notice: {
    subject: "여름방학 중앙도서관 운영 안내",
    audience: "재학생 및 교직원",
    organizer: "강남대학교 학술정보팀",
    schedule: "2026. 7. 27. ~ 2026. 8. 21., 평일 09:00~18:00",
    location: "강남대학교 중앙도서관",
    method: "별도 신청 없이 학생증을 지참해 방문해 주세요.",
    contact: "학술정보팀 031-1234-5678",
  },
  application: {
    applicationName: "2026 교내 동아리 활동비 지원 신청서",
    audience: "교내 등록 동아리",
    organizer: "강남대학교 학생지원팀",
    purpose: "동아리의 자율적인 활동과 교내 행사 운영을 지원합니다.",
    collectionFields: "동아리명, 대표자 성명, 학번, 소속, 전화번호, 신청 사유, 지원 요청 금액",
    period: "2026. 8. 1. ~ 2026. 8. 10.",
    submission: "학생 포털에서 작성 후 제출",
    attachments: "활동 계획서, 예산 사용 계획서",
    confirmation: "위 기재 내용이 사실임을 확인합니다.",
    contact: "학생지원팀 031-1234-5678",
  },
  proposal: {
    projectName: "캠퍼스 플리마켓 운영 기획",
    proposer: "강남대학교 총학생회",
    target: "전체 재학생",
    background: "학생 간 교류와 자원 순환을 활성화하기 위해 기획했습니다.",
    goal: "참여 부스 30개 모집 및 재학생 300명 참여",
    plan: "참가팀 모집, 부스 배치, 현장 안내와 안전 관리를 진행합니다.",
    schedule: "2026년 9월 모집, 10월 행사 진행",
    budget: "총 200만 원",
  },
  report: {
    reportTitle: "2026 상반기 민원 만족도 조사 결과 보고",
    author: "강남대학교 기획예산팀",
    period: "2026. 1. ~ 6.",
    purpose: "상반기 민원 서비스 성과와 개선 사항을 공유합니다.",
    activities: "설문 520건 분석 및 담당자 인터뷰 12회",
    results: "평균 만족도 4.3점, 응답 시간 18% 단축",
    issues: "모바일 설문 응답률 개선이 필요합니다.",
    next: "2026년 9월 개선안을 시범 운영합니다.",
  },
  minutes: {
    meetingName: "제2차 축제 준비위원회",
    dateTime: "2026. 8. 3. 14:00",
    location: "본관 2층 회의실",
    attendees: "김하늘, 이가람, 박새봄",
    agenda: "행사 동선과 안전 관리 계획",
    discussion: "입구를 정문으로 일원화하고 안내 표지를 추가합니다.",
    decisions: "안전요원 8명을 배치하기로 결정했습니다.",
    actions: "김하늘이 8월 7일까지 배치도를 수정합니다.",
  },
  event: {
    eventName: "2026 진로 탐색 주간",
    audience: "1~4학년 재학생",
    host: "강남대학교 대학일자리플러스센터",
    dateTime: "2026. 9. 14. 10:00~17:00",
    location: "샬롬관 대강당",
    program: "직무 상담, 현직자 특강, 모의 면접",
    participation: "학생 포털에서 사전 신청하거나 현장에서 참여할 수 있습니다.",
    contact: "대학일자리플러스센터 031-1234-5678",
  },
  official: {
    recipient: "각 학과장",
    sender: "학생처장",
    subject: "학생 설문조사 참여 협조 요청",
    background: "교육 환경 개선을 위한 재학생 의견을 수렴하고자 합니다.",
    request: "소속 학생에게 설문 링크를 안내해 주세요.",
    deadline: "2026. 8. 14.까지",
    contact: "학생지원팀 담당자 031-1234-5678",
  },
  custom: {
    title: "새 학기 민원 접수 절차 안내",
    author: "강남대학교 교무팀",
    audience: "전 부서 구성원",
    purpose: "변경된 민원 접수 절차를 안내합니다.",
    details: "온라인 접수를 우선하며, 긴급 민원은 담당자에게 전화로 알려 주세요.",
    contact: "교무팀 031-1234-5678",
  },
};

type GenerationState = "idle" | "loading" | "complete" | "error";
type SearchState = "idle" | "loading" | "complete" | "error";
type ReviewState = "idle" | "loading" | "complete";
type ExportPreviewFormat = "word" | "pdf" | "hwpx";
type AppView = "landing" | "types" | "editor" | "storage";

const AUTOSAVE_DRAFT_KEY = "docuflow-current-draft";

type AutosavedDraft = {
  selectedTypeId: string;
  freeformInput: string;
  additionalRequest: string;
  generatedText: string;
  generationSummary: string;
  documentName: string;
  savedAt: number;
};

const EXPORT_FORMAT_LABELS: Record<ExportPreviewFormat, string> = {
  word: "Word",
  pdf: "PDF",
  hwpx: "한글(HWPX)",
};

const EXPORT_FORMAT_DESCRIPTIONS: Record<ExportPreviewFormat, string> = {
  word: "파란색 제목과 선명한 정보 표를 사용한 업무 문서 스타일",
  pdf: "배포와 인쇄에 적합한 절제된 녹색 강조 스타일",
  hwpx: "명조 계열 글꼴과 흑백 구성을 사용한 공공문서 스타일",
};

type DraftBlock = {
  sourceIndex: number;
  kind: "title" | "heading" | "information" | "bullet" | "important" | "body";
  text: string;
  label?: string;
  value?: string;
};

function createDraftBlocks(text: string): DraftBlock[] {
  const lines = text.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim());

  return lines.flatMap((rawLine, sourceIndex) => {
    const line = rawLine.trim();
    if (!line) return [];
    if (sourceIndex === firstContentIndex) return [{ sourceIndex, kind: "title" as const, text: line.replace(/^\[|\]$/g, "") }];

    const information = line.match(/^([^:：]{1,20})[:：]\s*(.+)$/);
    if (information) return [{ sourceIndex, kind: "information" as const, text: line, label: information[1], value: information[2] }];
    if (/^(?:[-•]|\d+[.)])\s*/.test(line)) return [{ sourceIndex, kind: "bullet" as const, text: line.replace(/^(?:[-•]|\d+[.)])\s*/, "") }];
    if (/^(?:중요|주의|필수|반드시|마감)/.test(line)) return [{ sourceIndex, kind: "important" as const, text: line }];
    if (line.length <= 30 && (!/[.!?。]$/.test(line) || /[:：]$/.test(line))) {
      return [{ sourceIndex, kind: "heading" as const, text: line.replace(/[:：]$/, "") }];
    }
    return [{ sourceIndex, kind: "body" as const, text: line }];
  });
}

function formatKoreanDocumentDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}. ${month}. ${day}.`;
}

function DraftEditor({ text, onChange, editorRef, documentTypeId, highlightedText }: { text: string; onChange: (value: string) => void; editorRef: React.RefObject<HTMLDivElement | null>; documentTypeId: string; highlightedText?: string }) {
  const blocks = useMemo(() => createDraftBlocks(text), [text]);
  const highlightedSourceIndex = useMemo(() => {
    const target = highlightedText?.trim();
    if (!target) return -1;
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      if (block.text.trim() === target || block.value?.trim() === target) return block.sourceIndex;
    }
    return -1;
  }, [blocks, highlightedText]);

  const updateLine = (sourceIndex: number, value: string) => {
    const lines = text.split(/\r?\n/);
    lines[sourceIndex] = value.replace(/\s+/g, " ").trim();
    onChange(lines.join("\n"));
  };

  const highlightProps = (sourceIndex: number) => (
    sourceIndex === highlightedSourceIndex ? { className: "draft-added-highlight", "data-review-highlight": "true" } : {}
  );

  return (
    <div className={`formatted-document document-template-${documentTypeId}`} id="generatedDocument" ref={editorRef} tabIndex={-1} aria-label="생성된 문서 편집 영역">
      {blocks.map((block) => {
        if (block.kind === "title") return <h3 key={block.sourceIndex} {...highlightProps(block.sourceIndex)} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</h3>;
        if (block.kind === "heading") return <h4 key={block.sourceIndex} {...highlightProps(block.sourceIndex)} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</h4>;
        if (block.kind === "information") return <div className={`draft-information${block.sourceIndex === highlightedSourceIndex ? " draft-added-highlight" : ""}`} data-review-highlight={block.sourceIndex === highlightedSourceIndex ? "true" : undefined} key={block.sourceIndex}><strong>{block.label}</strong><span contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, `${block.label}: ${event.currentTarget.textContent ?? ""}`)}>{block.value}</span></div>;
        if (block.kind === "bullet") return <p className={`draft-bullet${block.sourceIndex === highlightedSourceIndex ? " draft-added-highlight" : ""}`} data-review-highlight={block.sourceIndex === highlightedSourceIndex ? "true" : undefined} key={block.sourceIndex} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, `- ${event.currentTarget.textContent ?? ""}`)}>{block.text}</p>;
        if (block.kind === "important") return <p className={`draft-important${block.sourceIndex === highlightedSourceIndex ? " draft-added-highlight" : ""}`} data-review-highlight={block.sourceIndex === highlightedSourceIndex ? "true" : undefined} key={block.sourceIndex} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</p>;
        return <p key={block.sourceIndex} {...highlightProps(block.sourceIndex)} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</p>;
      })}
    </div>
  );
}

function ExportPreviewDocument({ text, details, documentTypeId }: { text: string; details: Array<{ label: string; value: string }>; documentTypeId: string }) {
  const blocks = createDraftBlocks(text);
  const [titleBlock, ...bodyBlocks] = blocks;
  const renderBlock = (block: DraftBlock) => {
    if (block.kind === "title") return <h1 key={block.sourceIndex}>{block.text}</h1>;
    if (block.kind === "heading") return <h2 key={block.sourceIndex}>{block.text}</h2>;
    if (block.kind === "information") return <div className="preview-information" key={block.sourceIndex}><strong>{block.label}</strong><span>{block.value}</span></div>;
    if (block.kind === "bullet") return <p className="preview-bullet" key={block.sourceIndex}>• {block.text}</p>;
    if (block.kind === "important") return <p className="preview-important" key={block.sourceIndex}>{block.text}</p>;
    return <p key={block.sourceIndex}>{block.text}</p>;
  };
  const documentTitle = titleBlock?.text ?? "문서";
  const narrativeBlocks = bodyBlocks.filter((block) => block.kind !== "information");
  const approvalBox = (
    <table className="template-approval" aria-label="결재란"><tbody><tr>
      <th>결재</th><td>담당</td><td>과장</td><td>부장</td><td>이사</td>
    </tr></tbody></table>
  );
  const titleWithApproval = (title: string) => (
    <header className="template-title-with-approval">
      <div className="template-approval-cell">{approvalBox}</div>
      <h1>{title}</h1>
    </header>
  );
  const detailRows = (rows = details) => (
    <table className="template-table"><tbody>
      {rows.map((detail) => <tr className="template-table-row" key={detail.label}><th>{detail.label}</th><td>{detail.value}</td></tr>)}
    </tbody></table>
  );

  if (documentTypeId === "notice") {
    const introductionIndex = bodyBlocks.findIndex((block) => block.kind === "body");
    const introduction = introductionIndex >= 0 ? bodyBlocks[introductionIndex] : null;
    const detailBlocks = bodyBlocks.filter((block, index) => index !== introductionIndex && block.kind !== "information");
    const footerDepartment = details.find((detail) => /담당|부서|기관|주관|작성/.test(detail.label))?.value ?? "담당 부서";
    const noticeItems = [
      ...details.map((detail) => ({ label: detail.label, value: detail.value })),
      ...detailBlocks.map((block) => ({ label: block.kind === "heading" ? block.text : "기타사항", value: block.text })),
    ].filter((item) => item.value.trim());

    return (
      <article className="export-preview-document official-notice-preview" aria-label="내보낼 문서 미리보기">
        <header className="official-notice-header">
          <div className="official-notice-rule" aria-hidden="true"><span /></div>
          <h1>{titleBlock?.text ?? "공지"}</h1>
          <div className="official-notice-rule" aria-hidden="true"><span /></div>
        </header>
        {introduction && <div className="official-notice-intro">{renderBlock(introduction)}</div>}
        {noticeItems.length > 0 && (
          <ol className="official-notice-list">
            {noticeItems.map((item, index) => (
              <li key={`${item.label}-${index}`}>
                <strong>{item.label}:</strong>
                <span>{item.value}</span>
              </li>
            ))}
          </ol>
        )}
        <footer className="official-notice-footer">
          <p>{formatKoreanDocumentDate()}</p>
          <strong>{footerDepartment}</strong>
        </footer>
        {detailBlocks.length === 0 && details.length === 0 && !introduction && (
          <p className="official-notice-empty">공지 내용을 입력하면 안내 항목이 이 위치에 정리됩니다.</p>
        )}
      </article>
    );
  }

  if (documentTypeId === "application") {
    const collection = details.find((detail) => /받을 정보|기재 항목/.test(detail.label));
    const formItems = collection?.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) ?? [];
    const guidanceRows = details.filter((detail) => detail !== collection);
    return (
      <article className="export-preview-document form-template application-template" aria-label="신청서 양식 미리보기">
        {titleWithApproval(documentTitle)}
        {guidanceRows.length > 0 && <section><h2>신청 안내</h2>{detailRows(guidanceRows)}</section>}
        <section><h2>신청자 작성란</h2>
          <table className="application-entry-grid"><tbody>
            {(formItems.length ? formItems : ["성명", "연락처", "소속", "신청 내용"]).map((item) => <tr key={item}><th>{item}</th><td aria-label={`${item} 작성란`} /></tr>)}
          </tbody></table>
        </section>
      </article>
    );
  }

  if (documentTypeId === "proposal") {
    return (
      <article className="export-preview-document form-template proposal-template" aria-label="기획서 미리보기">
        <h1>{documentTitle}</h1>
        {detailRows(details.slice(0, 3))}
        {details.slice(3).map((detail) => (
          <section className="template-section-block" key={detail.label}>
            <h2 className="template-section-heading">{detail.label}</h2>
            <p className="template-section-body">{detail.value}</p>
          </section>
        ))}
        {narrativeBlocks.length > 0 && (
          <section className="template-section-block">
            <h2 className="template-section-heading">세부 실행 내용</h2>
            <div className="template-section-content">{narrativeBlocks.map(renderBlock)}</div>
          </section>
        )}
      </article>
    );
  }

  if (documentTypeId === "report" || documentTypeId === "minutes") {
    const isMinutes = documentTypeId === "minutes";
    return (
      <article className={`export-preview-document form-template ${isMinutes ? "minutes-template" : "report-template"}`} aria-label={`${isMinutes ? "회의록" : "보고서"} 미리보기`}>
        {titleWithApproval(isMinutes ? "회 의 록" : "보 고 서")}
        <table className="template-document-subject"><tbody><tr><th>{isMinutes ? "회의명" : "제목"}</th><td>{documentTitle}</td></tr></tbody></table>
        {detailRows(details.slice(0, isMinutes ? 4 : 3))}
        {narrativeBlocks.length > 0 && (
          <section className="template-section-block">
            <h2 className="template-section-heading">{isMinutes ? "회의 내용" : "보고 내용"}</h2>
            <div className="template-section-content">{narrativeBlocks.map(renderBlock)}</div>
          </section>
        )}
        {details.slice(isMinutes ? 4 : 3).map((detail) => (
          <section className="template-section-block" key={detail.label}>
            <h2 className="template-section-heading">{detail.label}</h2>
            <p className="template-section-body">{detail.value}</p>
          </section>
        ))}
      </article>
    );
  }

  if (documentTypeId === "event") {
    const featuredDetails = details.filter((detail) => /일시|장소/.test(detail.label));
    const remainingDetails = details.filter((detail) => !featuredDetails.includes(detail));
    return (
      <article className="export-preview-document event-template" aria-label="행사 안내문 미리보기">
        <span className="event-kicker">EVENT INFORMATION</span>
        <h1>{documentTitle}</h1>
        <div className="event-accent" aria-hidden="true" />
        <div className="event-featured">{featuredDetails.map((detail) => <p key={detail.label}><strong>{detail.label}</strong><span>{detail.value}</span></p>)}</div>
        <div className="event-body">{narrativeBlocks.map(renderBlock)}</div>
        {detailRows(remainingDetails)}
      </article>
    );
  }

  if (documentTypeId === "official") {
    return (
      <article className="export-preview-document official-letter-template" aria-label="협조 공문 미리보기">
        <header><div><span>WORK COOPERATION NOTICE</span><h1>업무 협조공문</h1></div>{approvalBox}</header>
        {detailRows(details)}
        <p className="official-letter-subject">{documentTitle}</p>
        <div className="official-letter-body">{narrativeBlocks.map(renderBlock)}</div>
        <footer><p>위와 같이 협조를 요청드립니다.</p><strong>DocuFlow</strong></footer>
      </article>
    );
  }

  return (
    <article className="export-preview-document" aria-label="내보낼 문서 미리보기">
      {titleBlock && renderBlock(titleBlock)}
      {details.length > 0 && (
        <section className="preview-overview" aria-labelledby="preview-overview-heading">
          <h2 id="preview-overview-heading">문서 주요 정보</h2>
          <div className="preview-overview-grid">
            {details.map((detail) => <div className="preview-information" key={detail.label}><strong>{detail.label}</strong><span>{detail.value}</span></div>)}
          </div>
        </section>
      )}
      {details.length > 0 && bodyBlocks.length > 0 && <h2 className="preview-body-heading">상세 내용</h2>}
      {bodyBlocks.map(renderBlock)}
    </article>
  );
}

function PaginatedExportPreview({ text, details, documentTypeId, format }: { text: string; details: Array<{ label: string; value: string }>; documentTypeId: string; format: ExportPreviewFormat }) {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<Array<{ className: string; html: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    const paginate = async () => {
      await document.fonts?.ready;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      if (cancelled) return;
      const source = sourceRef.current?.querySelector<HTMLElement>(".export-preview-document");
      if (!source) return;
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-10000px";
      host.style.top = "0";
      host.style.width = "210mm";
      host.style.visibility = "hidden";
      document.body.appendChild(host);
      const pageNodes = createPaginatedPreviewPages(source, host);
      if (!cancelled) setPages(pageNodes.map((page) => ({
        className: page.className,
        html: `${page.innerHTML}<span class="document-page-frame" aria-hidden="true"></span>`,
      })));
      host.remove();
    };
    void paginate();
    return () => { cancelled = true; };
  }, [details, documentTypeId, format, text]);

  return (
    <>
      <div className="export-preview-measure-source" ref={sourceRef} aria-hidden="true">
        <ExportPreviewDocument text={text} details={details} documentTypeId={documentTypeId} />
      </div>
      <div className="export-preview-pages" aria-label={`미리보기 ${pages.length || 1}페이지`}>
        {pages.length > 0
          ? pages.map((page, index) => <article className={page.className} dangerouslySetInnerHTML={{ __html: page.html }} key={index} />)
          : <ExportPreviewDocument text={text} details={details} documentTypeId={documentTypeId} />}
      </div>
    </>
  );
}

function formatSavedAt(savedAt: number) {
  return new Date(savedAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

const INLINE_EXPORT_STYLES = [
  "display", "width", "max-width", "box-sizing",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-collapse",
  "background-color", "color", "font-family", "font-size", "font-weight", "font-style",
  "line-height", "letter-spacing", "text-align", "vertical-align", "white-space", "writing-mode",
  "break-before", "break-after", "break-inside", "page-break-before", "page-break-after", "page-break-inside",
] as const;

function getStyledPreviewClone(sourceOverride?: HTMLElement) {
  const source = sourceOverride
    ?? document.querySelector<HTMLElement>(".export-preview-overlay .export-preview-document")
    ?? document.querySelector<HTMLElement>(".export-preview-document");
  if (!source) throw new Error("Export preview unavailable");
  const clone = source.cloneNode(true) as HTMLElement;
  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const clonedElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  sourceElements.forEach((element, index) => {
    const target = clonedElements[index];
    if (!target) return;
    const computed = window.getComputedStyle(element);
    INLINE_EXPORT_STYLES.forEach((property) => target.style.setProperty(property, computed.getPropertyValue(property)));
    target.removeAttribute("aria-hidden");
  });
  clone.style.width = "172mm";
  clone.style.maxWidth = "172mm";
  clone.style.height = "auto";
  clone.style.minHeight = "auto";
  clone.style.margin = "0";
  clone.style.padding = "0";
  clone.style.border = "0";
  clone.style.boxShadow = "none";
  clone.style.overflow = "visible";
  clone.style.backgroundColor = "#ffffff";
  return clone;
}

function getStyledPreviewMarkup() {
  const visiblePages = getVisibleExportPreviewPages();
  if (visiblePages.length <= 1) return getStyledPreviewClone(visiblePages[0]).outerHTML;
  return visiblePages.map((page, index) => {
    const clone = getStyledPreviewClone(page);
    const pageBreak = index < visiblePages.length - 1 ? "page-break-after:always;break-after:page;" : "";
    return `<section style="${pageBreak}">${clone.outerHTML}</section>`;
  }).join("");
}

function createPaginatedPreviewPages(source: HTMLElement, host: HTMLElement) {
  const createPage = () => {
    const page = source.cloneNode(false) as HTMLElement;
    page.removeAttribute("aria-label");
    page.style.width = "210mm";
    page.style.maxWidth = "210mm";
    page.style.height = "297mm";
    page.style.minHeight = "297mm";
    page.style.margin = "0";
    page.style.border = "0";
    page.style.boxShadow = "none";
    page.style.overflow = "hidden";
    page.style.backgroundColor = "#ffffff";
    host.appendChild(page);
    return page;
  };

  const fitsPage = (page: HTMLElement) => page.scrollHeight <= page.clientHeight + 2;
  const splitParagraphToFillPage = (paragraph: HTMLElement, parent: HTMLElement, page: HTMLElement) => {
    if (paragraph.tagName !== "P") return null;
    const words = (paragraph.textContent ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return null;

    const trial = paragraph.cloneNode(false) as HTMLElement;
    parent.appendChild(trial);
    let low = 1;
    let high = words.length - 1;
    let best = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      trial.textContent = words.slice(0, middle).join(" ");
      if (fitsPage(page)) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    trial.remove();
    if (best === 0 || best >= words.length) return null;

    const leading = paragraph.cloneNode(false) as HTMLElement;
    leading.textContent = words.slice(0, best).join(" ");
    parent.appendChild(leading);
    const remainder = paragraph.cloneNode(false) as HTMLElement;
    remainder.textContent = words.slice(best).join(" ");
    return remainder;
  };

  const splitTableToFillPage = (table: HTMLElement, parent: HTMLElement, page: HTMLElement) => {
    if (table.tagName !== "TABLE") return null;
    const sourceBody = table.querySelector(":scope > tbody");
    const rows = sourceBody ? Array.from(sourceBody.children) as HTMLElement[] : [];
    if (rows.length < 2) return null;

    const leading = table.cloneNode(true) as HTMLElement;
    const leadingBody = leading.querySelector(":scope > tbody");
    if (!leadingBody) return null;
    leadingBody.replaceChildren();
    parent.appendChild(leading);

    let fittedRows = 0;
    for (const row of rows) {
      const rowClone = row.cloneNode(true) as HTMLElement;
      leadingBody.appendChild(rowClone);
      if (!fitsPage(page)) {
        rowClone.remove();
        break;
      }
      fittedRows += 1;
    }
    if (fittedRows === 0 || fittedRows >= rows.length) {
      leading.remove();
      return null;
    }

    const remainder = table.cloneNode(true) as HTMLElement;
    const remainderBody = remainder.querySelector(":scope > tbody");
    if (!remainderBody) {
      leading.remove();
      return null;
    }
    remainderBody.replaceChildren(...rows.slice(fittedRows).map((row) => row.cloneNode(true)));
    return remainder;
  };

  const splitContainerToFillPage = (container: HTMLElement, parent: HTMLElement, page: HTMLElement) => {
    if (!["DIV", "SECTION"].includes(container.tagName) || container.children.length < 2) return null;
    if (container.classList.contains("template-section-block") && parent.childElementCount > 0) return null;
    const children = Array.from(container.children) as HTMLElement[];
    const leading = container.cloneNode(false) as HTMLElement;
    parent.appendChild(leading);
    let fittedChildren = 0;

    for (const sourceChild of children) {
      const child = sourceChild.cloneNode(true) as HTMLElement;
      leading.appendChild(child);
      if (fitsPage(page)) {
        fittedChildren += 1;
        continue;
      }
      child.remove();
      const paragraphRemainder = splitParagraphToFillPage(child, leading, page);
      if (paragraphRemainder) {
        fittedChildren += 1;
        const remainder = container.cloneNode(false) as HTMLElement;
        remainder.appendChild(paragraphRemainder);
        children.slice(fittedChildren).forEach((rest) => remainder.appendChild(rest.cloneNode(true)));
        return remainder;
      }
      break;
    }

    if (fittedChildren === 0 || fittedChildren >= children.length) {
      leading.remove();
      return null;
    }
    const remainder = container.cloneNode(false) as HTMLElement;
    children.slice(fittedChildren).forEach((child) => remainder.appendChild(child.cloneNode(true)));
    return remainder;
  };

  const splitElementToFillPage = (element: HTMLElement, parent: HTMLElement, page: HTMLElement) =>
    splitParagraphToFillPage(element, parent, page)
    ?? splitTableToFillPage(element, parent, page)
    ?? splitContainerToFillPage(element, parent, page);

  const pages: HTMLElement[] = [];
  let currentPage = createPage();
  const pending = Array.from(source.children).map((sourceChild) => sourceChild.cloneNode(true) as HTMLElement);
  while (pending.length > 0) {
    const child = pending.shift()!;
    currentPage.appendChild(child);
    if (fitsPage(currentPage)) continue;

    child.remove();
    const splitRemainder = splitElementToFillPage(child, currentPage, currentPage);
    if (splitRemainder) {
      pages.push(currentPage);
      currentPage = createPage();
      pending.unshift(splitRemainder);
      continue;
    }

    const previousChild = currentPage.lastElementChild as HTMLElement | null;
    const carryHeading = previousChild?.classList.contains("template-section-heading") ? previousChild : null;
    carryHeading?.remove();
    if (currentPage.childElementCount > 0) pages.push(currentPage);
    else currentPage.remove();
    currentPage = createPage();
    if (carryHeading) currentPage.appendChild(carryHeading);
    currentPage.appendChild(child);

    if (!fitsPage(currentPage)) {
      child.remove();
      const nextRemainder = splitElementToFillPage(child, currentPage, currentPage);
      if (nextRemainder) {
        pages.push(currentPage);
        currentPage = createPage();
        pending.unshift(nextRemainder);
      } else {
        currentPage.appendChild(child);
      }
    }
  }
  if (currentPage.childElementCount > 0) pages.push(currentPage);
  else currentPage.remove();
  return pages;
}

function getVisibleExportPreviewPages() {
  return Array.from(document.querySelectorAll<HTMLElement>(
    ".export-preview-overlay .export-preview-pages > .export-preview-document",
  ));
}

function buildPreviewExportHtml(markup: string, title: string) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:14mm 19mm}html,body{margin:0;padding:0;background:#fff;color:#111}table{border-collapse:collapse}*{box-sizing:border-box}@media print{article{min-height:auto!important}}</style></head><body>${markup}</body></html>`;
}

async function buildWordDocumentBlob({
  text,
  title,
  details,
  documentTypeId,
}: {
  text: string;
  title: string;
  details: Array<{ label: string; value: string }>;
  documentTypeId: string;
}) {
  const {
    AlignmentType, BorderStyle, Document, HeightRule, Packer, PageBorderDisplay, PageBorderOffsetFrom, PageBorderZOrder, Paragraph, ShadingType,
    Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
  } = await import("docx");
  const pageWidth = 9752;
  const verticalMargin = 794;
  const lineBorder = { style: BorderStyle.SINGLE, size: 4, color: "777777" };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const borders = { top: lineBorder, bottom: lineBorder, left: lineBorder, right: lineBorder, insideHorizontal: lineBorder, insideVertical: lineBorder };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };
  const cellMargins = { top: 80, bottom: 80, left: 140, right: 140 };
  const paragraph = (value: string, options: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {}) => new Paragraph({
    alignment: options.align,
    keepLines: false,
    keepNext: false,
    widowControl: false,
    spacing: { after: options.after ?? 80, line: 300 },
    children: [new TextRun({ text: value, bold: options.bold, size: options.size ?? 20, font: "Malgun Gothic", color: options.color ?? "111111" })],
  });
  const sectionHeading = (value: string) => new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    columnWidths: [pageWidth],
    layout: TableLayoutType.FIXED,
    borders,
    rows: [new TableRow({ cantSplit: true, height: { value: 460, rule: HeightRule.ATLEAST }, children: [new TableCell({
      width: { size: pageWidth, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: "E7E7E7", color: "auto" },
      margins: cellMargins,
      verticalAlign: VerticalAlign.CENTER,
      children: [paragraph(value, { bold: true, size: 22, align: AlignmentType.CENTER, after: 0 })],
    })] })],
  });
  const informationTable = (rows: Array<{ label: string; value: string }>, blankValues = false) => new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    columnWidths: [2730, 7022],
    layout: TableLayoutType.FIXED,
    borders,
    rows: rows.map((item) => new TableRow({ cantSplit: false, height: { value: blankValues ? 600 : 520, rule: HeightRule.ATLEAST }, children: [
      new TableCell({ width: { size: 2730, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: blankValues ? "F0F0F0" : "E7E7E7", color: "auto" }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER, children: [paragraph(item.label, { bold: true, align: AlignmentType.CENTER, after: 0 })] }),
      new TableCell({ width: { size: 7022, type: WidthType.DXA }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER, children: [paragraph(blankValues ? "" : item.value, { after: 0 })] }),
    ] })),
  });
  const eventInformationTable = (rows: Array<{ label: string; value: string }>) => new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    columnWidths: [1800, 7952],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: rows.map((item) => new TableRow({ cantSplit: false, height: { value: 420, rule: HeightRule.ATLEAST }, children: [
      new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: noBorders, margins: cellMargins, verticalAlign: VerticalAlign.CENTER, children: [paragraph(item.label, { bold: true, color: "14769C", after: 0 })] }),
      new TableCell({ width: { size: 7952, type: WidthType.DXA }, borders: noBorders, margins: cellMargins, verticalAlign: VerticalAlign.CENTER, children: [paragraph(item.value, { after: 0 })] }),
    ] })),
  });
  const approvalBorder = { top: lineBorder, bottom: lineBorder, left: lineBorder, right: lineBorder };
  const titleWithApproval = (value: string): Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> => [
    new Table({
      width: { size: 3100, type: WidthType.DXA },
      columnWidths: [460, 660, 660, 660, 660],
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.RIGHT,
      borders: noBorders,
      rows: [new TableRow({ cantSplit: true, height: { value: 520, rule: HeightRule.ATLEAST }, children:
        ["결재", "담당", "과장", "부장", "이사"].map((label, index) => new TableCell({
          width: { size: index === 0 ? 460 : 660, type: WidthType.DXA },
          borders: approvalBorder,
          margins: { top: 55, bottom: 55, left: 35, right: 35 },
          verticalAlign: VerticalAlign.CENTER,
          children: [paragraph(label, { size: 15, align: AlignmentType.CENTER, after: 0 })],
        })),
      })],
    }),
    paragraph(value, { bold: true, size: 36, align: AlignmentType.CENTER, after: 220 }),
  ];
  const subjectTable = (label: string, value: string) => new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    columnWidths: [1800, 7952],
    layout: TableLayoutType.FIXED,
    borders,
    rows: [new TableRow({ cantSplit: true, height: { value: 620, rule: HeightRule.ATLEAST }, children: [
      new TableCell({ width: { size: 1800, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "E7E7E7", color: "auto" }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER, children: [paragraph(label, { bold: true, align: AlignmentType.CENTER, after: 0 })] }),
      new TableCell({ width: { size: 7952, type: WidthType.DXA }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER, children: [paragraph(value, { bold: true, after: 0 })] }),
    ] })],
  });
  const noticeRuleTable = () => new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    columnWidths: [2600, pageWidth - 2600],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [new TableRow({ cantSplit: true, height: { value: 125, rule: HeightRule.EXACT }, children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 }, shading: { type: ShadingType.CLEAR, fill: "111111", color: "auto" }, children: [paragraph("", { after: 0 })] }),
      new TableCell({ width: { size: pageWidth - 2600, type: WidthType.DXA }, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 }, shading: { type: ShadingType.CLEAR, fill: "0077B8", color: "auto" }, children: [paragraph("", { after: 0 })] }),
    ] })],
  });
  const noticeItemParagraph = (index: number, label: string, value: string) => new Paragraph({
    spacing: { before: index === 0 ? 80 : 170, after: 80, line: 330 },
    indent: { hanging: 360, left: 360 },
    children: [
      new TextRun({ text: `${index + 1}. ${label}: `, bold: true, size: 21, font: "Malgun Gothic", color: "111111" }),
      new TextRun({ text: value, size: 21, font: "Malgun Gothic", color: "111111" }),
    ],
  });

  const blocks = createDraftBlocks(text);
  const narrative = blocks.slice(1).filter((block) => block.kind !== "information");
  const bodyParagraphs = narrative.map((block) => paragraph(block.text, { bold: block.kind === "heading" || block.kind === "important", size: block.kind === "heading" ? 22 : 20, after: 120 }));
  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];

  if (documentTypeId) {
    const [introductionBlock, ...remainingBlocks] = narrative;
    const introduction = introductionBlock ? paragraph(introductionBlock.text, { bold: introductionBlock.kind === "heading" || introductionBlock.kind === "important", size: introductionBlock.kind === "heading" ? 22 : 20, after: 120 }) : null;
    const footerDepartment = details.find((detail) => /담당|부서|기관|주관|작성/.test(detail.label))?.value ?? "담당 부서";
    const noticeItems = [
      ...details.map((detail) => ({ label: detail.label, value: detail.value })),
      ...remainingBlocks.map((block, index) => ({ label: block.kind === "heading" ? block.text : index === 0 ? "기타사항" : "안내사항", value: block.kind === "heading" ? "" : block.text })),
    ].filter((item) => item.value.trim());
    children.push(
      noticeRuleTable(),
      paragraph(title, { bold: true, size: 34, align: AlignmentType.CENTER, after: 90 }),
      noticeRuleTable(),
      paragraph("", { after: 260 }),
    );
    if (introduction) children.push(introduction);
    noticeItems.forEach((item, index) => children.push(noticeItemParagraph(index, item.label, item.value)));
    children.push(
      paragraph("", { after: 420 }),
      paragraph(formatKoreanDocumentDate(), { bold: true, size: 26, align: AlignmentType.CENTER, after: 80 }),
      paragraph(footerDepartment, { bold: true, size: 26, align: AlignmentType.CENTER, after: 0 }),
    );
  } else if (documentTypeId === "application") {
    const collection = details.find((detail) => /받을 정보|기재 항목/.test(detail.label));
    const formItems = collection?.value.split(/[,，/]/).map((item) => item.trim()).filter(Boolean) ?? [];
    const guidanceRows = details.filter((detail) => detail !== collection);
    children.push(...titleWithApproval(title));
    if (guidanceRows.length) children.push(sectionHeading("신청 안내"), informationTable(guidanceRows));
    children.push(sectionHeading("신청자 작성란"), informationTable((formItems.length ? formItems : ["성명", "연락처", "소속", "신청 내용"]).map((label) => ({ label, value: "" })), true));
  } else if (documentTypeId === "proposal") {
    children.push(paragraph(title, { bold: true, size: 38, align: AlignmentType.CENTER, after: 300 }));
    if (details.length) children.push(informationTable(details.slice(0, 3)));
    details.slice(3).forEach((detail) => children.push(sectionHeading(detail.label), paragraph(detail.value, { after: 180 })));
    if (bodyParagraphs.length) children.push(sectionHeading("세부 실행 내용"), ...bodyParagraphs);
  } else if (documentTypeId === "report" || documentTypeId === "minutes") {
    const isMinutes = documentTypeId === "minutes";
    const metadataCount = isMinutes ? 4 : 3;
    children.push(...titleWithApproval(isMinutes ? "회의록" : "보고서"), subjectTable(isMinutes ? "회의명" : "제목", title));
    if (details.length) children.push(informationTable(details.slice(0, metadataCount)));
    if (bodyParagraphs.length) children.push(sectionHeading(isMinutes ? "회의 내용" : "보고 내용"), ...bodyParagraphs);
    details.slice(metadataCount).forEach((detail) => children.push(sectionHeading(detail.label), paragraph(detail.value, { after: 180 })));
  } else if (documentTypeId === "event") {
    const featured = details.filter((detail) => /일시|장소/.test(detail.label));
    const remaining = details.filter((detail) => !featured.includes(detail));
    children.push(
      paragraph("E V E N T   I N F O R M A T I O N", { size: 16, color: "555555", align: AlignmentType.CENTER, after: 140 }),
      paragraph(title, { bold: true, size: 38, align: AlignmentType.CENTER, after: 180 }),
      paragraph("-", { bold: true, size: 26, color: "238CAF", align: AlignmentType.CENTER, after: 180 }),
    );
    if (featured.length) children.push(eventInformationTable(featured));
    if (bodyParagraphs.length) children.push(paragraph("", { after: 100 }), ...bodyParagraphs);
    if (remaining.length) children.push(sectionHeading("참여 정보"), informationTable(remaining));
  } else if (documentTypeId === "official") {
    children.push(...titleWithApproval("업무 협조공문"));
    if (details.length) children.push(informationTable(details));
    children.push(subjectTable("제목", title));
    if (bodyParagraphs.length) children.push(sectionHeading("협조 요청 내용"), ...bodyParagraphs);
    children.push(paragraph("위와 같이 협조를 요청드립니다.", { after: 260 }), paragraph("DocuFlow", { bold: true, align: AlignmentType.RIGHT, after: 0 }));
  } else {
    children.push(paragraph(title, { bold: true, size: 34, align: AlignmentType.CENTER, after: 320 }));
    if (details.length) children.push(sectionHeading("문서 주요 정보"), informationTable(details));
    if (bodyParagraphs.length) children.push(sectionHeading("상세 내용"), ...bodyParagraphs);
  }

  const document = new Document({
    creator: "DocuFlow",
    title,
    styles: { default: { document: { run: { font: "Malgun Gothic", size: 20, color: "111111" }, paragraph: { spacing: { line: 300, after: 80 } } } } },
    sections: [{
      properties: { page: {
        size: { width: 11906, height: 16838 },
        margin: { top: verticalMargin, right: 1077, bottom: verticalMargin, left: 1077, header: 0, footer: 0, gutter: 0 },
        borders: {
          pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE, zOrder: PageBorderZOrder.BACK },
          pageBorderTop: { style: BorderStyle.SINGLE, size: 10, color: "666666", space: 18 },
          pageBorderBottom: { style: BorderStyle.SINGLE, size: 10, color: "666666", space: 18 },
          pageBorderLeft: { style: BorderStyle.SINGLE, size: 10, color: "666666", space: 18 },
          pageBorderRight: { style: BorderStyle.SINGLE, size: 10, color: "666666", space: 18 },
        },
      } },
      children,
    }],
  });
  return Packer.toBlob(document);
}

function downloadFile(content: BlobPart[], type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob(content, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeDocumentName(text: string) {
  return (text.split(/\r?\n/).find((line) => line.trim()) || "DocuFlow 문서")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
    .slice(0, 60);
}

function createBasicReview(documentType: DocumentType, values: Record<string, string>, text: string): AiDocumentReview {
  const issues: AiDocumentReview["issues"] = [];
  if (text.trim().length < 80) {
    issues.push({ level: "warning", title: "본문 내용이 짧습니다", detail: "배포 목적과 이용 방법을 충분히 이해하기 어려울 수 있습니다.", suggestion: "대상, 목적, 기간과 다음 행동을 확인해 주세요." });
  }
  const contact = values.contact?.trim();
  if (contact && !text.includes(contact)) {
    issues.push({ level: "error", title: "문의처가 본문에서 확인되지 않습니다", detail: "입력한 문의처가 생성 문서에 그대로 포함되지 않았습니다.", suggestion: `문의처 '${contact}'를 본문에 추가해 주세요.` });
  }
  if (documentType.id === "application") {
    const requestedFields = (values.collectionFields || "").split(/[,，\n]/).map((field) => field.trim()).filter(Boolean);
    const missingFields = requestedFields.filter((field) => !text.includes(field));
    if (missingFields.length) {
      issues.push({ level: "error", title: "신청자 작성 항목이 빠졌습니다", detail: `${missingFields.join(", ")} 항목이 생성된 양식에서 확인되지 않습니다.`, suggestion: "누락된 항목의 빈 작성란을 추가해 주세요." });
    }
  }
  return {
    summary: issues.length ? `기본 검수에서 ${issues.length}개의 확인 항목을 찾았습니다.` : "AI 연결이 원활하지 않아 기본 검수를 실행했습니다. 입력 정보 기준으로 눈에 띄는 누락은 없습니다.",
    issues,
  };
}

function createBasicDraft(documentType: DocumentType, values: Record<string, string>) {
  if (documentType.id === "application") {
    const requestedFields = (values.collectionFields || "신청자 정보, 신청 내용")
      .split(/[,，\n]/)
      .map((field) => field.trim())
      .filter(Boolean);
    const sections = [
      values.audience && `신청 대상: ${values.audience.trim()}`,
      values.purpose && `신청 안내: ${values.purpose.trim()}`,
      "",
      "신청자 작성 항목",
      ...requestedFields.map((field) => `${field}: ______________________________`),
      "",
      values.period && `신청 기간: ${values.period.trim()}`,
      values.submission && `제출 방법·제출처: ${values.submission.trim()}`,
      values.attachments && `첨부서류: ${values.attachments.trim()}`,
      values.confirmation && `확인·동의: □ ${values.confirmation.trim()}`,
      values.contact && `문의처: ${values.contact.trim()}`,
    ].filter((line): line is string => line !== false && line !== undefined);

    return {
      title: values.applicationName?.trim() || "신청서 양식",
      content: sections.join("\n"),
      summary: "AI 연결이 원활하지 않아 입력한 정보를 바탕으로 작성자가 직접 채울 수 있는 기본 신청서 양식을 만들었습니다.",
    };
  }

  const filledFields = documentType.fields
    .map((field) => ({ label: field.label, value: values[field.id]?.trim() ?? "" }))
    .filter((field) => field.value);
  const titleField = filledFields.find((field) => /제목|명|이름/.test(field.label)) ?? filledFields[0];
  const title = titleField?.value || `${documentType.name} 초안`;
  const details = filledFields.filter((field) => field !== titleField);
  return {
    title,
    content: details.map((field) => `${field.label}: ${field.value}`).join("\n"),
    summary: "AI 연결이 원활하지 않아 입력한 정보를 정리한 기본 초안을 만들었습니다. 내용을 확인한 뒤 다시 작성을 눌러 AI 초안을 재시도할 수 있습니다.",
  };
}

function getFirebaseMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "permission-denied") return "저장 권한을 확인해 주세요.";
  return "저장 목록에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function Home() {
  const [appView, setAppView] = useState<AppView>("landing");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [freeformInput, setFreeformInput] = useState("");
  const [additionalRequest, setAdditionalRequest] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [generationSummary, setGenerationSummary] = useState("");
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [message, setMessage] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [reviewResult, setReviewResult] = useState<AiDocumentReview | null>(null);
  const [addedReviewSuggestions, setAddedReviewSuggestions] = useState<string[]>([]);
  const [highlightedSuggestionText, setHighlightedSuggestionText] = useState("");
  const [documentActionMessage, setDocumentActionMessage] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [exportPreviewFormat, setExportPreviewFormat] = useState<ExportPreviewFormat | null>(null);
  const [savedDocuments, setSavedDocuments] = useState<CloudDocument[]>([]);
  const [storageMessage, setStorageMessage] = useState("저장 목록을 불러오는 중입니다.");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSearchIds, setAiSearchIds] = useState<string[] | null>(null);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [editingSavedTitle, setEditingSavedTitle] = useState("");
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const formRef = useRef<HTMLElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const clearReviewFeedback = () => {
    setAddedReviewSuggestions([]);
    setHighlightedSuggestionText("");
  };

  const selectedType = DOCUMENT_TYPES.find((type) => type.id === selectedTypeId) ?? null;
  const freeformInfoCount = freeformInput.trim() ? 1 : 0;
  const exportPreviewDetails = useMemo(() => selectedType?.fields
    .filter((field) => fieldValues[field.id]?.trim() && !/(?:제목|신청서 이름|양식 이름)/.test(field.label))
    .map((field) => ({ label: field.label, value: fieldValues[field.id].trim() })) ?? [], [fieldValues, selectedType]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const rawDraft = window.localStorage.getItem(AUTOSAVE_DRAFT_KEY);
        if (!rawDraft) {
          setAutosaveReady(true);
          return;
        }
        const draft = JSON.parse(rawDraft) as Partial<AutosavedDraft>;
        const draftTypeId = typeof draft.selectedTypeId === "string" && DOCUMENT_TYPES.some((type) => type.id === draft.selectedTypeId)
          ? draft.selectedTypeId
          : "";
        const hasDraftContent = Boolean(
          draftTypeId &&
          (
            String(draft.freeformInput ?? "").trim() ||
            String(draft.generatedText ?? "").trim() ||
            String(draft.documentName ?? "").trim()
          ),
        );
        if (hasDraftContent) {
          setSelectedTypeId(draftTypeId);
          setFreeformInput(String(draft.freeformInput ?? ""));
          setAdditionalRequest(String(draft.additionalRequest ?? ""));
          setGeneratedText(String(draft.generatedText ?? ""));
          setGenerationSummary(String(draft.generationSummary ?? "이전에 임시저장한 작업을 불러왔습니다."));
          setDocumentName(String(draft.documentName ?? ""));
          setGenerationState(String(draft.generatedText ?? "").trim() ? "complete" : "idle");
          setAppView("editor");
          setAutosaveMessage("이전에 임시저장한 작업을 불러왔습니다.");
        }
      } catch {
        window.localStorage.removeItem(AUTOSAVE_DRAFT_KEY);
      } finally {
        setAutosaveReady(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!autosaveReady) return;
    const hasDraftContent = Boolean(selectedTypeId && (freeformInput.trim() || generatedText.trim() || documentName.trim() || additionalRequest.trim()));
    if (!hasDraftContent) {
      window.localStorage.removeItem(AUTOSAVE_DRAFT_KEY);
      return;
    }

    const timer = window.setTimeout(() => {
      const draft: AutosavedDraft = {
        selectedTypeId,
        freeformInput,
        additionalRequest,
        generatedText,
        generationSummary,
        documentName,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(AUTOSAVE_DRAFT_KEY, JSON.stringify(draft));
      setAutosaveMessage("작성 중인 내용이 자동 임시저장되었습니다.");
    }, 500);

    return () => window.clearTimeout(timer);
  }, [additionalRequest, autosaveReady, documentName, freeformInput, generatedText, generationSummary, selectedTypeId]);

  useEffect(() => {
    let active = true;
    loadCloudDocuments()
      .then((documents) => {
        if (!active) return;
        setSavedDocuments(documents);
        setStorageMessage("");
      })
      .catch((error) => active && setStorageMessage(getFirebaseMessage(error)));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!exportPreviewFormat) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportPreviewFormat(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [exportPreviewFormat]);

  const directSearchDocuments = useMemo(() => {
    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return savedDocuments;
    return savedDocuments.filter((document) => {
      const haystack = `${document.title} ${document.text}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [savedDocuments, searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !savedDocuments.length) return;

    let active = true;
    const timer = window.setTimeout(() => {
      searchDocumentsWithAi(query, savedDocuments)
        .then((ids) => {
          if (!active) return;
          setAiSearchIds(ids);
          setSearchState("complete");
        })
        .catch(() => {
          if (!active) return;
          setAiSearchIds(null);
          setSearchState("error");
        });
    }, 650);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [savedDocuments, searchQuery]);

  const updateSearchQuery = (value: string) => {
    setSearchQuery(value);
    setAiSearchIds(null);
    setSearchState(value.trim() && savedDocuments.length ? "loading" : "idle");
  };

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim() || !aiSearchIds) return directSearchDocuments;
    const byId = new Map(savedDocuments.map((document) => [document.id, document]));
    return aiSearchIds.map((id) => byId.get(id)).filter((document): document is CloudDocument => Boolean(document));
  }, [aiSearchIds, directSearchDocuments, savedDocuments, searchQuery]);
  const hasAutosavedDraft = Boolean(selectedType && (freeformInput.trim() || generatedText.trim() || documentName.trim() || additionalRequest.trim()));

  const clearAutosavedDraft = () => {
    window.localStorage.removeItem(AUTOSAVE_DRAFT_KEY);
    setAutosaveMessage("임시저장을 지웠습니다.");
  };

  const discardAutosavedDraft = () => {
    window.localStorage.removeItem(AUTOSAVE_DRAFT_KEY);
    setSelectedTypeId("");
    setFieldValues({});
    setFreeformInput("");
    setAdditionalRequest("");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setReviewState("idle");
    setReviewResult(null);
    setDocumentActionMessage("");
    setDocumentName("");
    setAutosaveMessage("임시저장을 삭제했습니다.");
  };

  const resumeAutosavedDraft = () => {
    if (!selectedType) return;
    setAppView("editor");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const selectType = (type: DocumentType) => {
    setAppView("editor");
    setSelectedTypeId(type.id);
    setFieldValues({});
    setFreeformInput("");
    setAdditionalRequest("");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setMessage("");
    setReviewState("idle");
    setReviewResult(null);
    clearReviewFeedback();
    setDocumentActionMessage("");
    setDocumentName("");
    setAutosaveMessage("");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const buildFreeformSample = (type: DocumentType) => {
    const values = SAMPLE_VALUES[type.id] ?? {};
    const lines = type.fields
      .map((field) => {
        const value = values[field.id]?.trim();
        return value ? `${field.label}: ${value}` : "";
      })
      .filter(Boolean);
    return lines.join("\n");
  };

  const fillSample = () => {
    if (!selectedType) return;
    setFieldValues({ ...(SAMPLE_VALUES[selectedType.id] ?? {}) });
    setFreeformInput(buildFreeformSample(selectedType));
    setAdditionalRequest("처음 보는 사람도 이해하기 쉽게, 친절하지만 간결한 어조로 작성해 주세요.");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setMessage("가상 예시 내용을 입력했습니다. 필요한 항목만 수정해 주세요.");
    setReviewState("idle");
    setReviewResult(null);
    setDocumentActionMessage("");
    setDocumentName("");
    clearAutosavedDraft();
  };

  const clearDocument = () => {
    setFieldValues({});
    setFreeformInput("");
    setAdditionalRequest("");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setMessage("입력 내용과 생성된 초안을 지웠습니다.");
    setReviewState("idle");
    setReviewResult(null);
    setDocumentActionMessage("");
    setDocumentName("");
    clearAutosavedDraft();
  };

  const generate = async () => {
    if (!selectedType) return;
    if (!freeformInput.trim()) {
      setMessage("문서에 반영할 정보를 한 가지 이상 입력해 주세요.");
      return;
    }

    setGenerationState("loading");
    setGenerationSummary("");
    setMessage("");
    setReviewState("idle");
    setReviewResult(null);
    setDocumentActionMessage("");
    try {
      const result = await generateDocumentWithAi({
        documentType: selectedType.name,
        fields: [],
        additionalRequest,
        freeformInput,
      });
      setGeneratedText(`${result.title}\n\n${result.content}`);
      setDocumentName(result.title);
      setGenerationSummary(result.summary);
      setGenerationState("complete");
      window.requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      console.error("AI draft generation failed", error);
      const fallback = createBasicDraft(selectedType, { title: freeformInput.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "", details: freeformInput });
      setGeneratedText(`${fallback.title}\n\n${fallback.content}`);
      setDocumentName(fallback.title);
      setGenerationSummary(fallback.summary);
      setGenerationState("complete");
      setMessage("AI 연결에 실패해 기본 초안을 표시했습니다. 입력 내용은 그대로 유지됩니다.");
      window.requestAnimationFrame(() => resultRef.current?.focus());
    }
  };

  const updateGeneratedDocument = (value: string) => {
    setGeneratedText(value);
    setReviewState("idle");
    setReviewResult(null);
    clearReviewFeedback();
    setDocumentActionMessage("");
  };

  const addReviewSuggestionToDocument = (issue: AiDocumentReview["issues"][number], issueKey: string) => {
    const suggestion = issue.suggestion?.trim();
    if (!suggestion) return;

    setGeneratedText((current) => {
      const trimmed = current.trimEnd();
      return `${trimmed}${trimmed ? "\n\n" : ""}${suggestion}`;
    });
    setAddedReviewSuggestions((current) => current.includes(issueKey) ? current : [...current, issueKey]);
    setHighlightedSuggestionText(suggestion);
    setDocumentActionMessage(`‘${issue.title}’ 수정 제안을 본문 하단에 추가했습니다.`);
    window.setTimeout(() => {
      const highlightedElement = resultRef.current?.querySelector<HTMLElement>("[data-review-highlight='true']");
      if (!highlightedElement || !resultRef.current) return;
      const editor = resultRef.current;
      editor.scrollTo({
        top: Math.max(0, highlightedElement.offsetTop - (editor.clientHeight / 2) + (highlightedElement.offsetHeight / 2)),
        behavior: "smooth",
      });
    }, 80);
  };

  const copyGeneratedDocument = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setDocumentActionMessage("작성된 초안을 클립보드에 복사했습니다.");
    } catch {
      setDocumentActionMessage("복사하지 못했습니다. 문서 내용을 선택해 직접 복사해 주세요.");
    }
  };

  const downloadWordDocument = async () => {
    setDocumentActionMessage("Word 문서를 만들고 있습니다.");
    try {
      const title = documentName.trim() || safeDocumentName(generatedText);
      const wordDocument = await buildWordDocumentBlob({ text: generatedText, title, details: exportPreviewDetails, documentTypeId: selectedTypeId });
      downloadFile([wordDocument], "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${safeDocumentName(title)}.docx`);
      setDocumentActionMessage("A4 크기와 고정 표 너비가 적용된 Word 문서를 내려받았습니다.");
      setExportPreviewFormat(null);
    } catch (error) {
      console.error(error);
      setDocumentActionMessage("Word 문서를 만들지 못했습니다. 미리보기를 다시 열어 시도해 주세요.");
    }
  };

  const downloadHangulDocument = async () => {
    setDocumentActionMessage("한글 파일을 만들고 있습니다.");
    try {
      const { HwpxWriter } = await import("@ssabrojs/hwpxjs");
      const title = documentName.trim() || safeDocumentName(generatedText);
      // HTML/CSS를 HWPX로 직접 옮기면 한글 프로그램별 해석 차이로 파일이
      // 손상된 것으로 처리될 수 있습니다. 전용 작성기로 표준 OWPML 구조를 생성합니다.
      const hwpx = await new HwpxWriter().createFromPlainText(generatedText, { title, creator: "DocuFlow" });
      const hwpxBuffer = hwpx.buffer.slice(hwpx.byteOffset, hwpx.byteOffset + hwpx.byteLength) as ArrayBuffer;
      downloadFile([hwpxBuffer], "application/owpml", `${safeDocumentName(title)}.hwpx`);
      setDocumentActionMessage("한글 프로그램에서 열 수 있는 표준 HWPX 파일을 내려받았습니다.");
      setExportPreviewFormat(null);
    } catch (error) {
      console.error(error);
      setDocumentActionMessage("한글 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const downloadPdfDocument = async () => {
    setDocumentActionMessage("PDF 파일을 만들고 있습니다.");
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
      const visiblePages = getVisibleExportPreviewPages();
      if (!visiblePages.length) throw new Error("Export preview unavailable");
      const renderHost = document.createElement("div");
      renderHost.style.position = "fixed";
      renderHost.style.left = "-10000px";
      renderHost.style.top = "0";
      renderHost.style.width = "210mm";
      renderHost.style.background = "#ffffff";
      renderHost.className = "export-preview-viewport format-pdf";
      renderHost.style.padding = "0";
      renderHost.style.display = "block";
      document.body.appendChild(renderHost);

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      try {
        for (let index = 0; index < visiblePages.length; index += 1) {
          const page = visiblePages[index].cloneNode(true) as HTMLElement;
          page.style.width = "210mm";
          page.style.maxWidth = "210mm";
          page.style.height = "297mm";
          page.style.minHeight = "297mm";
          page.style.margin = "0";
          page.style.border = "0";
          page.style.boxShadow = "none";
          page.style.overflow = "hidden";
          renderHost.replaceChildren(page);
          const canvas = await html2canvas(page, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false,
          });
          if (index > 0) pdf.addPage("a4", "portrait");
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
        }
      } finally {
        renderHost.remove();
      }
      const title = documentName.trim() || safeDocumentName(generatedText);
      pdf.save(`${safeDocumentName(title)}.pdf`);
      setDocumentActionMessage("미리보기 화면과 같은 PDF 파일을 내려받았습니다.");
      setExportPreviewFormat(null);
    } catch (error) {
      console.error(error);
      setDocumentActionMessage("PDF 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const downloadPreviewedDocument = () => {
    if (exportPreviewFormat === "word") void downloadWordDocument();
    if (exportPreviewFormat === "pdf") void downloadPdfDocument();
    if (exportPreviewFormat === "hwpx") void downloadHangulDocument();
  };

  const reviewGeneratedDocument = async () => {
    if (!selectedType || !generatedText.trim()) return;
    setReviewState("loading");
    setReviewResult(null);
    clearReviewFeedback();
    setDocumentActionMessage("");
    try {
      const result = await reviewGeneratedDocumentWithAi({ documentType: selectedType.name, text: generatedText });
      setReviewResult(result);
    } catch (error) {
      console.error("AI document review failed", error);
      setReviewResult(createBasicReview(selectedType, fieldValues, generatedText));
    } finally {
      setReviewState("complete");
    }
  };

  const saveGeneratedDocument = async () => {
    if (!generatedText.trim()) return;
    const title = documentName.trim().slice(0, 80) || generatedText.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 80) || "제목 없는 문서";
    setStorageMessage("문서를 저장하는 중입니다.");
    try {
      const saved = await saveCloudDocument({ title, text: generatedText, savedAt: Date.now(), documentTypeId: selectedType?.id });
      setSavedDocuments((current) => [saved, ...current]);
      setStorageMessage("작성한 문서를 저장했습니다.");
      setAppView("storage");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (error) {
      setStorageMessage(getFirebaseMessage(error));
    }
  };

  const loadSavedDocument = (document: CloudDocument) => {
    setAppView("editor");
    setSelectedTypeId(DOCUMENT_TYPES.some((type) => type.id === document.documentTypeId) ? document.documentTypeId! : "custom");
    setFieldValues({});
    setFreeformInput(document.text);
    setAdditionalRequest("");
    setGeneratedText(document.text);
    setDocumentName(document.title);
    setGenerationSummary("저장했던 문서를 불러왔습니다. 내용을 바로 수정할 수 있습니다.");
    setGenerationState("complete");
    setReviewState("idle");
    setReviewResult(null);
    setDocumentActionMessage("");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      resultRef.current?.focus();
    });
  };

  const deleteSavedDocument = async (document: CloudDocument) => {
    try {
      await deleteCloudDocument(document.id);
      setSavedDocuments((current) => current.filter((item) => item.id !== document.id));
      setStorageMessage(`‘${document.title}’ 문서를 삭제했습니다.`);
    } catch (error) {
      setStorageMessage(getFirebaseMessage(error));
    }
  };

  const beginEditingSavedTitle = (document: CloudDocument) => {
    setEditingSavedId(document.id);
    setEditingSavedTitle(document.title);
  };

  const saveEditedDocumentTitle = async (document: CloudDocument) => {
    const nextTitle = editingSavedTitle.trim().slice(0, 80);
    if (!nextTitle) {
      setStorageMessage("문서명을 입력해 주세요.");
      return;
    }
    try {
      await updateCloudDocumentTitle(document.id, nextTitle);
      setSavedDocuments((current) => current.map((item) => item.id === document.id ? { ...item, title: nextTitle } : item));
      setEditingSavedId(null);
      setEditingSavedTitle("");
      setStorageMessage(`‘${nextTitle}’ 문서명으로 수정했습니다.`);
    } catch (error) {
      setStorageMessage(getFirebaseMessage(error));
    }
  };

  const startOver = () => {
    setAppView("types");
    setSelectedTypeId("");
    setFieldValues({});
    setFreeformInput("");
    setAdditionalRequest("");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setMessage("");
    setReviewState("idle");
    setReviewResult(null);
    setDocumentActionMessage("");
    setDocumentName("");
    clearAutosavedDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showLanding = () => {
    setAppView("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showTypes = () => {
    setAppView("types");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showStorage = () => {
    setAppView("storage");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={showTypes} aria-label="DocuFlow 문서 목록으로"><span>DF</span><strong>DocuFlow</strong></button>
        <nav className="topbar-nav" aria-label="주요 화면">
          <button type="button" className={appView === "landing" ? "active" : ""} onClick={showLanding}>소개</button>
          <button type="button" className={appView === "types" ? "active" : ""} onClick={showTypes}>문서 선택</button>
          <button type="button" className={appView === "storage" ? "active" : ""} onClick={showStorage}>저장 목록</button>
        </nav>
      </header>

      {appView === "landing" && <section className="hero landing-page" id="top">
        <p className="eyebrow">몇 가지 정보만 입력하면</p>
        <h1>빈 문서 앞에서 고민하지 마세요.<br /><em>초안은 AI가 작성합니다.</em></h1>
        <p className="hero-copy">작성할 문서 종류를 고르고 알고 있는 내용을 입력하세요. 목적에 맞는 구성과 문장으로 완성된 초안을 만들어 드립니다.</p>
        <div className="privacy-note"><span aria-hidden="true">i</span><p><strong>가상 정보로 먼저 시험해 보세요.</strong> 생성 결과는 실제 배포 전에 내용과 개인정보를 꼭 확인해 주세요.</p></div>
        <div className="landing-actions">
          <button type="button" onClick={showTypes}>문서 선택하러 가기</button>
          <button type="button" onClick={showStorage}>저장 목록 보기</button>
        </div>
      </section>}

      {appView === "types" && <section className="type-section type-page" aria-labelledby="type-heading">
        <div className="section-heading">
          <div><span>01</span><p>문서 종류 선택</p></div>
          <h2 id="type-heading">어떤 문서를 작성할까요?</h2>
          <p>문서 종류를 선택하면 필요한 입력 항목을 준비해 드립니다.</p>
        </div>
        <div className="type-grid">
          {DOCUMENT_TYPES.map((type) => (
            <button
              className={`type-card ${selectedTypeId === type.id ? "selected" : ""}`}
              key={type.id}
              type="button"
              onClick={() => selectType(type)}
              aria-pressed={selectedTypeId === type.id}
            >
              <span className="type-symbol">{type.symbol}</span>
              <span className="type-name">{type.name}</span>
              <span className="type-description">{type.description}</span>
              <span className="type-action">선택하기 <b aria-hidden="true">→</b></span>
            </button>
          ))}
        </div>
      </section>}

      {appView === "types" && !selectedType && (
        <section className="waiting-section" aria-label="문서 종류 선택 안내">
          <span>01</span><i aria-hidden="true">→</i><span>02 정보 입력</span><i aria-hidden="true">→</i><span>03 AI 초안 완성</span>
        </section>
      )}

      {appView === "editor" && selectedType && (
        <section className="creator" ref={formRef}>
          <div className="input-panel">
            <div className="panel-head">
              <div><span>02</span><p>정보 입력</p></div>
              <div className="panel-head-actions">
                <button className="sample-fill-button" type="button" onClick={fillSample}>✦ 예시 내용 채우기</button>
                <button className="clear-document-button" type="button" onClick={clearDocument}>본문 지우기</button>
                <button type="button" onClick={showStorage}>저장 목록</button>
                <button type="button" onClick={startOver}>문서 종류 다시 선택</button>
              </div>
            </div>
            <h2>{selectedType.name}에 들어갈 정보를 알려주세요.</h2>
            <p className="panel-description">모든 항목을 채우지 않아도 됩니다. 입력한 정보만 사용해 초안을 작성합니다.</p>

            <div className="progress-row"><strong>{freeformInfoCount}개 입력됨</strong><span>자유 입력 방식</span></div>
            {autosaveMessage && <p className="autosave-message" role="status">{autosaveMessage}</p>}
            <div className="field-grid">
              <label className="wide freeform-input-field">
                <span>문서에 들어갈 기본 정보</span>
                <textarea
                  value={freeformInput}
                  onChange={(event) => {
                    setFreeformInput(event.target.value);
                    setMessage("");
                  }}
                  placeholder={`${selectedType.name}에 필요한 내용을 자유롭게 적어주세요.\n예: 문서 제목, 대상, 기간, 장소, 목적, 문의처, 반드시 들어갈 내용 등`}
                />
              </label>
              <label className="wide additional-field">
                <span>추가 요청 <small>선택</small></span>
                <textarea value={additionalRequest} onChange={(event) => setAdditionalRequest(event.target.value)} placeholder="예: 처음 보는 사람도 이해하기 쉽게, 친절하지만 간결한 어조로 작성해 주세요." />
              </label>
            </div>
            {message && <p className="form-message" role="alert">{message}</p>}
            <button className="generate-button" type="button" onClick={generate} disabled={generationState === "loading"}>
              <span>{generationState === "loading" ? "AI가 초안을 작성하고 있습니다" : `${selectedType.name} 초안 만들기`}</span>
              <b aria-hidden="true">{generationState === "loading" ? "…" : "→"}</b>
            </button>
          </div>

          <aside className="result-panel" aria-live="polite">
            <div className="panel-head result-head"><div><span>03</span><p>AI 초안</p></div><small>AI 작성 · 예시 결과</small></div>
            {generationState === "idle" && (
              <div className="result-empty"><div className="paper-icon"><i /><i /><i /><b>✦</b></div><h3>입력한 정보로<br />문서가 완성됩니다.</h3><p>왼쪽 텍스트 상자에 내용을 입력하고 초안 만들기 버튼을 눌러주세요.</p></div>
            )}
            {generationState === "loading" && (
              <div className="result-empty"><div className="ai-loader">✦</div><h3>문서의 목적과 내용을<br />구성하고 있습니다.</h3><p>입력한 사실만 사용해 자연스러운 초안을 작성합니다.</p></div>
            )}
            {generationState === "error" && (
              <div className="result-empty"><div className="error-icon">!</div><h3>초안을 완성하지 못했습니다.</h3><p>입력 내용은 그대로 유지됩니다. 왼쪽 버튼으로 다시 시도해 주세요.</p></div>
            )}
            {generationState === "complete" && (
              <div className="result-complete">
                <div className="complete-banner"><span>✓</span><div><strong>초안 작성 완료</strong><p>{generationSummary}</p></div></div>
                <div className="draft-label">생성된 문서 <small>제목이나 문장을 눌러 직접 수정할 수 있습니다.</small></div>
                <label className="document-name-editor"><span>문서명</span><input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="저장 목록에서 사용할 문서명을 입력해 주세요." /></label>
                <DraftEditor text={generatedText} onChange={updateGeneratedDocument} editorRef={resultRef} documentTypeId={selectedType.id} highlightedText={highlightedSuggestionText} />
                <div className="draft-tools" aria-label="문서 복사 및 내려받기">
                  <button type="button" onClick={copyGeneratedDocument}>복사</button>
                  <button type="button" onClick={() => setExportPreviewFormat("word")} aria-haspopup="dialog">Word</button>
                  <button type="button" onClick={() => setExportPreviewFormat("pdf")} aria-haspopup="dialog">PDF</button>
                  <button type="button" onClick={() => setExportPreviewFormat("hwpx")} aria-haspopup="dialog">한글(HWPX)</button>
                </div>
                {documentActionMessage && <p className="document-action-message" role="status">{documentActionMessage}</p>}
                <button className="review-button" type="button" onClick={reviewGeneratedDocument} disabled={reviewState === "loading"}>
                  <span>{reviewState === "loading" ? "AI가 초안을 검수하고 있습니다" : "AI 검수하기"}</span>
                  <b aria-hidden="true">{reviewState === "loading" ? "…" : "✦"}</b>
                </button>
                {reviewState === "complete" && reviewResult && (
                  <section className={`review-result ${reviewResult.issues.length ? "has-issues" : "clear"}`} aria-labelledby="review-result-heading">
                    <div className="review-summary">
                      <span aria-hidden="true">{reviewResult.issues.length ? "!" : "✓"}</span>
                      <div><strong id="review-result-heading">검수 결과</strong><p>{reviewResult.summary}</p></div>
                    </div>
                    {reviewResult.issues.length > 0 && (
                      <div className="review-issues">
                        {reviewResult.issues.map((issue, index) => {
                          const issueKey = `${issue.title}-${index}`;
                          const isAdded = addedReviewSuggestions.includes(issueKey);
                          return (
                          <article className={`review-issue ${issue.level}`} key={issueKey}>
                            <div><span>{String(index + 1).padStart(2, "0")}</span><strong>{issue.title}</strong></div>
                            <p>{issue.detail}</p>
                            {issue.suggestion && (
                              <div className="review-suggestion">
                                <small><b>수정 제안</b>{issue.suggestion}</small>
                                <button className={isAdded ? "added" : ""} type="button" aria-pressed={isAdded} onClick={() => addReviewSuggestionToDocument(issue, issueKey)}>{isAdded ? "✓ 추가됨" : "본문에 추가"}</button>
                              </div>
                            )}
                          </article>
                        );})}
                      </div>
                    )}
                  </section>
                )}
                <div className="result-actions">
                  <button className="save-button" type="button" onClick={saveGeneratedDocument}>목록에 저장</button>
                  <button type="button" onClick={generate}>다시 작성</button>
                </div>
              </div>
            )}
          </aside>
        </section>
      )}

      {appView === "storage" && <section className="storage-section storage-page" aria-labelledby="storage-heading">
        <div className="storage-title"><div><span>저장 목록</span><h2 id="storage-heading">나중에 이어서 작성하세요.</h2><p>목록에 저장한 문서를 불러와 바로 수정할 수 있습니다.</p></div><strong>{savedDocuments.length}</strong></div>
        {hasAutosavedDraft && (
          <article className="autosaved-draft-card">
            <div>
              <span>임시저장</span>
              <h3>{documentName.trim() || selectedType?.name || "작성 중인 문서"}</h3>
              <p>작성 중인 내용이 이 브라우저에 자동으로 임시저장되어 있습니다.</p>
            </div>
            <div>
              <button type="button" onClick={resumeAutosavedDraft}>이어서 작성</button>
              <button className="delete" type="button" onClick={discardAutosavedDraft}>임시저장 삭제</button>
            </div>
          </article>
        )}
        <label className="search-box"><span>⌕</span><input value={searchQuery} onChange={(event) => updateSearchQuery(event.target.value)} placeholder="문서명, 키워드 또는 관련 내용으로 AI 검색" /></label>
        {searchQuery.trim() && (
          <p className={`search-status ${searchState}`} role="status">
            {searchState === "loading" && "AI가 키워드와 관련된 문서를 찾고 있습니다."}
            {searchState === "complete" && `AI 의미 검색 결과 ${filteredDocuments.length}건`}
            {searchState === "error" && "AI 검색에 실패해 키워드가 직접 포함된 결과를 보여줍니다."}
            {searchState === "idle" && "입력을 마치면 AI가 의미상 관련된 문서까지 검색합니다."}
          </p>
        )}
        {storageMessage && <p className="storage-message" role="status">{storageMessage}</p>}
        {filteredDocuments.length ? (
          <div className="saved-grid">
            {filteredDocuments.map((document) => (
              <article className="saved-card" key={document.id}>
                <div><span>문서</span><time>{formatSavedAt(document.savedAt)}</time></div>
                {editingSavedId === document.id ? (
                  <label className="saved-title-editor"><span>문서명 수정</span><input value={editingSavedTitle} onChange={(event) => setEditingSavedTitle(event.target.value)} maxLength={80} autoFocus /></label>
                ) : <h3>{document.title}</h3>}
                <p>{document.text.replace(/\s+/g, " ").slice(0, 95)}</p>
                <div>
                  <button type="button" onClick={() => loadSavedDocument(document)}>불러오기</button>
                  {editingSavedId === document.id ? (
                    <><button type="button" onClick={() => void saveEditedDocumentTitle(document)}>문서명 저장</button><button type="button" onClick={() => setEditingSavedId(null)}>취소</button></>
                  ) : <button type="button" onClick={() => beginEditingSavedTitle(document)}>문서명 수정</button>}
                  <button className="delete" type="button" onClick={() => deleteSavedDocument(document)}>삭제</button>
                </div>
              </article>
            ))}
          </div>
        ) : !storageMessage && <p className="no-documents">검색 결과가 없습니다.</p>}
      </section>}

      {exportPreviewFormat && (
        <div
          className="export-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-preview-heading"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExportPreviewFormat(null);
          }}
        >
          <section className="export-preview-shell">
            <header className="export-preview-header">
              <div>
                <span>전체 화면 미리보기</span>
                <h2 id="export-preview-heading">{EXPORT_FORMAT_LABELS[exportPreviewFormat]} 문서</h2>
                <p>{EXPORT_FORMAT_DESCRIPTIONS[exportPreviewFormat]}</p>
              </div>
              <button type="button" onClick={() => setExportPreviewFormat(null)} aria-label="미리보기 닫기">×</button>
            </header>
            <nav className="export-preview-tabs" aria-label="미리볼 파일 형식">
              <button type="button" className={exportPreviewFormat === "word" ? "active" : ""} onClick={() => setExportPreviewFormat("word")}>Word</button>
              <button type="button" className={exportPreviewFormat === "pdf" ? "active" : ""} onClick={() => setExportPreviewFormat("pdf")}>PDF</button>
              <button type="button" className={exportPreviewFormat === "hwpx" ? "active" : ""} onClick={() => setExportPreviewFormat("hwpx")}>한글(HWPX)</button>
            </nav>
            <div className={`export-preview-viewport format-${exportPreviewFormat}`}>
              <PaginatedExportPreview text={generatedText} details={exportPreviewDetails} documentTypeId={selectedType?.id ?? ""} format={exportPreviewFormat} />
            </div>
            <footer className="export-preview-actions">
              <p>미리보기와 내려받는 파일은 모두 A4 크기와 동일한 여백을 사용합니다.</p>
              <div>
                <button type="button" onClick={() => setExportPreviewFormat(null)}>돌아가기</button>
                <button className="download-preview-button" type="button" onClick={downloadPreviewedDocument}>{EXPORT_FORMAT_LABELS[exportPreviewFormat]} 다운로드</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      <footer>DocuFlow · AI가 만든 문서는 배포 전 담당자가 최종 확인해 주세요.</footer>
    </main>
  );
}
