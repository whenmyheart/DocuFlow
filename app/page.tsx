"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteCloudDocument,
  loadCloudDocuments,
  saveCloudDocument,
  type CloudDocument,
} from "@/lib/firebase-documents";
import { reviewDocumentWithAi, type AiReviewIssue } from "@/lib/ai-review";

type ReviewState = "idle" | "loading" | "issue" | "complete" | "error";

type StyledBlock = {
  id: string;
  sourceIndex: number;
  rawText: string;
  kind: "title" | "heading" | "body" | "notice" | "bullet" | "information" | "emptyField";
  text: string;
  label?: string;
  value?: string;
};

const SEARCH_TERM_GROUPS = [
  ["비용", "요금", "수수료", "이용료", "참가비", "무료", "금액", "납부", "결제", "돈"],
  ["문의", "문의처", "연락", "연락처", "전화", "이메일", "담당자"],
  ["첨부", "첨부서류", "제출", "제출서류", "구비서류", "증명서", "등본", "사본", "파일"],
  ["기간", "일정", "날짜", "마감", "기한", "언제", "접수기간"],
  ["사이트", "홈페이지", "웹", "링크", "접속", "온라인"],
  ["제출처", "접수처", "장소", "위치", "주소", "어디", "센터"],
  ["신청", "접수", "지원", "등록", "신청서", "양식"],
  ["이용", "사용", "대관", "시설", "공간"],
];

function getRelatedSearchTerms(query: string) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const relatedTerms = new Set(queryTerms);

  queryTerms.forEach((queryTerm) => {
    SEARCH_TERM_GROUPS.forEach((group) => {
      if (group.some((term) => term.includes(queryTerm) || queryTerm.includes(term))) {
        group.forEach((term) => relatedTerms.add(term));
      }
    });
  });

  return { queryTerms, relatedTerms: [...relatedTerms] };
}

function formatSavedAt(savedAt: number) {
  return new Date(savedAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function getFirebaseConnectionMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "auth/admin-restricted-operation") {
    return "Firebase 익명 로그인이 비활성화되어 있습니다. Authentication에서 익명 로그인을 활성화해 주세요.";
  }
  if (code === "permission-denied") {
    return "Firestore 보안 규칙이 저장 문서 접근을 허용하지 않습니다.";
  }
  return "Firebase에 연결하지 못했습니다. 익명 로그인과 Firestore 설정을 확인해 주세요.";
}

const sampleText = `[마을공유공간 이용 신청 안내]

한빛시 주민과 관내 단체는 마을공유공간 이용을 신청할 수 있습니다.
신청 기간과 자세한 신청 방법은 아래 사이트에서 확인해 주세요.
문의가 있으신 분은 아래 기재되어 있는 문의처로 연락해 주세요.
신청할 때 필요한 서류를 첨부해 주세요.
시설 이용 비용을 납부해 주세요.`;

function createStyledBlocks(text: string): StyledBlock[] {
  const lines = text
    .split(/\r?\n/)
    .map((line, sourceIndex) => ({ rawText: line, sourceIndex, text: line.trim() }))
    .filter(({ text: line }) => Boolean(line));

  return lines.map(({ rawText, sourceIndex, text: line }, index) => {
    const id = `${sourceIndex}-${line.slice(0, 16)}`;
    const base = { id, sourceIndex, rawText };
    const titleText = line.match(/^\[(.+)]$/)?.[1] ?? line;

    if (index === 0) return { ...base, kind: "title" as const, text: titleText };
    if (/^(?:※|주의|유의|필수|알림)|(?:반드시|꼭)\s/.test(line)) return { ...base, kind: "notice" as const, text: line };
    if (/^(?:[-•·▪]|\d+[.)])\s*/.test(line)) {
      return { ...base, kind: "bullet" as const, text: line.replace(/^(?:[-•·▪]|\d+[.)])\s*/, "") };
    }

    const information = line.match(/^([^:：]{1,18})[:：]\s*(.+)$/);
    if (information) {
      return { ...base, kind: "information" as const, text: line, label: information[1], value: information[2] };
    }

    if (/^[^:：\n]{1,30}[:：]\s*$/.test(line)) {
      return { ...base, kind: "emptyField" as const, text: line.replace(/[:：]$/, ""), label: line.replace(/[:：]$/, ""), value: "" };
    }

    if (/[:：]$/.test(line) || (line.length <= 28 && !/[.!?。]$/.test(line))) {
      return { ...base, kind: "heading" as const, text: line.replace(/[:：]$/, "") };
    }

    return { ...base, kind: "body" as const, text: line };
  });
}

