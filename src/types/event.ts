export type EventLocation = "와우" | "아이디";

/**
 * 이벤트 업무 — 관리자가 입력하는 기획 정보와
 * 직원이 입력하는 진행 정보를 하나로 합친 단일 항목.
 */
export interface EventTask {
  id: string;
  // ── 관리자 입력 항목 ──
  title: string;                 // 이벤트 제목
  roundMonth: number | null;     // 차수 - 월 (예: 7)
  roundSession: number | null;   // 차수 - 차시 (예: 1)
  location: EventLocation;       // 장소
  startDate: Date;               // 이벤트 기간 시작
  endDate: Date;                 // 이벤트 기간 종료
  planningDeadline: Date | null; // 기획 마감일
  designDeadline: Date | null;   // 디자인 마감일
  notes: string;                 // 특이사항
  // ── 직원 입력 항목 ──
  uploadDate: Date | null;       // 이벤트 업로드일
  budget: number;                // 총 예산
  completed: boolean;            // 업무 완료 여부
  // ── 메타 ──
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 차수 표시 문자열 (예: 7월 1차 → "7-1") */
export function formatRound(month: number | null, session: number | null): string {
  if (month == null || session == null) return "";
  return `${month}-${session}`;
}

export interface EventTaskInput {
  title: string;
  roundMonth?: number | null;
  roundSession?: number | null;
  location?: EventLocation;
  startDate: Date;
  endDate: Date;
  planningDeadline?: Date | null;
  designDeadline?: Date | null;
  notes: string;
  uploadDate?: Date | null;
  budget?: number;
  completed?: boolean;
}
