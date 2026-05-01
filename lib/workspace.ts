import type { AskResponse } from "./types";

export type WorkerTrainingStatus = "이수" | "당일 교육 예정" | "확인 필요";
export type WorkerExperienceLevel = "숙련" | "중간" | "신규";

export type WorkerProfile = {
  id: string;
  displayName: string;
  role: string;
  joinedAt: string;
  experienceLevel: WorkerExperienceLevel;
  experienceSummary: string;
  nationality: string;
  languageCode: string;
  languageLabel: string;
  isNewWorker: boolean;
  isForeignWorker: boolean;
  trainingStatus: WorkerTrainingStatus;
  trainingSummary: string;
  phone?: string;
  email?: string;
};

export type EducationRecordDraft = {
  workerId: string;
  topic: string;
  languageCode: string;
  languageLabel: string;
  confirmationStatus: WorkerTrainingStatus;
  confirmationMethod: string;
  memo: string;
};

export type RecipientSuggestion = {
  label: string;
  value: string;
  channel: "email" | "sms";
  languageCode: string;
  languageLabel: string;
};

export type WorkerDispatchTarget = {
  displayName: string;
  role: string;
  nationality: string;
  languageCode: string;
  languageLabel: string;
  trainingStatus: WorkerTrainingStatus;
  phoneMasked?: string;
  emailMasked?: string;
};

export function maskPhone(value?: string) {
  const digits = (value || "").replace(/[^0-9]/g, "");
  if (digits.length < 8) return value || "";
  return digits.replace(/(\d{3})\d+(\d{4})/, "$1****$2");
}

export function maskEmail(value?: string) {
  if (!value) return "";
  const [name, domain] = value.split("@");
  if (!name || !domain) return value;
  return `${name.slice(0, 2)}***@${domain}`;
}

function includesForeignWorkerContext(question: string) {
  return /외국인|다국어|베트남|중국|몽골|태국|필리핀|우즈베키스탄|캄보디아/i.test(question);
}

export function buildDefaultWorkers(data: AskResponse): WorkerProfile[] {
  const hasForeignWorkers = includesForeignWorkerContext(data.question);
  const primaryForeignLanguage = data.deliverables.foreignWorkerLanguages[0] || {
    code: "vi",
    label: "베트남어",
    nativeLabel: "Tiếng Việt"
  };

  const baseWorkers: WorkerProfile[] = [
    {
      id: "worker-supervisor-1",
      displayName: "관리자 A",
      role: "현장관리자",
      joinedAt: "2026-04-01",
      experienceLevel: "숙련",
      experienceSummary: "동종 작업 관리 경험 보유",
      nationality: "대한민국",
      languageCode: "ko",
      languageLabel: "한국어",
      isNewWorker: false,
      isForeignWorker: false,
      trainingStatus: "이수",
      trainingSummary: "정기 안전보건교육 이수, TBM 진행 가능",
      phone: "01000000001",
      email: "supervisor@safeguard.local"
    },
    {
      id: "worker-new-1",
      displayName: "신규 작업자 B",
      role: "작업자",
      joinedAt: "2026-04-22",
      experienceLevel: "신규",
      experienceSummary: "우리 현장 신규 투입, 작업 전 보호구·동선 재확인 필요",
      nationality: "대한민국",
      languageCode: "ko",
      languageLabel: "한국어",
      isNewWorker: true,
      isForeignWorker: false,
      trainingStatus: "당일 교육 예정",
      trainingSummary: "작업 전 TBM과 신규 투입자 교육 확인 필요",
      phone: "01000000002"
    }
  ];

  if (!hasForeignWorkers) return baseWorkers;

  return [
    ...baseWorkers,
    {
      id: "worker-foreign-1",
      displayName: "외국인 작업자 C",
      role: "작업자",
      joinedAt: "2026-04-18",
      experienceLevel: "중간",
      experienceSummary: "동종 작업 경험은 있으나 우리 현장 작업중지 기준 재확인 필요",
      nationality: primaryForeignLanguage.code === "zh" ? "중국" : primaryForeignLanguage.code === "mn" ? "몽골" : "베트남",
      languageCode: primaryForeignLanguage.code,
      languageLabel: primaryForeignLanguage.label,
      isNewWorker: false,
      isForeignWorker: true,
      trainingStatus: "당일 교육 예정",
      trainingSummary: `${primaryForeignLanguage.label} 쉬운 문장 안내와 관리자 확인 필요`,
      phone: "01000000003"
    }
  ];
}

export function buildEducationRecordDrafts(workers: WorkerProfile[], workSummary: string): EducationRecordDraft[] {
  return workers.map((worker) => ({
    workerId: worker.id,
    topic: `${workSummary} 작업 전 안전교육`,
    languageCode: worker.languageCode,
    languageLabel: worker.languageLabel,
    confirmationStatus: worker.trainingStatus,
    confirmationMethod: worker.isForeignWorker ? "언어별 안내 후 구두 확인" : "TBM 참석 및 서명 확인",
    memo: worker.trainingSummary
  }));
}

export function buildRecipientSuggestions(workers: WorkerProfile[]): RecipientSuggestion[] {
  return workers.flatMap((worker) => {
    const recipients: RecipientSuggestion[] = [];
    if (worker.phone) {
      recipients.push({
        label: `${worker.displayName} 문자`,
        value: worker.phone,
        channel: "sms",
        languageCode: worker.languageCode,
        languageLabel: worker.languageLabel
      });
    }
    if (worker.email) {
      recipients.push({
        label: `${worker.displayName} 메일`,
        value: worker.email,
        channel: "email",
        languageCode: worker.languageCode,
        languageLabel: worker.languageLabel
      });
    }
    return recipients;
  });
}

export function buildWorkerDispatchTargets(workers: WorkerProfile[]): WorkerDispatchTarget[] {
  return workers.map((worker) => ({
    displayName: worker.displayName,
    role: worker.role,
    nationality: worker.nationality,
    languageCode: worker.languageCode,
    languageLabel: worker.languageLabel,
    trainingStatus: worker.trainingStatus,
    phoneMasked: maskPhone(worker.phone),
    emailMasked: maskEmail(worker.email)
  }));
}

export function summarizeWorkers(workers: WorkerProfile[]) {
  const selectedCount = workers.length;
  const foreignCount = workers.filter((worker) => worker.isForeignWorker).length;
  const newCount = workers.filter((worker) => worker.isNewWorker || worker.experienceLevel === "신규").length;
  const educationPendingCount = workers.filter((worker) => worker.trainingStatus !== "이수").length;
  const contactReadyCount = workers.filter((worker) => worker.phone || worker.email).length;

  return {
    selectedCount,
    foreignCount,
    newCount,
    educationPendingCount,
    contactReadyCount
  };
}
