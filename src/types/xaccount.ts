export type XAccountStatus = "사용중" | "사용대기" | "사용완료" | "삭제" | "미지정";

export const X_ACCOUNT_STATUSES: XAccountStatus[] = [
  "사용중",
  "사용대기",
  "사용완료",
  "삭제",
  "미지정",
];

/**
 * X(트위터) 계정 관리 항목.
 * 구글 시트(이름 / 트위터 아이디 / 메일 / 비밀번호 / 상태)를 그대로 옮긴 모델.
 */
export interface XAccount {
  id: string;
  name: string;        // 이름 (담당 아티스트 등)
  twitterId: string;   // 트위터 아이디
  email: string;       // 메일 (@ 없으면 @neader.co.kr 가 붙는 로컬 파트)
  password: string;    // 비밀번호
  status: XAccountStatus; // 상태
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface XAccountInput {
  name: string;
  twitterId: string;
  email: string;
  password: string;
  status: XAccountStatus;
}

const EMAIL_SUFFIX = "@neader.co.kr";

/** 저장값을 완전한 메일 주소로 변환 (이미 @ 포함 시 그대로) */
export function formatEmail(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return v.includes("@") ? v : v + EMAIL_SUFFIX;
}
