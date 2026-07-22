"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteCloudDocument,
  loadCloudDocuments,
  saveCloudDocument,
  type CloudDocument,
} from "@/lib/firebase-documents";
import { generateDocumentWithAi, searchDocumentsWithAi } from "@/lib/ai-review";

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
      { id: "organizer", label: "담당 부서·기관", placeholder: "예: 학생지원과" },
      { id: "schedule", label: "기간·일시", placeholder: "예: 2026. 8. 1. ~ 8. 31." },
      { id: "location", label: "장소·접속 주소", placeholder: "예: 중앙도서관 1층" },
      { id: "method", label: "신청·참여 방법", placeholder: "예: 학교 포털에서 신청", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 학생지원과 02-1234-5678" },
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
      { id: "organizer", label: "담당 부서·기관", placeholder: "예: 학생지원과" },
      { id: "purpose", label: "신청 안내·목적", placeholder: "예: 동아리의 자율적인 활동과 행사 운영을 지원", wide: true },
      { id: "collectionFields", label: "신청자에게 받을 정보", placeholder: "예: 성명, 학번, 소속, 전화번호, 신청 사유, 지원 금액", wide: true },
      { id: "period", label: "신청 기간", placeholder: "예: 2026. 8. 1. ~ 8. 10." },
      { id: "submission", label: "제출 방법·제출처", placeholder: "예: 학생 포털에서 작성 후 제출", wide: true },
      { id: "attachments", label: "필요한 첨부서류", placeholder: "예: 활동 계획서, 예산 사용 계획서", wide: true },
      { id: "confirmation", label: "확인·동의 문구", placeholder: "예: 기재 내용이 사실임을 확인합니다.", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 학생지원과 02-1234-5678" },
    ],
  },
  {
    id: "proposal",
    name: "기획서",
    symbol: "기획",
    description: "아이디어의 배경부터 실행 계획까지 설득력 있게 정리",
    fields: [
      { id: "projectName", label: "기획명", placeholder: "예: 캠퍼스 플리마켓 운영", wide: true },
      { id: "proposer", label: "기획자·부서", placeholder: "예: 학생자치회" },
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
      { id: "author", label: "작성자·부서", placeholder: "예: 정책기획팀" },
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
      { id: "host", label: "주최·주관", placeholder: "예: 대학일자리센터" },
      { id: "dateTime", label: "일시", placeholder: "예: 9월 14일 10:00~17:00" },
      { id: "location", label: "장소", placeholder: "예: 학생회관 대강당" },
      { id: "program", label: "주요 프로그램", placeholder: "예: 직무 상담, 현직자 특강, 모의 면접", wide: true },
      { id: "participation", label: "참여 방법", placeholder: "예: 포털 사전 신청, 현장 참여 가능", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 대학일자리센터 02-1234-5678" },
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
      { id: "contact", label: "담당자·문의처", placeholder: "예: 학생지원과 김하늘 02-1234-5678" },
    ],
  },
  {
    id: "custom",
    name: "자유 문서",
    symbol: "자유",
    description: "정해진 형식 없이 목적에 맞는 문서를 새로 구성",
    fields: [
      { id: "title", label: "문서 제목", placeholder: "예: 새 학기 운영 방향 안내", wide: true },
      { id: "author", label: "작성자·부서", placeholder: "예: 운영지원팀" },
      { id: "audience", label: "읽는 사람", placeholder: "예: 전 부서 구성원" },
      { id: "purpose", label: "작성 목적", placeholder: "예: 변경된 업무 절차 안내", wide: true },
      { id: "details", label: "반드시 들어갈 내용", placeholder: "예: 변경 사항, 시행일, 담당자 역할", wide: true },
      { id: "contact", label: "문의처", placeholder: "예: 운영지원팀 02-1234-5678" },
    ],
  },
];

