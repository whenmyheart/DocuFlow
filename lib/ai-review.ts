import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { firebaseApp } from "@/lib/firebase-documents";

export type AiReviewIssue = {
  id: string;
  label: string;
  appendLabel: string;
  title: string;
  evidence: string;
  explanation: string;
  fixExample: string;
};

export type AiReviewResult = {
  issues: AiReviewIssue[];
  summary: string;
};

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "issues"],
  properties: {
    summary: { type: "string", description: "문서의 용도와 검토 결과를 한 문장으로 요약한 한국어 문장" },
    issues: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "appendLabel", "title", "evidence", "explanation", "fixExample"],
        properties: {
          id: { type: "string", description: "영문 소문자와 하이픈으로 된 짧은 식별자" },
          label: { type: "string", description: "누락된 정보 항목명" },
          appendLabel: { type: "string", description: "본문 하단에 추가할 '항목명:' 형식의 빈 입력 항목" },
          title: { type: "string", description: "'정보 누락'으로 끝나는 짧은 제목" },
          evidence: { type: "string", description: "누락 판단의 근거가 된 원문 속 문장 또는 구절" },
          explanation: { type: "string", description: "왜 실제 정보가 필요하지만 빠졌는지 설명" },
          fixExample: { type: "string", description: "가상 정보로 작성한 짧은 수정 예시" },
        },
      },
    },
  },
};

const systemInstruction = [
  "당신은 대한민국 공공기관의 신청서 양식 배포 전 검토자입니다.",
  "본문 전체를 읽고 이 문서의 실제 용도와 사용 절차를 먼저 추론하세요.",
  "고정된 필수 항목 목록을 대입하지 마세요. 본문이 독자에게 어떤 행동을 요구하거나 다른 위치의 정보를 참조하게 할 때만 그 행동에 필요한 구체 정보가 실제로 적혀 있는지 판단하세요.",
  "예: '기간에 맞춰 제출', '기간은 하단에 기재'라고 했지만 날짜나 상시 접수 여부가 없으면 기간 누락입니다. 반대로 본문 어디든 실제 날짜가 있으면 누락이 아닙니다.",
  "문의, 사이트, 제출처, 첨부서류, 비용뿐 아니라 계좌, 대상, 자격, 운영시간, 장소, 선정 기준 등 문맥상 필요한 다른 항목도 발견할 수 있습니다.",
  "단순히 일반적인 신청서에 있으면 좋을 법한 정보는 추가하지 마세요. 원문 표현으로 필요성이 드러나는 항목만 지적하세요.",
  "evidence는 반드시 원문에서 그대로 인용하고, fixExample은 실제 개인정보가 아닌 가상 예시를 사용하세요.",
  "문서에 필요한 구체 정보가 모두 있으면 issues를 빈 배열로 반환하세요.",
].join("\n");

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  model: "gemini-3.5-flash",
  systemInstruction,
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
    responseJsonSchema,
  },
});

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeIssue(value: unknown, index: number): AiReviewIssue {
  const issue = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const label = cleanText(issue.label, 40) || `누락 항목 ${index + 1}`;
  const appendLabel = cleanText(issue.appendLabel, 50).replace(/[：:]?$/, ":");

  return {
    id: cleanText(issue.id, 60).replace(/[^a-z0-9-]/gi, "-").toLowerCase() || `issue-${index + 1}`,
    label,
    appendLabel: appendLabel || `${label}:`,
    title: cleanText(issue.title, 80) || `${label} 정보 누락`,
    evidence: cleanText(issue.evidence, 300),
    explanation: cleanText(issue.explanation, 300),
    fixExample: cleanText(issue.fixExample, 200),
  };
}

export async function reviewDocumentWithAi(text: string): Promise<AiReviewResult> {
  const result = await model.generateContent(`다음은 행정 담당자가 배포하려는 신청서 양식의 전체 본문입니다.\n\n<document>\n${text.slice(0, 10_000)}\n</document>`);
  const parsed = JSON.parse(result.response.text()) as { issues?: unknown[]; summary?: unknown };
  const issues = Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8).map(normalizeIssue) : [];

  return {
    issues,
    summary: cleanText(parsed.summary, 300) || (issues.length ? "본문의 문맥상 필요한 정보 중 누락된 항목이 있습니다." : "본문의 문맥상 필요한 정보가 기재되어 있습니다."),
  };
}
