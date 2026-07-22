import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { firebaseApp } from "@/lib/firebase-documents";

export type DocumentFieldInput = {
  label: string;
  value: string;
};

export type AiGeneratedDocument = {
  title: string;
  content: string;
  summary: string;
};

export type SearchableDocument = {
  id: string;
  title: string;
  text: string;
};

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content", "summary"],
  properties: {
    title: { type: "string", description: "완성된 문서의 명확한 제목" },
    content: { type: "string", description: "제목을 제외한 완성된 한국어 문서 본문" },
    summary: { type: "string", description: "작성 결과를 설명하는 짧은 한 문장" },
  },
};

const systemInstruction = [
  "당신은 공공기관, 학교, 동아리, 행정부서에서 사용하는 문서를 작성하는 전문 행정 문서 편집자입니다.",
  "사용자가 선택한 문서 종류와 입력한 정보를 바탕으로 즉시 배포 가능한 자연스러운 한국어 초안을 작성하세요.",
  "입력하지 않은 날짜, 연락처, 금액, 사람 이름 등의 사실을 임의로 만들어내지 마세요.",
  "빈 정보가 있으면 해당 내용을 억지로 채우거나 '미정'이라고 쓰지 말고, 문서 흐름상 자연스럽게 생략하세요.",
  "문서 유형에 맞는 어조와 구조를 사용하세요. 공지는 핵심 안내와 행동 요청이 분명해야 하고, 보고서는 목적·내용·결과가 구분되어야 하며, 기획서는 배경·목표·실행 계획이 드러나야 합니다.",
  "신청서 양식은 담당자가 배포하고 다른 사람이 직접 작성해 제출하는 빈 양식으로 만드세요. 사용자가 입력한 값은 양식 설계와 안내 정보이며, 신청자가 이미 작성한 답변처럼 서술하지 마세요. 수집할 항목마다 '항목명: ______' 형식의 빈 작성란을 제공하세요.",
  "content에는 Markdown 기호를 쓰지 말고 일반 텍스트만 반환하세요. 각 소제목은 별도 한 줄에 쓰고, 소제목 다음에는 줄바꿈한 본문을 배치하세요.",
  "서로 다른 내용 영역 사이에는 빈 줄을 하나 넣으세요. 번호가 있는 항목도 반드시 새 줄에서 시작하고, 여러 항목을 한 문단에 이어 붙이지 마세요.",
  "한 문단은 최대 2~3문장으로 제한해 읽기 쉽게 구성하세요.",
  "사용자가 적은 사실의 의미를 바꾸지 말고, 개인정보나 민감정보를 추가로 추론하지 마세요.",
].join("\n");

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  model: "gemini-3.1-flash-lite",
  systemInstruction,
  generationConfig: {
    temperature: 0.35,
    maxOutputTokens: 3072,
    responseMimeType: "application/json",
    responseJsonSchema,
  },
});

const searchModel = getGenerativeModel(ai, {
  model: "gemini-3.1-flash-lite",
  systemInstruction: [
    "당신은 저장된 행정 문서를 찾아주는 의미 기반 검색 도우미입니다.",
    "검색어가 문서에 그대로 포함되지 않아도 주제, 목적, 대상, 업무 맥락이 관련되면 결과에 포함하세요.",
    "관련성이 높은 순서대로 문서 ID만 반환하고, 관련 없는 문서는 반환하지 마세요.",
  ].join("\n"),
  generationConfig: {
    temperature: 0.05,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["documentIds"],
      properties: {
        documentIds: { type: "array", maxItems: 20, items: { type: "string" } },
      },
    },
  },
});

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function improveDocumentSpacing(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/([가-힣][.!?])\s+(?=\d+[.)]\s+[가-힣])/g, "$1\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export async function generateDocumentWithAi({
  documentType,
  fields,
  additionalRequest,
}: {
  documentType: string;
  fields: DocumentFieldInput[];
  additionalRequest: string;
}): Promise<AiGeneratedDocument> {
  const providedFields = fields.filter((field) => field.value.trim());
  const fieldText = providedFields.map((field) => `- ${field.label}: ${field.value.trim()}`).join("\n");
  const prompt = [
    `문서 종류: ${documentType}`,
    "사용자가 입력한 정보:",
    fieldText || "- 입력된 세부 정보 없음",
    additionalRequest.trim() ? `추가 요청:\n${additionalRequest.trim()}` : "추가 요청: 없음",
    documentType.includes("신청서")
      ? "위 정보로 담당자가 배포하고 신청자가 빈칸을 직접 작성해 제출할 수 있는 신청서 양식을 만드세요."
      : "위 정보만 사실로 사용해 완성된 문서 초안을 작성하세요.",
  ].join("\n\n");

  const result = await model.generateContent(prompt.slice(0, 14_000));
  const parsed = JSON.parse(result.response.text()) as Record<string, unknown>;
  const title = cleanText(parsed.title, 140);
  const content = improveDocumentSpacing(cleanText(parsed.content, 12_000));

  if (!title || !content) throw new Error("invalid-ai-response");

  return {
    title,
    content,
    summary: cleanText(parsed.summary, 240) || `${documentType} 초안을 작성했습니다.`,
  };
}

export async function searchDocumentsWithAi(query: string, documents: SearchableDocument[]): Promise<string[]> {
  if (!query.trim() || !documents.length) return [];
  const candidates = documents.slice(0, 40).map((document) => ({
    id: document.id,
    title: document.title.slice(0, 120),
    text: document.text.replace(/\s+/g, " ").slice(0, 1200),
  }));
  const result = await searchModel.generateContent([
    `검색어: ${query.trim().slice(0, 200)}`,
    "저장 문서 목록:",
    JSON.stringify(candidates),
    "검색어와 의미상 관련된 문서 ID를 관련성 높은 순서로 반환하세요.",
  ].join("\n\n"));
  const parsed = JSON.parse(result.response.text()) as { documentIds?: unknown };
  const validIds = new Set(candidates.map((document) => document.id));
  return Array.isArray(parsed.documentIds)
    ? parsed.documentIds.filter((id): id is string => typeof id === "string" && validIds.has(id))
    : [];
}
