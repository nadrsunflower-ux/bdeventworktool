"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Task, Status, Priority, TaskInput } from "@/types/task";
import type { CalendarEvent, CalendarEventInput, EventLocation } from "@/types/event";
import {
  addTask,
  updateTask,
  deleteTask,
  subscribeTasks,
} from "@/lib/tasks";
import {
  addEvent,
  updateEvent,
  deleteEvent,
  subscribeEvents,
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

function groupByMonth<T>(items: T[], getDate: (item: T) => Date): { key: string; label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  const sorted = [...items].sort((a, b) => getDate(a).getTime() - getDate(b).getTime());
  sorted.forEach((item) => {
    const d = getDate(item);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, grpItems]) => {
      const [y, m] = key.split("-");
      return { key, label: `${y}년 ${parseInt(m)}월`, items: grpItems };
    });
}

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

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formEventPeriod, setFormEventPeriod] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDesignDeadline, setFormDesignDeadline] = useState("");
  const [formDeadline, setFormDeadline] = useState(formatDate(new Date()));
  const [formPriority, setFormPriority] = useState("medium");

  // Events
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventLoading, setEventLoading] = useState(true);
  const [selectedEventMonth, setSelectedEventMonth] = useState("");
  const [selectedTaskMonth, setSelectedTaskMonth] = useState("");
  const [selectedStatsMonth, setSelectedStatsMonth] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [evFormTitle, setEvFormTitle] = useState("");
  const [evFormStartDate, setEvFormStartDate] = useState(formatDate(new Date()));
  const [evFormEndDate, setEvFormEndDate] = useState(formatDate(new Date()));
  const [evFormLocation, setEvFormLocation] = useState<EventLocation>("와우");
  const [evFormNotes, setEvFormNotes] = useState("");

  // Stats
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [editingStatsEvent, setEditingStatsEvent] = useState<CalendarEvent | null>(null);
  const [statsRevenue, setStatsRevenue] = useState("");
  const [statsVisitors, setStatsVisitors] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsub1 = subscribeTasks(
      (t) => { setTasks(t); setTaskLoading(false); }
    );
    const unsub2 = subscribeEvents(
      (e) => { setEvents(e); setEventLoading(false); }
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  /* ── Task form handlers ── */
  const resetTaskForm = useCallback(() => {
    setFormTitle("");
    setFormEventPeriod("");
    setFormLocation("");
    setFormNotes("");
    setFormDesignDeadline("");
    setFormDeadline(formatDate(new Date()));
    setFormPriority("medium");
    setEditingTask(null);
  }, []);

  const handleOpenCreateTask = () => {
    resetTaskForm();
    setTaskDialogOpen(true);
  };

  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormEventPeriod(task.eventPeriod);
    setFormLocation(task.location);
    setFormNotes(task.notes);
    setFormDesignDeadline(task.designDeadline ? formatDate(task.designDeadline) : "");
    setFormDeadline(formatDate(task.deadline));
    setFormPriority(task.priority || "medium");
    setTaskDialogOpen(true);
  };

  const handleSubmitTask = () => {
    if (!formTitle.trim()) return;
    const input: TaskInput = {
      title: formTitle.trim(),
      eventPeriod: formEventPeriod.trim(),
      location: formLocation.trim(),
      notes: formNotes.trim(),
      designDeadline: formDesignDeadline ? new Date(formDesignDeadline + "T00:00:00") : null,
      deadline: new Date(formDeadline + "T00:00:00"),
      priority: formPriority as Priority,
    };
    if (editingTask) {
      updateTask(editingTask.id, input).catch(console.error);
    } else {
      const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), 0);
      addTask(input, maxOrder + 1).catch(console.error);
    }
    setTaskDialogOpen(false);
    resetTaskForm();
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(id).catch(console.error);
  };

  const handleStatusToggle = (task: Task) => {
    const next = task.status === "pending" ? "completed" : "pending";
    updateTask(task.id, { status: next }).catch(console.error);
  };

  /* ── Event form handlers ── */
  const resetEventForm = useCallback(() => {
    setEvFormTitle("");
    setEvFormStartDate(formatDate(new Date()));
    setEvFormEndDate(formatDate(new Date()));
    setEvFormLocation("와우");
    setEvFormNotes("");
    setEditingEvent(null);
  }, []);

  const handleOpenCreateEvent = () => {
    resetEventForm();
    setEventDialogOpen(true);
  };

  const handleOpenEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setEvFormTitle(ev.title);
    setEvFormStartDate(formatDate(ev.startDate));
    setEvFormEndDate(formatDate(ev.endDate));
    setEvFormLocation(ev.location);
    setEvFormNotes(ev.notes);
    setEventDialogOpen(true);
  };

  const handleSubmitEvent = () => {
    if (!evFormTitle.trim()) return;
    const input: CalendarEventInput = {
      title: evFormTitle.trim(),
      startDate: new Date(evFormStartDate + "T00:00:00"),
      endDate: new Date(evFormEndDate + "T00:00:00"),
      location: evFormLocation,
      notes: evFormNotes.trim(),
    };
    if (editingEvent) {
      updateEvent(editingEvent.id, input).catch(console.error);
    } else {
      addEvent(input).catch(console.error);
    }
    setEventDialogOpen(false);
    resetEventForm();
  };

  const handleDeleteEvent = (id: string) => {
    deleteEvent(id).catch(console.error);
  };

  /* ── Stats handlers ── */
  const handleOpenEditStats = (ev: CalendarEvent) => {
    setEditingStatsEvent(ev);
    setStatsRevenue(ev.revenue ? String(ev.revenue) : "0");
    setStatsVisitors(ev.visitors ? String(ev.visitors) : "0");
    setStatsDialogOpen(true);
  };

  const handleSubmitStats = () => {
    if (!editingStatsEvent) return;
    updateEvent(editingStatsEvent.id, {
      revenue: Number(statsRevenue) || 0,
      visitors: Number(statsVisitors) || 0,
    } as Partial<CalendarEventInput>).catch(console.error);
    setStatsDialogOpen(false);
  };

  /* Grouped data by month */
  const taskGroups = groupByMonth(tasks, (t) => t.deadline);
  const eventGroups = groupByMonth(events, (ev) => ev.startDate);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm px-6 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity">
              WorkTool
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
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="tasks">업무 관리</TabsTrigger>
            <TabsTrigger value="events">이벤트 관리</TabsTrigger>
            <TabsTrigger value="stats">매출 관리</TabsTrigger>
          </TabsList>

          {/* ── 업무 관리 탭 ── */}
          <TabsContent value="tasks">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                업무 목록 <span className="text-sm font-normal text-muted-foreground">{tasks.length}건</span>
              </h2>
              <Dialog open={taskDialogOpen} onOpenChange={(open) => {
                setTaskDialogOpen(open);
                if (!open) resetTaskForm();
              }}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenCreateTask} size="sm">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    업무 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingTask ? "업무 수정" : "새 업무 추가"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label htmlFor="t-title">업무 제목</Label>
                      <Input id="t-title" placeholder="업무 제목을 입력하세요" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="t-period">이벤트 기간</Label>
                      <Input id="t-period" placeholder="예: 2/14 ~ 2/16 (3일간)" value={formEventPeriod} onChange={(e) => setFormEventPeriod(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label>장소</Label>
                      <Select value={formLocation} onValueChange={setFormLocation}>
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="장소를 선택하세요" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="와우">와우</SelectItem>
                          <SelectItem value="아이디">아이디</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>중요도</Label>
                      <Select value={formPriority} onValueChange={setFormPriority}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">높음</SelectItem>
                          <SelectItem value="medium">보통</SelectItem>
                          <SelectItem value="low">낮음</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="t-notes">특이사항</Label>
                      <Textarea id="t-notes" placeholder="특이사항을 메모하세요" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="mt-1.5" rows={2} />
                    </div>
                    <div>
                      <Label htmlFor="t-design-dl">디자인 마감일</Label>
                      <Input id="t-design-dl" type="date" value={formDesignDeadline} onChange={(e) => setFormDesignDeadline(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="t-deadline">마감일</Label>
                      <Input id="t-deadline" type="date" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} className="mt-1.5" />
                    </div>
                    <Button onClick={handleSubmitTask} disabled={!formTitle.trim()} className="w-full">
                      {editingTask ? "수정 완료" : "추가"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {taskLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div></CardContent></Card>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-3">등록된 업무가 없습니다.</p>
                  <Button variant="outline" size="sm" onClick={handleOpenCreateTask}>첫 업무 추가하기</Button>
                </CardContent>
              </Card>
            ) : (() => {
              const activeMonth = selectedTaskMonth || taskGroups[0]?.key || "";
              const activeGroup = taskGroups.find((g) => g.key === activeMonth);
              return (
                <div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {taskGroups.map((group) => (
                      <button
                        key={group.key}
                        onClick={() => setSelectedTaskMonth(group.key)}
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
                      {activeGroup.items.map((task) => {
                        const dday = getDDay(task.deadline);
                        return (
                          <Card key={task.id} className={`transition-shadow hover:shadow-md ${task.status === "completed" ? "opacity-60" : ""}`}>
                            <CardContent className="p-4 sm:p-5">
                              <div className="flex items-start gap-3">
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
                                  <p className={`text-sm font-bold ${dday.passed ? "text-destructive" : dday.text === "D-Day" ? "text-orange-500" : dday.urgent ? "text-red-500" : "text-primary"}`}>
                                    {dday.text}
                                  </p>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditTask(task)} title="수정">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteTask(task.id)} title="삭제">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </TabsContent>

          {/* ── 이벤트 관리 탭 ── */}
          <TabsContent value="events">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                이벤트 목록 <span className="text-sm font-normal text-muted-foreground">{events.length}건</span>
              </h2>
              <Dialog open={eventDialogOpen} onOpenChange={(open) => {
                setEventDialogOpen(open);
                if (!open) resetEventForm();
              }}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenCreateEvent} size="sm">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    이벤트 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingEvent ? "이벤트 수정" : "새 이벤트 추가"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label htmlFor="ev-title">이벤트 제목</Label>
                      <Input id="ev-title" placeholder="이벤트 제목을 입력하세요" value={evFormTitle} onChange={(e) => setEvFormTitle(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label>장소</Label>
                      <Select value={evFormLocation} onValueChange={(v) => setEvFormLocation(v as EventLocation)}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="와우">와우</SelectItem>
                          <SelectItem value="아이디">아이디</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="ev-start">시작일</Label>
                        <Input id="ev-start" type="date" value={evFormStartDate} onChange={(e) => setEvFormStartDate(e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="ev-end">종료일</Label>
                        <Input id="ev-end" type="date" value={evFormEndDate} onChange={(e) => setEvFormEndDate(e.target.value)} className="mt-1.5" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ev-notes">특이사항</Label>
                      <Textarea id="ev-notes" placeholder="이벤트 관련 특이사항을 메모하세요" value={evFormNotes} onChange={(e) => setEvFormNotes(e.target.value)} className="mt-1.5" rows={3} />
                    </div>
                    <Button onClick={handleSubmitEvent} disabled={!evFormTitle.trim()} className="w-full">
                      {editingEvent ? "수정 완료" : "추가"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {eventLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div></CardContent></Card>
                ))}
              </div>
            ) : events.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-3">등록된 이벤트가 없습니다.</p>
                  <Button variant="outline" size="sm" onClick={handleOpenCreateEvent}>첫 이벤트 추가하기</Button>
                </CardContent>
              </Card>
            ) : (() => {
              const activeMonth = selectedEventMonth || eventGroups[0]?.key || "";
              const activeGroup = eventGroups.find((g) => g.key === activeMonth);
              return (
                <div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {eventGroups.map((group) => (
                      <button
                        key={group.key}
                        onClick={() => setSelectedEventMonth(group.key)}
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
                      {activeGroup.items.map((ev) => (
                        <Card key={ev.id} className="transition-shadow hover:shadow-md">
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${ev.location === "아이디" ? "bg-pink-500" : "bg-violet-500"}`}>
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-foreground">{ev.title}</h3>
                                  <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${ev.location === "아이디" ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300" : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"}`}>
                                    {ev.location}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {formatShortDate(ev.startDate)} ~ {formatShortDate(ev.endDate)}
                                </p>
                                {ev.notes && (
                                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{ev.notes}</p>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditEvent(ev)} title="수정">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteEvent(ev.id)} title="삭제">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </TabsContent>

          {/* ── 매출 관리 탭 ── */}
          <TabsContent value="stats">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                매출/방문자 관리 <span className="text-sm font-normal text-muted-foreground">{events.length}건</span>
              </h2>
            </div>

            <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>매출/방문자 수정</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm font-semibold text-foreground">{editingStatsEvent?.title}</p>
                  {editingStatsEvent && (
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(editingStatsEvent.startDate)} ~ {formatShortDate(editingStatsEvent.endDate)}
                    </p>
                  )}
                  <div>
                    <Label htmlFor="stats-revenue">매출 (원)</Label>
                    <Input id="stats-revenue" type="number" placeholder="0" value={statsRevenue} onChange={(e) => setStatsRevenue(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="stats-visitors">방문자 수 (명)</Label>
                    <Input id="stats-visitors" type="number" placeholder="0" value={statsVisitors} onChange={(e) => setStatsVisitors(e.target.value)} className="mt-1.5" />
                  </div>
                  <Button onClick={handleSubmitStats} className="w-full">저장</Button>
                </div>
              </DialogContent>
            </Dialog>

            {eventLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div></CardContent></Card>
                ))}
              </div>
            ) : events.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">이벤트를 먼저 추가해주세요.</p>
                </CardContent>
              </Card>
            ) : (() => {
              const activeMonth = selectedStatsMonth || eventGroups[0]?.key || "";
              const activeGroup = eventGroups.find((g) => g.key === activeMonth);
              const monthRevenue = activeGroup ? activeGroup.items.reduce((sum, ev) => sum + ev.revenue, 0) : 0;
              const monthVisitors = activeGroup ? activeGroup.items.reduce((sum, ev) => sum + ev.visitors, 0) : 0;
              return (
                <div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {eventGroups.map((group) => (
                      <button
                        key={group.key}
                        onClick={() => setSelectedStatsMonth(group.key)}
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
                    <div>
                      <div className="flex items-center gap-4 text-sm mb-4 px-1">
                        <span className="text-muted-foreground">
                          합계 <span className="font-semibold text-foreground">{monthRevenue.toLocaleString()}원</span>
                        </span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{monthVisitors.toLocaleString()}명</span>
                        </span>
                      </div>
                      <div className="space-y-3">
                        {activeGroup.items.map((ev) => (
                          <Card key={ev.id} className="transition-shadow hover:shadow-md">
                            <CardContent className="p-4 sm:p-5">
                              <div className="flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-foreground">{ev.title}</h3>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {formatShortDate(ev.startDate)} ~ {formatShortDate(ev.endDate)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">매출</p>
                                  <p className="font-semibold text-foreground">{ev.revenue.toLocaleString()}원</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">방문자</p>
                                  <p className="font-semibold text-foreground">{ev.visitors.toLocaleString()}명</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleOpenEditStats(ev)} title="수정">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
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
