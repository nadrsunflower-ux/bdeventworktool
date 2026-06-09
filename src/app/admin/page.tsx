"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventTask, EventTaskInput, EventLocation } from "@/types/event";
import { formatRound } from "@/types/event";
import {
  addEventTask,
  updateEventTask,
  deleteEventTask,
  subscribeEventTasks,
} from "@/lib/events";
import Link from "next/link";

const ADMIN_PASSWORD = "0312";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDDay(deadline: Date): { text: string; urgent: boolean; passed: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return { text: "D-Day", urgent: true, passed: false };
  if (diff > 0) return { text: `D-${diff}`, urgent: diff <= 3, passed: false };
  return { text: `D+${Math.abs(diff)}`, urgent: false, passed: true };
}

// 차수의 '월'(roundMonth) 기준으로 그룹핑. 차수 미지정은 '기타'로 묶고 맨 뒤에 배치.
function groupByRoundMonth(items: EventTask[]): { key: string; label: string; items: EventTask[] }[] {
  const groups = new Map<string, EventTask[]>();
  items.forEach((item) => {
    const key = item.roundMonth != null ? String(item.roundMonth) : "기타";
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === "기타") return 1;
      if (b === "기타") return -1;
      return Number(a) - Number(b);
    })
    .map(([key, grpItems]) => ({
      key,
      label: key === "기타" ? "차수 미지정" : `${key}월`,
      items: [...grpItems].sort((x, y) => (x.roundSession ?? 999) - (y.roundSession ?? 999)),
    }));
}