const SAMPLE_VALUES: Record<string, Record<string, string>> = {
  notice: {
    subject: "여름방학 중앙도서관 운영 안내",
    audience: "재학생 및 교직원",
    organizer: "새롬대학교 학술정보팀",
    schedule: "2026. 7. 27. ~ 2026. 8. 21., 평일 09:00~18:00",
    location: "새롬대학교 중앙도서관",
    method: "별도 신청 없이 학생증을 지참해 방문해 주세요.",
    contact: "학술정보팀 02-1234-5678",
  },
  application: {
    applicationName: "2026 교내 동아리 활동비 지원 신청서",
    audience: "교내 등록 동아리",
    organizer: "새롬대학교 학생지원과",
    purpose: "동아리의 자율적인 활동과 교내 행사 운영을 지원합니다.",
    collectionFields: "동아리명, 대표자 성명, 학번, 소속, 전화번호, 신청 사유, 지원 요청 금액",
    period: "2026. 8. 1. ~ 2026. 8. 10.",
    submission: "학생 포털에서 작성 후 제출",
    attachments: "활동 계획서, 예산 사용 계획서",
    confirmation: "위 기재 내용이 사실임을 확인합니다.",
    contact: "학생지원과 02-1234-5678",
  },
  proposal: {
    projectName: "캠퍼스 플리마켓 운영 기획",
    proposer: "학생자치회",
    target: "전체 재학생",
    background: "학생 간 교류와 자원 순환을 활성화하기 위해 기획했습니다.",
    goal: "참여 부스 30개 모집 및 재학생 300명 참여",
    plan: "참가팀 모집, 부스 배치, 현장 안내와 안전 관리를 진행합니다.",
    schedule: "2026년 9월 모집, 10월 행사 진행",
    budget: "총 200만 원",
  },
  report: {
    reportTitle: "2026 상반기 민원 만족도 조사 결과 보고",
    author: "정책기획팀",
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
    host: "대학일자리센터",
    dateTime: "2026. 9. 14. 10:00~17:00",
    location: "학생회관 대강당",
    program: "직무 상담, 현직자 특강, 모의 면접",
    participation: "학생 포털에서 사전 신청하거나 현장에서 참여할 수 있습니다.",
    contact: "대학일자리센터 02-1234-5678",
  },
  official: {
    recipient: "각 학과장",
    sender: "학생처장",
    subject: "학생 설문조사 참여 협조 요청",
    background: "교육 환경 개선을 위한 재학생 의견을 수렴하고자 합니다.",
    request: "소속 학생에게 설문 링크를 안내해 주세요.",
    deadline: "2026. 8. 14.까지",
    contact: "학생지원과 김하늘 02-1234-5678",
  },
  custom: {
    title: "새 학기 민원 접수 절차 안내",
    author: "운영지원팀",
    audience: "전 부서 구성원",
    purpose: "변경된 민원 접수 절차를 안내합니다.",
    details: "온라인 접수를 우선하며, 긴급 민원은 담당자에게 전화로 알려 주세요.",
    contact: "운영지원팀 02-1234-5678",
  },
};

type GenerationState = "idle" | "loading" | "complete" | "error";
type SearchState = "idle" | "loading" | "complete" | "error";

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

function DraftEditor({ text, onChange, editorRef }: { text: string; onChange: (value: string) => void; editorRef: React.RefObject<HTMLDivElement | null> }) {
  const blocks = useMemo(() => createDraftBlocks(text), [text]);

  const updateLine = (sourceIndex: number, value: string) => {
    const lines = text.split(/\r?\n/);
    lines[sourceIndex] = value.replace(/\s+/g, " ").trim();
    onChange(lines.join("\n"));
  };

  return (
    <div className="formatted-document" id="generatedDocument" ref={editorRef} tabIndex={-1} aria-label="생성된 문서 편집 영역">
      {blocks.map((block) => {
        if (block.kind === "title") return <h3 key={block.sourceIndex} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</h3>;
        if (block.kind === "heading") return <h4 key={block.sourceIndex} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</h4>;
        if (block.kind === "information") return <div className="draft-information" key={block.sourceIndex}><strong>{block.label}</strong><span contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, `${block.label}: ${event.currentTarget.textContent ?? ""}`)}>{block.value}</span></div>;
        if (block.kind === "bullet") return <p className="draft-bullet" key={block.sourceIndex} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, `- ${event.currentTarget.textContent ?? ""}`)}>{block.text}</p>;
        if (block.kind === "important") return <p className="draft-important" key={block.sourceIndex} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</p>;
        return <p key={block.sourceIndex} contentEditable suppressContentEditableWarning onBlur={(event) => updateLine(block.sourceIndex, event.currentTarget.textContent ?? "")}>{block.text}</p>;
      })}
    </div>
  );
}

