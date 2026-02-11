"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Task, Status, Priority } from "@/types/task";
import type { CalendarEvent, CalendarEventInput, EventLocation, ChecklistItem } from "@/types/event";
import { subscribeTasks, updateTask } from "@/lib/tasks";
import { subscribeEvents, updateEvent } from "@/lib/events";
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

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const STATUS_LABELS: Record<Status, string> = {
  pending: "미완료",
  completed: "완료",
};

const PRIORITY_STARS: Record<Priority, string> = {
  high: "★★★",
  medium: "★★",
  low: "★",
};

const EVENT_LOCATION_COLORS: Record<EventLocation, string> = {
  "와우": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "아이디": "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

/* ─── Calendar component (shared) ─── */
type CalendarItem = { title: string; urgent?: boolean; position?: "single" | "start" | "middle" | "end"; color?: string };

function CalendarView({
  currentYear,
  currentMonth,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onDateClick,
  itemMap,
  accentColor,
  selectedInfo,
}: {
  currentYear: number;
  currentMonth: number;
  selectedDate: Date | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDateClick: (day: number) => void;
  itemMap: Map<string, CalendarItem[]>;
  accentColor: string;
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
            const maxShow = 2;

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
                              : item.color ?? accentColor
                          }`}
                        >
                          {showTitle ? item.title : "\u00A0"}
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

/* ─── Main Page (Read-only) ─── */
export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const today = new Date();

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskCalYear, setTaskCalYear] = useState(today.getFullYear());
  const [taskCalMonth, setTaskCalMonth] = useState(today.getMonth());
  const [taskSelectedDate, setTaskSelectedDate] = useState<Date | null>(null);

  // Events state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventCalYear, setEventCalYear] = useState(today.getFullYear());
  const [eventCalMonth, setEventCalMonth] = useState(today.getMonth());
  const [eventSelectedDate, setEventSelectedDate] = useState<Date | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [newChecklistText, setNewChecklistText] = useState("");

  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsub1 = subscribeTasks(
      (t) => { setTasks(t); setTaskLoading(false); setFirebaseError(null); },
      (err) => { setFirebaseError(err.message); setTaskLoading(false); }
    );
    const unsub2 = subscribeEvents(
      (e) => { setEvents(e); setEventLoading(false); },
      (err) => { setFirebaseError(err.message); setEventLoading(false); }
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  /* Task calendar helpers */
  const taskItemMap = new Map<string, CalendarItem[]>();
  tasks.forEach((t) => {
    const d = t.deadline;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dday = getDDay(d);
    const items = taskItemMap.get(key) ?? [];
    items.push({ title: t.title, urgent: dday.urgent || dday.passed });
    taskItemMap.set(key, items);
  });

  const filteredTasks = taskSelectedDate
    ? tasks.filter((t) => {
        const d = t.deadline;
        return (
          d.getFullYear() === taskSelectedDate.getFullYear() &&
          d.getMonth() === taskSelectedDate.getMonth() &&
          d.getDate() === taskSelectedDate.getDate()
        );
      })
    : tasks.filter((t) => {
        const d = t.deadline;
        return d.getFullYear() === taskCalYear && d.getMonth() === taskCalMonth;
      });

  /* Event calendar helpers */
  const eventItemMap = new Map<string, CalendarItem[]>();
  events.forEach((ev) => {
    const start = new Date(ev.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(ev.endDate);
    end.setHours(0, 0, 0, 0);
    const isSingleDay = start.getTime() === end.getTime();
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
      let position: "single" | "start" | "middle" | "end" = "single";
      if (!isSingleDay) {
        const isFirst = cursor.getTime() === start.getTime();
        const isLast = cursor.getTime() === end.getTime();
        const dow = cursor.getDay();
        const visualStart = isFirst || dow === 0;
        const visualEnd = isLast || dow === 6;
        if (visualStart && visualEnd) position = "single";
        else if (visualStart) position = "start";
        else if (visualEnd) position = "end";
        else position = "middle";
      }
      const items = eventItemMap.get(key) ?? [];
      items.push({ title: ev.title, position, color: EVENT_LOCATION_COLORS[ev.location] });
      eventItemMap.set(key, items);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const filteredEvents = eventSelectedDate
    ? events.filter((ev) => {
        const start = new Date(ev.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(ev.endDate);
        end.setHours(0, 0, 0, 0);
        const sel = new Date(eventSelectedDate);
        sel.setHours(0, 0, 0, 0);
        return sel >= start && sel <= end;
      })
    : events.filter((ev) => {
        const monthStart = new Date(eventCalYear, eventCalMonth, 1);
        const monthEnd = new Date(eventCalYear, eventCalMonth + 1, 0);
        const start = new Date(ev.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(ev.endDate);
        end.setHours(0, 0, 0, 0);
        return start <= monthEnd && end >= monthStart;
      });

  const handleStatusToggle = (task: Task) => {
    const next = task.status === "pending" ? "completed" : "pending";
    updateTask(task.id, { status: next }).catch((err) =>
      console.error("상태 변경 오류:", err)
    );
  };

  const handleTaskDateClick = (day: number) => {
    const clicked = new Date(taskCalYear, taskCalMonth, day);
    if (
      taskSelectedDate &&
      taskSelectedDate.getFullYear() === clicked.getFullYear() &&
      taskSelectedDate.getMonth() === clicked.getMonth() &&
      taskSelectedDate.getDate() === clicked.getDate()
    ) {
      setTaskSelectedDate(null);
    } else {
      setTaskSelectedDate(clicked);
    }
  };

  const handleEventDateClick = (day: number) => {
    const clicked = new Date(eventCalYear, eventCalMonth, day);
    if (
      eventSelectedDate &&
      eventSelectedDate.getFullYear() === clicked.getFullYear() &&
      eventSelectedDate.getMonth() === clicked.getMonth() &&
      eventSelectedDate.getDate() === clicked.getDate()
    ) {
      setEventSelectedDate(null);
    } else {
      setEventSelectedDate(clicked);
    }
  };

  const handleAddChecklistItem = (ev: CalendarEvent) => {
    if (!newChecklistText.trim()) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newChecklistText.trim(),
      completed: false,
    };
    const updated = [...ev.checklist, newItem];
    updateEvent(ev.id, { checklist: updated } as Partial<CalendarEventInput>).catch(console.error);
    setNewChecklistText("");
  };

  const handleToggleChecklistItem = (ev: CalendarEvent, itemId: string) => {
    const updated = ev.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    updateEvent(ev.id, { checklist: updated } as Partial<CalendarEventInput>).catch(console.error);
  };

  const handleDeleteChecklistItem = (ev: CalendarEvent, itemId: string) => {
    const updated = ev.checklist.filter((item) => item.id !== itemId);
    updateEvent(ev.id, { checklist: updated } as Partial<CalendarEventInput>).catch(console.error);
  };

  const handleToggleOrganizer = (ev: CalendarEvent) => {
    const newHasOrganizer = !ev.hasOrganizer;
    const updatedChecklist = ev.checklist.map((item) => ({
      ...item,
      completed: newHasOrganizer ? true : false,
    }));
    updateEvent(ev.id, {
      hasOrganizer: newHasOrganizer,
      checklist: updatedChecklist,
    } as Partial<CalendarEventInput>).catch(console.error);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm px-6 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground tracking-tight">AC&apos;SCENT EVENT</h1>
            <span className="hidden sm:inline text-sm text-muted-foreground">업무 관리 대시보드</span>
          </div>
          <div className="flex items-center gap-2">
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
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="mb-6 h-12">
            <TabsTrigger value="tasks" className="text-base px-8 py-2.5">업무</TabsTrigger>
            <TabsTrigger value="events" className="text-base px-8 py-2.5">이벤트</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: 업무 ── */}
          <TabsContent value="tasks">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Calendar */}
              <div className="lg:flex-[3] min-w-0">
                <CalendarView
                  currentYear={taskCalYear}
                  currentMonth={taskCalMonth}
                  selectedDate={taskSelectedDate}
                  onPrevMonth={() => {
                    if (taskCalMonth === 0) { setTaskCalMonth(11); setTaskCalYear(taskCalYear - 1); }
                    else setTaskCalMonth(taskCalMonth - 1);
                  }}
                  onNextMonth={() => {
                    if (taskCalMonth === 11) { setTaskCalMonth(0); setTaskCalYear(taskCalYear + 1); }
                    else setTaskCalMonth(taskCalMonth + 1);
                  }}
                  onDateClick={handleTaskDateClick}
                  itemMap={taskItemMap}
                  accentColor="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  selectedInfo={
                    taskSelectedDate ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {taskSelectedDate.getMonth() + 1}월 {taskSelectedDate.getDate()}일
                          </span>{" "}
                          업무 {filteredTasks.length}건
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => setTaskSelectedDate(null)} className="text-xs">
                          전체 보기
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">날짜를 클릭하면 해당 날짜의 업무만 표시됩니다</p>
                    )
                  }
                />
              </div>

              {/* Task List (read-only) */}
              <div className="lg:flex-[2] min-w-0">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  업무 목록
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{filteredTasks.length}건</span>
                </h2>

                {taskLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div></CardContent></Card>
                    ))}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <p className="text-muted-foreground">
                        {taskSelectedDate ? "해당 날짜에 업무가 없습니다." : `${taskCalMonth + 1}월에 등록된 업무가 없습니다.`}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map((task) => {
                          const dday = getDDay(task.deadline);
                          return (
                            <Card
                              key={task.id}
                              className={`transition-shadow hover:shadow-md ${task.status === "completed" ? "opacity-60" : ""}`}
                            >
                              <CardContent className="p-4 sm:p-5">
                                <div className="flex items-start gap-3">
                                  {/* Status toggle */}
                                  <button
                                    onClick={() => handleStatusToggle(task)}
                                    className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                      task.status === "completed"
                                        ? "bg-emerald-500 border-emerald-500 text-white"
                                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                                    }`}
                                    title={task.status === "completed" ? "미완료로 변경" : "완료로 변경"}
                                  >
                                    {task.status === "completed" && (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                      <h3 className={`font-semibold text-foreground ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                        {task.title}
                                      </h3>
                                      <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${STATUS_STYLES[task.status]}`}>
                                        {STATUS_LABELS[task.status]}
                                      </Badge>
                                      <span className="text-amber-500 dark:text-amber-400 text-xs">
                                        {PRIORITY_STARS[task.priority ?? "medium"]}
                                      </span>
                                      {dday.urgent && task.status !== "completed" && (
                                        <Badge variant="destructive" className="text-[11px] px-1.5 py-0 animate-pulse">마감 임박</Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
                                      {task.eventPeriod && (
                                        <p className="flex items-center gap-1.5">
                                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          {task.eventPeriod}
                                        </p>
                                      )}
                                      {task.location && (
                                        <p className="flex items-center gap-1.5">
                                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                          {task.location}
                                        </p>
                                      )}
                                      {task.notes && (
                                        <p className="flex items-start gap-1.5">
                                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <span className="line-clamp-2">{task.notes}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right side */}
                                  <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                                    {task.designDeadline && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                                        </svg>
                                        디자인 마감 {formatShortDate(task.designDeadline)}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      기획 마감 {formatShortDate(task.deadline)}
                                    </span>
                                    <p className={`text-sm font-bold ${
                                      dday.passed ? "text-destructive" : dday.text === "D-Day" ? "text-orange-500" : dday.urgent ? "text-red-500" : "text-primary"
                                    }`}>
                                      {dday.text}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 2: 이벤트 ── */}
          <TabsContent value="events">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Event Calendar */}
              <div className="lg:flex-[3] min-w-0">
                <CalendarView
                  currentYear={eventCalYear}
                  currentMonth={eventCalMonth}
                  selectedDate={eventSelectedDate}
                  onPrevMonth={() => {
                    if (eventCalMonth === 0) { setEventCalMonth(11); setEventCalYear(eventCalYear - 1); }
                    else setEventCalMonth(eventCalMonth - 1);
                  }}
                  onNextMonth={() => {
                    if (eventCalMonth === 11) { setEventCalMonth(0); setEventCalYear(eventCalYear + 1); }
                    else setEventCalMonth(eventCalMonth + 1);
                  }}
                  onDateClick={handleEventDateClick}
                  itemMap={eventItemMap}
                  accentColor="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
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
                      {eventSelectedDate ? (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {eventSelectedDate.getMonth() + 1}월 {eventSelectedDate.getDate()}일
                            </span>{" "}
                            이벤트 {filteredEvents.length}건
                          </p>
                          <Button variant="ghost" size="sm" onClick={() => setEventSelectedDate(null)} className="text-xs">
                            전체 보기
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center">날짜를 클릭하면 해당 날짜의 이벤트만 표시됩니다</p>
                      )}
                    </div>
                  }
                />
              </div>

              {/* Event List */}
              <div className="lg:flex-[2] min-w-0">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  이벤트 목록
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{filteredEvents.length}건</span>
                </h2>

                {eventLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div></CardContent></Card>
                    ))}
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <p className="text-muted-foreground">
                        {eventSelectedDate ? "해당 날짜에 이벤트가 없습니다." : `${eventCalMonth + 1}월에 등록된 이벤트가 없습니다.`}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map((ev) => {
                      const isExpanded = expandedEventId === ev.id;
                      const completedCount = ev.checklist.filter((c) => c.completed).length;
                      return (
                        <Card key={ev.id} className="transition-shadow hover:shadow-md">
                          <CardContent className="p-4 sm:p-5">
                            <button
                              className="w-full text-left"
                              onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${ev.location === "아이디" ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300" : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"}`}>
                                  {ev.location}
                                </Badge>
                                <h3 className="font-semibold text-foreground">{ev.title}</h3>
                                {ev.checklist.length > 0 && (
                                  <span className={`text-[11px] ml-auto ${ev.hasOrganizer ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                                    {ev.hasOrganizer ? "주최자 있음" : `${completedCount}/${ev.checklist.length}`}
                                  </span>
                                )}
                                <svg className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {formatShortDate(ev.startDate)} ~ {formatShortDate(ev.endDate)}
                              </p>
                              {ev.notes && (
                                <p className="text-sm text-muted-foreground mt-1.5 flex items-start gap-1.5">
                                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="line-clamp-3">{ev.notes}</span>
                                </p>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-muted-foreground">체크리스트</p>
                                  <Button
                                    variant={ev.hasOrganizer ? "default" : "outline"}
                                    size="sm"
                                    className={`h-6 text-[11px] px-2 ${ev.hasOrganizer ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}
                                    onClick={() => handleToggleOrganizer(ev)}
                                  >
                                    주최자 있음
                                  </Button>
                                </div>
                                {ev.checklist.length > 0 && (
                                  <div className="space-y-1.5 mb-3">
                                    {ev.checklist.map((item) => (
                                      <div key={item.id} className="flex items-center gap-2 group">
                                        <button
                                          onClick={() => handleToggleChecklistItem(ev, item.id)}
                                          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                            item.completed
                                              ? "bg-emerald-500 border-emerald-500 text-white"
                                              : "border-muted-foreground/30 hover:border-muted-foreground/50"
                                          }`}
                                        >
                                          {item.completed && (
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </button>
                                        <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                          {item.text}
                                        </span>
                                        <button
                                          onClick={() => handleDeleteChecklistItem(ev, item.id)}
                                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                                          title="삭제"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <form
                                  onSubmit={(e) => { e.preventDefault(); handleAddChecklistItem(ev); }}
                                  className="flex gap-2"
                                >
                                  <Input
                                    placeholder="항목 추가..."
                                    value={expandedEventId === ev.id ? newChecklistText : ""}
                                    onChange={(e) => setNewChecklistText(e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                  <Button type="submit" size="sm" variant="outline" className="h-8 px-3 shrink-0" disabled={!newChecklistText.trim()}>
                                    추가
                                  </Button>
                                </form>
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
        </Tabs>
      </main>
    </div>
  );
}