function StyledDocument({
  blocks,
  className,
  editable = false,
  label,
  onBlockChange,
}: {
  blocks: StyledBlock[];
  className: string;
  editable?: boolean;
  label: string;
  onBlockChange?: (block: StyledBlock, value: string, part?: "label" | "value") => void;
}) {
  const editableProps = editable ? { contentEditable: true, role: "textbox", spellCheck: true, suppressContentEditableWarning: true, tabIndex: 0 } : {};

  return (
    <article className={className} aria-label={label}>
      {blocks.map((block) => {
        if (block.kind === "title") return <h5 className="styled-title" key={block.id} {...editableProps} aria-label={editable ? "문서 제목 수정" : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "") : undefined}>{block.text}</h5>;
        if (block.kind === "heading") return <h6 className="styled-heading" key={block.id} {...editableProps} aria-label={editable ? "소제목 수정" : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "") : undefined}>{block.text}</h6>;
        if (block.kind === "notice") return <p className="styled-notice" key={block.id}><strong>!</strong><span {...editableProps} aria-label={editable ? "강조 문장 수정" : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "") : undefined}>{block.text}</span></p>;
        if (block.kind === "bullet") return <p className="styled-bullet" key={block.id}><span aria-hidden="true">•</span><span className="styled-bullet-text" {...editableProps} aria-label={editable ? "목록 문장 수정" : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "") : undefined}>{block.text}</span></p>;
        if (block.kind === "information") {
          return <div className="styled-information" key={block.id}><strong {...editableProps} aria-label={editable ? "정보 항목명 수정" : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "", "label") : undefined}>{block.label}</strong><span {...editableProps} aria-label={editable ? `${block.label} 내용 수정` : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "", "value") : undefined}>{block.value}</span></div>;
        }
        if (block.kind === "emptyField") {
          return <div className="styled-empty-field" key={block.id}><strong>{block.label}</strong><span data-placeholder="정보 입력" {...editableProps} aria-label={editable ? `${block.label} 내용 수정` : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "", "value") : undefined}></span></div>;
        }
        return <p className="styled-body" key={block.id} {...editableProps} aria-label={editable ? "본문 문장 수정" : undefined} onBlur={editable ? (event) => onBlockChange?.(block, event.currentTarget.textContent ?? "") : undefined}>{block.text}</p>;
      })}
    </article>
  );
}

