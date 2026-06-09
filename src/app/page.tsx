"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { EventTask, EventTaskInput, EventLocation } from "@/types/event";
import { formatRound } from "@/types/event";
import { subscribeEventTasks, updateEventTask } from "@/lib/events";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import XAccountPanel from "@/components/x-account-panel";
import Link from "next/link";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
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

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const EVENT_LOCATION_COLORS: Record<EventLocation, string> = {
  "와우": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "아이디": "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

const LOCATION_BADGE: Record<EventLocation, string> = {
  "와우": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "아이디": "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

/* ─── Calendar component ─── */
type CalendarItem = { title: string; urgent?: boolean; position?: "single" | "start" | "middle" | "end"; color?: string };

function CalendarView({
  currentYear,
  currentMonth,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onDateClick,
  itemMap,
  selectedInfo,
}: {
  currentYear: number;
  currentMonth: number;
  selectedDate: Date | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDateClick: (day: number) => void;
  itemMap: Map<string, CalendarItem[]>;
  selectedInfo?: React.ReactNode;
}) {
  const today = new Date();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const isToday = (day: number) =>
    today.getFullYear() === currentYear &&
    today.getMonth() === currentMonth &&
    today.getDate() === day;

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === currentYear &&
      selectedDate.getMonth() === currentMonth &&
      selectedDate.getDate() === day
    );
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={onPrevMonth}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {currentYear}년 {currentMonth + 1}월
          </h2>
          <Button variant="ghost" size="icon" onClick={onNextMonth}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-1.5 ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px border-t border-border">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[72px] border-b border-border" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayOfWeek = (firstDay + i) % 7;
            const items = itemMap.get(`${currentYear}-${currentMonth}-${day}`) ?? [];
            const selected = isSelected(day);
            const todayFlag = isToday(day);
            const maxShow = 3;

            return (
              <button
                key={day}
                onClick={() => onDateClick(day)}
                className={`
                  relative min-h-[72px] flex flex-col items-start pt-1 border-b border-border
                  text-left transition-all
                  ${todayFlag && !selected ? "bg-primary/5" : ""}
                  ${selected ? "bg-accent" : "hover:bg-accent/50"}
                `}
              >
                <span
                  className={`text-xs font-medium mb-0.5 ${
                    selected
                      ? "ml-0.5 w-6 h-6 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center font-bold"
                      : `px-1 ${todayFlag ? "text-primary font-bold" : ""} ${
                          !todayFlag && dayOfWeek === 0 ? "text-red-500 dark:text-red-400" : ""
                        } ${
                          !todayFlag && dayOfWeek === 6 ? "text-blue-500 dark:text-blue-400" : ""
                        }`
                  }`}
                >
                  {day}
                </span>
                {items.length > 0 && (
                  <div className="w-full space-y-px overflow-hidden">
                    {items.slice(0, maxShow).map((item, idx) => {
                      const pos = item.position ?? "single";
                      const showTitle = pos === "single" || pos === "start";
                      const rounding =
                        pos === "single" ? "rounded-sm mx-0.5" :
                        pos === "start" ? "rounded-l-sm ml-0.5" :
                        pos === "end" ? "rounded-r-sm mr-0.5" : "";
                      return (
                        <div
                          key={idx}
                          className={`text-[10px] leading-tight truncate px-1 py-px ${rounding} ${
                            item.urgent
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : item.color ?? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {showTitle ? item.title : " "}
                        </div>
                      );
                    })}
                    {items.length > maxShow && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{items.length - maxShow}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          {selectedInfo}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const today = new Date();

  const [items, setItems] = useState<EventTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 직원 인라인 편집(업로드일/예산) 로컬 상태
  const [editUpload, setEditUpload] = useState("");
  const [editBudget, setEditBudget] = useState("");

  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsub = subscribeEventTasks(
      (data) => { setItems(data); setLoading(false); setFirebaseError(null); },
      (err) => { setFirebaseError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, []);

  /* 달력 아이템 맵: 기획 마감일을 단일 마커로 표시 */
  const itemMap = new Map<string, CalendarItem[]>();
  items.forEach((ev) => {
    if (!ev.planningDeadline) return;
    const dl = new Date(ev.planningDeadline);
    dl.setHours(0, 0, 0, 0);
    const key = `${dl.getFullYear()}-${dl.getMonth()}-${dl.getDate()}`;
    const arr = itemMap.get(key) ?? [];
    const roundLabel = formatRound(ev.roundMonth, ev.roundSession);
    const label = roundLabel ? `${roundLabel} ${ev.title}` : ev.title;
    arr.push({ title: label, position: "single", color: EVENT_LOCATION_COLORS[ev.location] });
    itemMap.set(key, arr);
  });

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  /* 목록: 기획 마감일 기준 필터 (마감일 오름차순) */
  const filteredItems = (
    selectedDate
      ? items.filter((ev) => ev.planningDeadline && sameDay(ev.planningDeadline, selectedDate))
      : items.filter((ev) => {
          if (!ev.planningDeadline) return false;
          const dl = ev.planningDeadline;
          return dl.getFullYear() === calYear && dl.getMonth() === calMonth;
        })
  ).sort(
    (a, b) => (a.planningDeadline?.getTime() ?? 0) - (b.planningDeadline?.getTime() ?? 0)
  );

  const handleDateClick = (day: number) => {
    const clicked = new Date(calYear, calMonth, day);
    if (
      selectedDate &&
      selectedDate.getFullYear() === clicked.getFullYear() &&
      selectedDate.getMonth() === clicked.getMonth() &&
      selectedDate.getDate() === clicked.getDate()
    ) {
      setSelectedDate(null);
    } else {
      setSelectedDate(clicked);
    }
  };

  const handleExpand = (ev: EventTask) => {
    if (expandedId === ev.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ev.id);
    setEditUpload(ev.uploadDate ? formatDate(ev.uploadDate) : "");
    setEditBudget(ev.budget ? String(ev.budget) : "");
  };

  const handleToggleComplete = (ev: EventTask) => {
    updateEventTask(ev.id, { completed: !ev.completed } as Partial<EventTaskInput>).catch(console.error);
  };

  const handleSaveUpload = (ev: EventTask) => {
    const next = editUpload ? new Date(editUpload + "T00:00:00") : null;
    updateEventTask(ev.id, { uploadDate: next } as Partial<EventTaskInput>).catch(console.error);
  };

  const handleSaveBudget = (ev: EventTask) => {
    updateEventTask(ev.id, { budget: Number(editBudget) || 0 } as Partial<EventTaskInput>).catch(console.error);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm px-6 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground tracking-tight">AC&apos;SCENT EVENT</h1>
            <span className="hidden sm:inline text-sm text-muted-foreground">이벤트 업무 관리 대시보드</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/report">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                리포트
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                관리자
              </Button>
            </Link>
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

      {firebaseError && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            <p className="font-semibold">Firebase 연결 오류</p>
            <p className="mt-1 break-all">{firebaseError}</p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <Tabs defaultValue="events">
          <TabsList className="mb-5">
            <TabsTrigger value="events">이벤트 일정</TabsTrigger>
            <TabsTrigger value="accounts">X 계정 관리</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar */}
          <div className="lg:flex-[3] min-w-0">
            <CalendarView
              currentYear={calYear}
              currentMonth={calMonth}
              selectedDate={selectedDate}
              onPrevMonth={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                else setCalMonth(calMonth - 1);
              }}
              onNextMonth={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                else setCalMonth(calMonth + 1);
              }}
              onDateClick={handleDateClick}
              itemMap={itemMap}
              selectedInfo={
                <div className="space-y-2">
                  <div className="flex items-center gap-3 justify-center">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="w-3 h-3 rounded-sm bg-violet-100 dark:bg-violet-950 border border-violet-300 dark:border-violet-700" /> 와우
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="w-3 h-3 rounded-sm bg-pink-100 dark:bg-pink-950 border border-pink-300 dark:border-pink-700" /> 아이디
                    </span>
                  </div>
                  {selectedDate ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일
                        </span>{" "}
                        기획 마감 {filteredItems.length}건
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} className="text-xs">
                        전체 보기
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">날짜를 클릭하면 해당 기획 마감일의 업무만 표시됩니다</p>
                  )}
                </div>
              }
            />
          </div>

          {/* List */}
          <div className="lg:flex-[2] min-w-0">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              기획 마감 목록
              <span className="ml-2 text-sm font-normal text-muted-foreground">{filteredItems.length}건</span>
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div></CardContent></Card>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">
                    {selectedDate ? "해당 날짜에 기획 마감 업무가 없습니다." : `${calMonth + 1}월 기획 마감 업무가 없습니다.`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((ev) => {
                  const isExpanded = expandedId === ev.id;
                  const planDday = ev.planningDeadline ? getDDay(ev.planningDeadline) : null;
                  return (
                    <Card key={ev.id} className={`transition-shadow hover:shadow-md ${ev.completed ? "opacity-60" : ""}`}>
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          {/* 완료 토글 */}
                          <button
                            onClick={() => handleToggleComplete(ev)}
                            className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              ev.completed
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-muted-foreground/30 hover:border-muted-foreground/50"
                            }`}
                            title={ev.completed ? "미완료로 변경" : "완료로 변경"}
                          >
                            {ev.completed && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          <button
                            className="flex-1 min-w-0 text-left"
                            onClick={() => handleExpand(ev)}
                          >
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${LOCATION_BADGE[ev.location]}`}>
                              {ev.location}
                            </Badge>
                            {formatRound(ev.roundMonth, ev.roundSession) && (
                              <Badge variant="outline" className="text-[11px] px-1.5 py-0">{formatRound(ev.roundMonth, ev.roundSession)}</Badge>
                            )}
                            <h3 className={`font-semibold text-foreground ${ev.completed ? "line-through text-muted-foreground" : ""}`}>{ev.title}</h3>
                            {ev.completed && (
                              <Badge variant="secondary" className="text-[11px] px-1.5 py-0 ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                완료
                              </Badge>
                            )}
                            <svg className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${ev.completed ? "" : "ml-auto"} ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>

                          <p className="text-sm text-muted-foreground mt-1.5">
                            {formatShortDate(ev.startDate)} ~ {formatShortDate(ev.endDate)}
                          </p>

                          {/* 마감/업로드/예산 배지 */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {ev.planningDeadline && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                기획 {formatShortDate(ev.planningDeadline)}
                                {planDday && (
                                  <span className={planDday.passed ? "text-destructive" : planDday.urgent ? "text-red-500 dark:text-red-400 font-semibold" : "opacity-70"}>
                                    ({planDday.text})
                                  </span>
                                )}
                              </span>
                            )}
                            {ev.designDeadline && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                디자인 {formatShortDate(ev.designDeadline)}
                              </span>
                            )}
                            {ev.uploadDate && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                업로드 {formatShortDate(ev.uploadDate)}
                              </span>
                            )}
                            {ev.budget > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                예산 {ev.budget.toLocaleString()}원
                              </span>
                            )}
                          </div>

                          {ev.notes && (
                            <p className="text-sm text-muted-foreground mt-2 flex items-start gap-1.5">
                              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="line-clamp-3">{ev.notes}</span>
                            </p>
                          )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border">
                            {/* 직원 입력: 업로드일 / 예산 */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-semibold text-muted-foreground">이벤트 업로드일</label>
                                <Input
                                  type="date"
                                  value={editUpload}
                                  onChange={(e) => setEditUpload(e.target.value)}
                                  onBlur={() => handleSaveUpload(ev)}
                                  className="h-8 text-sm mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-muted-foreground">총 예산 (원)</label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={editBudget}
                                  onChange={(e) => setEditBudget(e.target.value)}
                                  onBlur={() => handleSaveBudget(ev)}
                                  className="h-8 text-sm mt-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="accounts">
            <XAccountPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