function formatSavedAt(savedAt: number) {
  return new Date(savedAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
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
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [additionalRequest, setAdditionalRequest] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [generationSummary, setGenerationSummary] = useState("");
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [message, setMessage] = useState("");
  const [savedDocuments, setSavedDocuments] = useState<CloudDocument[]>([]);
  const [storageMessage, setStorageMessage] = useState("저장 목록을 불러오는 중입니다.");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSearchIds, setAiSearchIds] = useState<string[] | null>(null);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const formRef = useRef<HTMLElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const selectedType = DOCUMENT_TYPES.find((type) => type.id === selectedTypeId) ?? null;
  const completedFieldCount = selectedType?.fields.filter((field) => fieldValues[field.id]?.trim()).length ?? 0;

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

  const selectType = (type: DocumentType) => {
    setSelectedTypeId(type.id);
    setFieldValues({});
    setAdditionalRequest("");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setMessage("");
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const updateField = (id: string, value: string) => {
    setFieldValues((current) => ({ ...current, [id]: value }));
    setMessage("");
  };

  const fillSample = () => {
    if (!selectedType) return;
    setFieldValues({ ...(SAMPLE_VALUES[selectedType.id] ?? {}) });
    setAdditionalRequest("처음 보는 사람도 이해하기 쉽게, 친절하지만 간결한 어조로 작성해 주세요.");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setMessage("가상 예시 내용을 입력했습니다. 필요한 항목만 수정해 주세요.");
  };

  const generate = async () => {
    if (!selectedType) return;
    const filledFields = selectedType.fields.filter((field) => fieldValues[field.id]?.trim());
    if (!filledFields.length) {
      setMessage("문서에 반영할 정보를 한 가지 이상 입력해 주세요.");
      return;
    }

    setGenerationState("loading");
    setGenerationSummary("");
    setMessage("");
    try {
      const result = await generateDocumentWithAi({
        documentType: selectedType.name,
        fields: selectedType.fields.map((field) => ({ label: field.label, value: fieldValues[field.id] ?? "" })),
        additionalRequest,
      });
      setGeneratedText(`${result.title}\n\n${result.content}`);
      setGenerationSummary(result.summary);
      setGenerationState("complete");
      window.requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      console.error("AI draft generation failed", error);
      const fallback = createBasicDraft(selectedType, fieldValues);
      setGeneratedText(`${fallback.title}\n\n${fallback.content}`);
      setGenerationSummary(fallback.summary);
      setGenerationState("complete");
      setMessage("AI 연결에 실패해 기본 초안을 표시했습니다. 입력 내용은 그대로 유지됩니다.");
      window.requestAnimationFrame(() => resultRef.current?.focus());
    }
  };

  const saveGeneratedDocument = async () => {
    if (!generatedText.trim()) return;
    const title = generatedText.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 60) || "제목 없는 문서";
    setStorageMessage("문서를 저장하는 중입니다.");
    try {
      const saved = await saveCloudDocument({ title, text: generatedText, savedAt: Date.now() });
      setSavedDocuments((current) => [saved, ...current]);
      setStorageMessage("작성한 문서를 저장했습니다.");
    } catch (error) {
      setStorageMessage(getFirebaseMessage(error));
    }
  };

  const loadSavedDocument = (document: CloudDocument) => {
    setSelectedTypeId("custom");
    setFieldValues({});
    setAdditionalRequest("");
    setGeneratedText(document.text);
    setGenerationSummary("저장했던 문서를 불러왔습니다. 내용을 바로 수정할 수 있습니다.");
    setGenerationState("complete");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const startOver = () => {
    setSelectedTypeId("");
    setFieldValues({});
    setAdditionalRequest("");
    setGeneratedText("");
    setGenerationSummary("");
    setGenerationState("idle");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="DocuFlow 처음으로"><span>DF</span><strong>DocuFlow</strong></a>
        <p>AI 문서 초안 작성 도구</p>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">몇 가지 정보만 입력하면</p>
        <h1>빈 문서 앞에서 고민하지 마세요.<br /><em>초안은 AI가 작성합니다.</em></h1>
        <p className="hero-copy">작성할 문서 종류를 고르고 알고 있는 내용을 입력하세요. 목적에 맞는 구성과 문장으로 완성된 초안을 만들어 드립니다.</p>
        <div className="privacy-note"><span aria-hidden="true">i</span><p><strong>가상 정보로 먼저 시험해 보세요.</strong> 생성 결과는 실제 배포 전에 내용과 개인정보를 꼭 확인해 주세요.</p></div>
      </section>

      <section className="type-section" aria-labelledby="type-heading">
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
      </section>

      {!selectedType ? (
        <section className="waiting-section" aria-label="문서 종류 선택 안내">
          <span>01</span><i aria-hidden="true">→</i><span>02 정보 입력</span><i aria-hidden="true">→</i><span>03 AI 초안 완성</span>
        </section>
      ) : (
        <section className="creator" ref={formRef}>
          <div className="input-panel">
            <div className="panel-head">
              <div><span>02</span><p>정보 입력</p></div>
              <div className="panel-head-actions">
                <button className="sample-fill-button" type="button" onClick={fillSample}>✦ 예시 내용 채우기</button>
                <button type="button" onClick={startOver}>문서 종류 다시 선택</button>
              </div>
            </div>
            <h2>{selectedType.name}에 들어갈 정보를 알려주세요.</h2>
            <p className="panel-description">모든 항목을 채우지 않아도 됩니다. 입력한 정보만 사용해 초안을 작성합니다.</p>

            <div className="progress-row"><strong>{completedFieldCount}개 입력됨</strong><span>{selectedType.fields.length}개 추천 항목</span></div>
            <div className="field-grid">
              {selectedType.fields.map((field) => (
                <label className={field.wide ? "wide" : ""} key={field.id}>
                  <span>{field.label}</span>
                  <input
                    value={fieldValues[field.id] ?? ""}
                    onChange={(event) => updateField(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    autoComplete="off"
                  />
                </label>
              ))}
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
              <div className="result-empty"><div className="paper-icon"><i /><i /><i /><b>✦</b></div><h3>입력한 정보로<br />문서가 완성됩니다.</h3><p>왼쪽 항목을 입력하고 초안 만들기 버튼을 눌러주세요.</p></div>
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
                <DraftEditor text={generatedText} onChange={setGeneratedText} editorRef={resultRef} />
                <div className="result-actions">
                  <button className="save-button" type="button" onClick={saveGeneratedDocument}>목록에 저장</button>
                  <button type="button" onClick={generate}>다시 작성</button>
                </div>
              </div>
            )}
          </aside>
        </section>
      )}

      <section className="storage-section" aria-labelledby="storage-heading">
        <div className="storage-title"><div><span>저장 목록</span><h2 id="storage-heading">나중에 이어서 작성하세요.</h2><p>목록에 저장한 문서를 불러와 바로 수정할 수 있습니다.</p></div><strong>{savedDocuments.length}</strong></div>
        <label className="search-box"><span>⌕</span><input value={searchQuery} onChange={(event) => updateSearchQuery(event.target.value)} placeholder="키워드나 관련 내용으로 AI 검색" /></label>
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
                <h3>{document.title}</h3>
                <p>{document.text.replace(/\s+/g, " ").slice(0, 95)}</p>
                <div><button type="button" onClick={() => loadSavedDocument(document)}>불러오기</button><button className="delete" type="button" onClick={() => deleteSavedDocument(document)}>삭제</button></div>
              </article>
            ))}
          </div>
        ) : !storageMessage && <p className="no-documents">검색 결과가 없습니다.</p>}
      </section>

      <footer>DocuFlow · AI가 만든 문서는 배포 전 담당자가 최종 확인해 주세요.</footer>
    </main>
  );
}