export default function Home() {
  const [documentText, setDocumentText] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [issues, setIssues] = useState<AiReviewIssue[]>([]);
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [emptyMessage, setEmptyMessage] = useState("");
  const [savedDocuments, setSavedDocuments] = useState<CloudDocument[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [storageState, setStorageState] = useState<"connecting" | "ready" | "error">("connecting");
  const [stylePreviewOpen, setStylePreviewOpen] = useState(false);
  const [formatHistory, setFormatHistory] = useState([false]);
  const [formatHistoryIndex, setFormatHistoryIndex] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const reviewRequestRef = useRef(0);

  useEffect(() => {
    let active = true;

    loadCloudDocuments()
      .then((documents) => {
        if (!active) return;
        setSavedDocuments(documents);
        setStorageState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setStorageState("error");
        setSaveMessage(getFirebaseConnectionMessage(error));
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return savedDocuments;

    const { queryTerms, relatedTerms } = getRelatedSearchTerms(searchQuery.trim());

    return savedDocuments
      .map((savedDocument) => {
        const title = savedDocument.title.toLowerCase();
        const text = savedDocument.text.toLowerCase();
        const directScore = queryTerms.reduce(
          (score, term) => score + (title.includes(term) ? 4 : 0) + (text.includes(term) ? 2 : 0),
          0,
        );
        const relatedScore = relatedTerms.reduce(
          (score, term) => score + (title.includes(term) ? 2 : 0) + (text.includes(term) ? 1 : 0),
          0,
        );
        return { savedDocument, score: directScore + relatedScore };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ savedDocument }) => savedDocument);
  }, [savedDocuments, searchQuery]);

  const styledBlocks = useMemo(() => createStyledBlocks(documentText), [documentText]);
  const styleSummary = useMemo(() => ({
    headings: styledBlocks.filter((block) => block.kind === "title" || block.kind === "heading").length,
    highlighted: styledBlocks.filter((block) => block.kind === "notice" || block.kind === "information" || block.kind === "emptyField").length,
  }), [styledBlocks]);
  const formatApplied = formatHistory[formatHistoryIndex] ?? false;
  const canUndoFormat = formatHistoryIndex > 0;
  const canRedoFormat = formatHistoryIndex < formatHistory.length - 1;

  const resetFormatHistory = () => {
    setFormatHistory([false]);
    setFormatHistoryIndex(0);
  };

  const clearReviewResult = () => {
    reviewRequestRef.current += 1;
    setReviewState("idle");
    setIssues([]);
    setReviewSummary("");
    setReviewError("");
  };

  const review = async () => {
    setEmptyMessage("");

    if (!documentText.trim()) {
      clearReviewResult();
      setEmptyMessage("검토할 신청서 양식의 본문을 먼저 입력해 주세요.");
      editorRef.current?.focus();
      return;
    }

    const requestId = reviewRequestRef.current + 1;
    reviewRequestRef.current = requestId;
    setReviewState("loading");
    setIssues([]);
    setReviewSummary("");
    setReviewError("");

    try {
      const result = await reviewDocumentWithAi(documentText);
      if (reviewRequestRef.current !== requestId) return;
      setIssues(result.issues);
      setReviewSummary(result.summary);
      setReviewState(result.issues.length > 0 ? "issue" : "complete");
    } catch (error) {
      if (reviewRequestRef.current !== requestId) return;
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      setReviewError(code.includes("resource-exhausted") ? "AI 요청이 많아 잠시 지연되고 있습니다. 잠시 후 다시 시도해 주세요." : "AI가 본문을 검토하지 못했습니다. 입력한 본문은 그대로 유지됩니다.");
      setReviewState("error");
    }
  };

  const updateText = (value: string) => {
    setDocumentText(value);
    setEmptyMessage("");
    resetFormatHistory();
    if (reviewState !== "idle") clearReviewResult();
  };

  const loadSample = () => {
    setDocumentText(sampleText);
    clearReviewResult();
    setEmptyMessage("");
    setStylePreviewOpen(false);
    resetFormatHistory();
    window.requestAnimationFrame(() => editorRef.current?.focus());
  };

  const reset = () => {
    setDocumentText("");
    clearReviewResult();
    setEmptyMessage("");
    setStylePreviewOpen(false);
    resetFormatHistory();
    window.requestAnimationFrame(() => editorRef.current?.focus());
  };

  const createStylePreview = () => {
    setEmptyMessage("");
    if (!documentText.trim()) {
      setStylePreviewOpen(false);
      setEmptyMessage("문서 스타일을 구성할 본문을 먼저 입력해 주세요.");
      editorRef.current?.focus();
      return;
    }
    setStylePreviewOpen(true);
  };

  const applyStyleToDocument = () => {
    if (!formatApplied) {
      setFormatHistory((history) => {
        const nextHistory = [...history.slice(0, formatHistoryIndex + 1), true];
        setFormatHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
    }
    setStylePreviewOpen(false);
  };

  const undoFormat = () => setFormatHistoryIndex((index) => Math.max(0, index - 1));
  const redoFormat = () => setFormatHistoryIndex((index) => Math.min(formatHistory.length - 1, index + 1));

  const updateStyledBlock = (block: StyledBlock, value: string, part?: "label" | "value") => {
    const cleanedValue = value.replace(/\s+/g, " ").trim();
    const lines = documentText.split(/\r?\n/);
    const originalLine = lines[block.sourceIndex] ?? block.rawText;
    let nextLine = cleanedValue;

    if (block.kind === "title" && /^\[.+]$/.test(originalLine.trim())) nextLine = `[${cleanedValue}]`;
    if (block.kind === "heading" && /[:：]$/.test(originalLine.trim())) nextLine = `${cleanedValue}:`;
    if (block.kind === "bullet") {
      const prefix = originalLine.trim().match(/^(?:[-•·▪]|\d+[.)])\s*/)?.[0] ?? "- ";
      nextLine = `${prefix}${cleanedValue}`;
    }
    if (block.kind === "information") {
      const nextLabel = part === "label" ? cleanedValue : block.label ?? "항목";
      const nextValue = part === "value" ? cleanedValue : block.value ?? "";
      nextLine = `${nextLabel}: ${nextValue}`;
    }
    if (block.kind === "emptyField") nextLine = `${block.label}: ${cleanedValue}`;

    lines[block.sourceIndex] = nextLine;
    const nextText = lines.join("\n");
    setDocumentText(nextText);
    setEmptyMessage("");
    clearReviewResult();
  };

  const saveDocument = async () => {
    if (!documentText.trim()) {
      setSaveMessage("저장할 본문을 먼저 입력해 주세요.");
      editorRef.current?.focus();
      return;
    }

    const firstLine = documentText.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "제목 없는 문서";
    const savedDocument = {
      title: firstLine.length > 36 ? `${firstLine.slice(0, 36)}…` : firstLine,
      text: documentText,
      savedAt: Date.now(),
    };

    try {
      setSaveMessage("Firebase에 본문을 저장하는 중입니다.");
      const createdDocument = await saveCloudDocument(savedDocument);
      setSavedDocuments((documents) => [createdDocument, ...documents]);
      setSaveMessage("Firebase에 현재 본문을 저장했습니다.");
    } catch {
      setSaveMessage("Firebase에 본문을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const loadDocument = (savedDocument: CloudDocument) => {
    setDocumentText(savedDocument.text);
    clearReviewResult();
    setEmptyMessage("");
    setStylePreviewOpen(false);
    resetFormatHistory();
    setSaveMessage(`‘${savedDocument.title}’ 본문을 불러왔습니다.`);
    window.requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.scrollTop = 0;
      editorRef.current.focus();
    });
  };

  const deleteDocument = async (savedDocument: CloudDocument) => {
    try {
      setSaveMessage("Firebase에서 저장 내용을 삭제하는 중입니다.");
      await deleteCloudDocument(savedDocument.id);
      setSavedDocuments((documents) => documents.filter((item) => item.id !== savedDocument.id));
      setSaveMessage(`‘${savedDocument.title}’ 저장 내용을 Firebase에서 삭제했습니다.`);
    } catch {
      setSaveMessage("Firebase에서 저장 내용을 삭제하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const appendMissingFields = () => {
    if (issues.length === 0) return;

    const fields = issues
      .filter((issue) => !documentText.includes(issue.appendLabel))
      .map((issue) => issue.appendLabel);

    if (fields.length > 0) {
      const editorScrollTop = editorRef.current?.scrollTop ?? 0;
      const separator = !documentText ? "" : documentText.endsWith("\n\n") ? "" : documentText.endsWith("\n") ? "\n" : "\n\n";
      setDocumentText(`${documentText}${separator}${fields.join("\n")}`);
      setReviewState("issue");
      window.requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.scrollTop = editorScrollTop;
      });
    }
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
          <p><strong>AI가 본문 전체의 맥락을 읽습니다</strong>고정 항목을 대입하지 않고, 양식의 용도와 안내 문장을 바탕으로 필요한 정보를 판단합니다. 실제 개인정보는 입력하지 마세요.</p>
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
            <div className="editor-label-row">
              {formatApplied ? <span className="editor-label">서식이 적용된 신청서 양식 본문</span> : <label htmlFor="documentText">신청서 양식 전체 텍스트</label>}
              {formatHistory.length > 1 && (
                <div className="format-history" aria-label="서식 적용 기록">
                  <button type="button" onClick={undoFormat} disabled={!canUndoFormat} aria-label="서식 적용 실행 취소">← <span>실행 취소</span></button>
                  <button type="button" onClick={redoFormat} disabled={!canRedoFormat} aria-label="서식 적용 다시 실행"><span>다시 실행</span> →</button>
                </div>
              )}
            </div>
            {formatApplied ? (
              <StyledDocument blocks={styledBlocks} className="styled-document applied-style-document" editable label="서식이 적용된 신청서 양식 본문" onBlockChange={updateStyledBlock} />
            ) : (
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
            )}
            {formatApplied && <p className="format-applied-message" aria-live="polite">제목이나 문장을 클릭해 바로 수정할 수 있습니다. 실행 취소로 원문 입력 화면으로 돌아갈 수 있습니다.</p>}
            <div className="editor-meta expanded-criteria">
              <div id="review-rule">
                <p><strong>AI 문맥 검토</strong> 문서의 용도와 독자가 해야 할 행동을 읽고, 그 행동에 필요한 구체 정보가 실제로 기재됐는지 판단합니다.</p>
              </div>
              <span>{documentText.length.toLocaleString()} / 10,000자</span>
            </div>
          </div>

          {emptyMessage && <p className="form-message" role="alert">{emptyMessage}</p>}

          <div className="form-actions">
            <button className="primary-button" type="button" onClick={review} disabled={reviewState === "loading"}>{reviewState === "loading" ? "AI가 본문 읽는 중…" : "AI로 본문 검토하기"} <span>{reviewState === "loading" ? "" : "→"}</span></button>
            <button className="style-button" type="button" onClick={createStylePreview}>문서 스타일 자동 구성</button>
            <button className="secondary-button" type="button" onClick={reset}>본문 지우기</button>
          </div>

          {stylePreviewOpen && (
            <section className="style-preview-section" aria-labelledby="style-preview-title">
              <div className="style-preview-heading">
                <div>
                  <span>규칙 기반 자동 서식 예시</span>
                  <h4 id="style-preview-title">배포 문서 스타일 미리보기</h4>
                  <p>첫 줄, 문장 길이, 안내 표현과 정보 형식을 분석해 크기·색·간격을 자동으로 구분했습니다.</p>
                </div>
                <div className="style-preview-actions">
                  <button className="apply-style-button" type="button" onClick={applyStyleToDocument}>원문에 서식 적용</button>
                  <button type="button" onClick={() => setStylePreviewOpen(false)}>미리보기 닫기</button>
                </div>
              </div>

              <div className="style-analysis" aria-label="자동 서식 분석 결과">
                <span>제목·소제목 {styleSummary.headings}개</span>
                <span>강조 정보 {styleSummary.highlighted}개</span>
                <span>본문 {styledBlocks.filter((block) => block.kind === "body" || block.kind === "bullet").length}개</span>
              </div>

              <StyledDocument blocks={styledBlocks} className="styled-document" label="자동으로 스타일을 적용한 문서 미리보기" />

              <p className="style-preview-note">서식을 적용해도 원문 텍스트는 유지됩니다. 실제 배포 전 기관의 문서 서식 기준과 내용의 사실 여부를 최종 확인해 주세요.</p>
            </section>
          )}

          <section className="document-storage" aria-labelledby="storage-title">
            <div className="storage-heading">
              <div>
                <h4 id="storage-title">저장 목록 <span>{savedDocuments.length}</span></h4>
                <p>작성한 본문은 DocuFlow Firebase에 저장됩니다.</p>
              </div>
              <button className="save-button" type="button" onClick={saveDocument} disabled={storageState !== "ready"}>현재 본문 저장</button>
            </div>
            {storageState === "connecting" && <p className="save-message" aria-live="polite">Firebase 저장소에 연결 중입니다.</p>}
            {saveMessage && <p className="save-message" aria-live="polite">{saveMessage}</p>}
            <div className="saved-search">
              <label htmlFor="savedSearch">저장 문서 검색</label>
              <input
                id="savedSearch"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="예: 비용, 연락처, 첨부서류"
              />
              <small>입력한 단어와 의미가 가까운 표현도 함께 찾는 규칙 기반 예시 검색입니다.</small>
            </div>
            {searchQuery.trim() && <p className="search-result-count">검색 결과 {filteredDocuments.length}건</p>}
            {storageState === "connecting" ? (
              <p className="saved-empty">저장 목록을 불러오는 중입니다.</p>
            ) : savedDocuments.length === 0 ? (
              <p className="saved-empty">저장된 본문이 없습니다.</p>
            ) : filteredDocuments.length === 0 ? (
              <p className="saved-empty">관련된 저장 본문을 찾지 못했습니다.</p>
            ) : (
              <div className="saved-list">
                {filteredDocuments.map((savedDocument) => (
                  <article className="saved-item" key={savedDocument.id}>
                    <div>
                      <strong>{savedDocument.title}</strong>
                      <time>{formatSavedAt(savedDocument.savedAt)}</time>
                    </div>
                    <div className="saved-actions">
                      <button type="button" onClick={() => loadDocument(savedDocument)}>불러오기</button>
                      <button className="delete-button" type="button" onClick={() => deleteDocument(savedDocument)} disabled={storageState !== "ready"}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
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
              <p>왼쪽에 양식 전체 텍스트를 입력한 뒤<br />‘AI로 본문 검토하기’를 눌러주세요.</p>
            </div>
          )}

          {reviewState === "loading" && (
            <div className="loading-result" role="status">
              <span className="ai-spinner" aria-hidden="true"></span>
              <p className="result-kicker">AI 문맥 분석 중</p>
              <h4>이 양식에 필요한 정보를<br />AI가 판단하고 있습니다.</h4>
              <p>본문의 용도, 안내 문장과 실제 기재 내용을 함께 확인합니다.</p>
            </div>
          )}

          {reviewState === "issue" && (
            <div className="review-content">
              <div className="result-summary warning">
                <span className="summary-icon" aria-hidden="true">!</span>
                <div><strong>AI 발견 {issues.length}건</strong><p>{reviewSummary || "기재하지 않은 정보를 추가해 주세요."}</p></div>
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

              <button className="next-button" type="button" onClick={appendMissingFields}>
                본문에 누락 정보 추가하기 <span>→</span>
              </button>
            </div>
          )}

          {reviewState === "complete" && (
            <div className="complete-result">
              <div className="complete-mark" aria-hidden="true">✓</div>
              <p className="result-kicker">AI 검토 완료</p>
              <h4>본문의 맥락에서 발견된<br />누락이 없습니다.</h4>
              <p>{reviewSummary || "문서가 요구하는 행동에 필요한 정보가 본문에 기재되어 있습니다."} 배포 전 내용의 사실 여부는 최종 확인해 주세요.</p>
              <button className="next-button" type="button" onClick={review}>수정 내용 다시 검토하기 <span>↻</span></button>
            </div>
          )}

          {reviewState === "error" && (
            <div className="error-result" role="alert">
              <span aria-hidden="true">!</span>
              <h4>AI 검토 결과를 만들지 못했습니다</h4>
              <p>{reviewError || "입력한 본문은 유지되었습니다. 잠시 후 다시 검토해 주세요."}</p>
              <button className="next-button" type="button" onClick={review}>다시 검토하기</button>
            </div>
          )}
        </aside>
      </section>

      <footer>문서체크 1-Day Prototype · 저장 버튼을 누른 본문은 사용자별 Firebase 저장소에 보관됩니다.</footer>
    </main>
  );
}
