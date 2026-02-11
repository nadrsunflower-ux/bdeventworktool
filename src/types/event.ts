export type EventLocation = "와우" | "아이디";

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location: EventLocation;
  notes: string;
  revenue: number;
  visitors: number;
  checklist: ChecklistItem[];
  hasOrganizer: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_CHECKLIST_TEXTS = [
  "기획안",
  "동발주전달",
  "X 세팅",
  "디피물품&굿즈 구매",
  "X&사이트 업로드",
  "디피",
  "이벤트 종료 및 추가 안내",
  "알티 선물 발송",
];

export function createDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_TEXTS.map((text, i) => ({
    id: `default-${i}`,
    text,
    completed: false,
  }));
}

export interface CalendarEventInput {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: EventLocation;
  notes: string;
  revenue?: number;
  visitors?: number;
  checklist?: ChecklistItem[];
  hasOrganizer?: boolean;
}