const LOCATION_BADGE: Record<EventLocation, string> = {
  "와우": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "아이디": "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

/* ─── Password Gate ─── */
function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_auth", "true");
      onSuccess();
    } else {
      setError(true);
      setPw("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">관리자 인증</h2>
            <p className="text-sm text-muted-foreground mt-1">비밀번호를 입력하세요</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false); }}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">비밀번호가 올바르지 않습니다.</p>
            )}
            <Button type="submit" className="w-full" disabled={!pw}>
              로그인
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              메인으로 돌아가기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Admin Dashboard ─── */
function AdminDashboard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [items, setItems] = useState<EventTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventTask | null>(null);

  // 관리자 입력 필드
  const [fTitle, setFTitle] = useState("");
  const [fRoundMonth, setFRoundMonth] = useState("");
  const [fRoundSession, setFRoundSession] = useState("");
  const [fLocation, setFLocation] = useState<EventLocation>("와우");
  const [fStartDate, setFStartDate] = useState(formatDate(new Date()));
  const [fEndDate, setFEndDate] = useState(formatDate(new Date()));
  const [fPlanningDeadline, setFPlanningDeadline] = useState("");
  const [fDesignDeadline, setFDesignDeadline] = useState("");
  const [fNotes, setFNotes] = useState("");
  // 직원 입력 필드 (관리자도 수정 가능)
  const [fUploadDate, setFUploadDate] = useState("");
  const [fBudget, setFBudget] = useState("");
  const [fCompleted, setFCompleted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsub = subscribeEventTasks(
      (data) => { setItems(data); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const resetForm = useCallback(() => {
    setFTitle("");
    setFRoundMonth("");
    setFRoundSession("");
    setFLocation("와우");
    setFStartDate(formatDate(new Date()));
    setFEndDate(formatDate(new Date()));
    setFPlanningDeadline("");
    setFDesignDeadline("");
    setFNotes("");
    setFUploadDate("");
    setFBudget("");
    setFCompleted(false);
    setEditing(null);
  }, []);

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: EventTask) => {
    setEditing(item);
    setFTitle(item.title);
    setFRoundMonth(item.roundMonth != null ? String(item.roundMonth) : "");
    setFRoundSession(item.roundSession != null ? String(item.roundSession) : "");
    setFLocation(item.location);
    setFStartDate(formatDate(item.startDate));
    setFEndDate(formatDate(item.endDate));
    setFPlanningDeadline(item.planningDeadline ? formatDate(item.planningDeadline) : "");
    setFDesignDeadline(item.designDeadline ? formatDate(item.designDeadline) : "");
    setFNotes(item.notes);
    setFUploadDate(item.uploadDate ? formatDate(item.uploadDate) : "");
    setFBudget(item.budget ? String(item.budget) : "");
    setFCompleted(item.completed);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!fTitle.trim()) return;
    const startDate = new Date(fStartDate + "T00:00:00");
    const endDate = new Date(fEndDate + "T00:00:00");
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert("이벤트 시작일/종료일을 확인해주세요.");
      return;
    }
    const input: EventTaskInput = {
      title: fTitle.trim(),
      roundMonth: fRoundMonth ? Number(fRoundMonth) : null,
      roundSession: fRoundSession ? Number(fRoundSession) : null,
      location: fLocation,
      startDate,
      endDate,
      planningDeadline: fPlanningDeadline ? new Date(fPlanningDeadline + "T00:00:00") : null,
      designDeadline: fDesignDeadline ? new Date(fDesignDeadline + "T00:00:00") : null,
      notes: fNotes.trim(),
      uploadDate: fUploadDate ? new Date(fUploadDate + "T00:00:00") : null,
      budget: Number(fBudget) || 0,
      completed: fCompleted,
    };
    // 저장된 업무가 보이도록 이동할 차수(월) 탭 키 (예: "6")
    const monthKey = input.roundMonth != null ? String(input.roundMonth) : "기타";
    try {
      if (editing) {
        await updateEventTask(editing.id, input);
      } else {
        const maxOrder = items.reduce((max, t) => Math.max(max, t.order), 0);
        await addEventTask(input, maxOrder + 1);
      }
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
      return;
    }
    setSelectedMonth(monthKey);
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm("이 이벤트 업무를 삭제할까요?")) return;
    deleteEventTask(id).catch(console.error);
  };

  const groups = groupByRoundMonth(items);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    window.location.reload();
  };

  if (!mounted) return null;

  const activeMonth = selectedMonth || groups[0]?.key || "";
  const activeGroup = groups.find((g) => g.key === activeMonth);

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm px-6 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity">
              AC&apos;SCENT EVENT
            </Link>
            <Badge variant="secondary" className="text-xs">관리자</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground">
              로그아웃
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="테마 전환"
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            이벤트 업무 <span className="text-sm font-normal text-muted-foreground">{items.length}건</span>
          </h2>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} size="sm">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                이벤트 업무 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "이벤트 업무 수정" : "새 이벤트 업무 추가"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* ── 관리자 항목 ── */}
                <p className="text-xs font-semibold text-muted-foreground">관리자 입력</p>
                <div>
                  <Label htmlFor="f-title">이벤트 제목</Label>
                  <Input id="f-title" placeholder="이벤트 제목" value={fTitle} onChange={(e) => setFTitle(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>차수</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      placeholder="월"
                      value={fRoundMonth}
                      onChange={(e) => setFRoundMonth(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">월</span>
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      min={1}
                      placeholder="차시"
                      value={fRoundSession}
                      onChange={(e) => setFRoundSession(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">차시</span>
                  </div>
                </div>
                <div>
                  <Label>장소</Label>
                  <Select value={fLocation} onValueChange={(v) => setFLocation(v as EventLocation)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="와우">와우</SelectItem>
                      <SelectItem value="아이디">아이디</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="f-start">이벤트 시작일</Label>
                    <Input id="f-start" type="date" value={fStartDate} onChange={(e) => setFStartDate(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="f-end">이벤트 종료일</Label>
                    <Input id="f-end" type="date" value={fEndDate} onChange={(e) => setFEndDate(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="f-plan-dl">기획 마감일</Label>
                    <Input id="f-plan-dl" type="date" value={fPlanningDeadline} onChange={(e) => setFPlanningDeadline(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="f-design-dl">디자인 마감일</Label>
                    <Input id="f-design-dl" type="date" value={fDesignDeadline} onChange={(e) => setFDesignDeadline(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="f-notes">특이사항</Label>
                  <Textarea id="f-notes" placeholder="특이사항을 메모하세요" value={fNotes} onChange={(e) => setFNotes(e.target.value)} className="mt-1.5" rows={2} />
                </div>

                {/* ── 직원 항목 ── */}
                <div className="pt-1 border-t border-border" />
                <p className="text-xs font-semibold text-muted-foreground">직원 입력 (메인에서도 수정 가능)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="f-upload">이벤트 업로드일</Label>
                    <Input id="f-upload" type="date" value={fUploadDate} onChange={(e) => setFUploadDate(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="f-budget">총 예산 (원)</Label>
                    <Input id="f-budget" type="number" placeholder="0" value={fBudget} onChange={(e) => setFBudget(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFCompleted((v) => !v)}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      fCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40"
                    }`}
                  >
                    {fCompleted && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-foreground">업무 완료</span>
                </button>

                <Button onClick={handleSubmit} disabled={!fTitle.trim()} className="w-full">
                  {editing ? "수정 완료" : "추가"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div></CardContent></Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-3">등록된 이벤트 업무가 없습니다.</p>
              <Button variant="outline" size="sm" onClick={handleOpenCreate}>첫 이벤트 업무 추가하기</Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            <div className="flex gap-2 flex-wrap mb-4">
              {groups.map((group) => (
                <button
                  key={group.key}
                  onClick={() => setSelectedMonth(group.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    group.key === activeMonth
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {group.label}
                  <span className="ml-1 text-xs opacity-70">{group.items.length}</span>
                </button>
              ))}
            </div>
            {activeGroup ? (
              <div className="space-y-3">
                {activeGroup.items.map((item) => {
                  const planDday = item.planningDeadline ? getDDay(item.planningDeadline) : null;
                  return (
                    <Card key={item.id} className="transition-shadow hover:shadow-md">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${LOCATION_BADGE[item.location]}`}>
                                {item.location}
                              </Badge>
                              {formatRound(item.roundMonth, item.roundSession) && (
                                <Badge variant="outline" className="text-[11px] px-1.5 py-0">{formatRound(item.roundMonth, item.roundSession)}</Badge>
                              )}
                              <h3 className={`font-semibold text-foreground ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</h3>
                              <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ml-auto ${item.completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                                {item.completed ? "완료" : "미완료"}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground mt-1.5">
                              이벤트 기간 {formatShortDate(item.startDate)} ~ {formatShortDate(item.endDate)}
                            </p>

                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {item.planningDeadline && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                  기획 {formatShortDate(item.planningDeadline)}
                                  {planDday && <span className="opacity-70">({planDday.text})</span>}
                                </span>
                              )}
                              {item.designDeadline && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                  디자인 {formatShortDate(item.designDeadline)}
                                </span>
                              )}
                              {item.uploadDate && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  업로드 {formatShortDate(item.uploadDate)}
                                </span>
                              )}
                              {item.budget > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                  예산 {item.budget.toLocaleString()}원
                                </span>
                              )}
                            </div>

                            {item.notes && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.notes}</p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(item)} title="수정">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)} title="삭제">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Admin Page ─── */
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem("admin_auth") === "true");
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />;
  }

  return <AdminDashboard />;
}
