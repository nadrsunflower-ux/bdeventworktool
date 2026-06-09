"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EventTask, EventLocation } from "@/types/event";
import { formatRound } from "@/types/event";
import { subscribeEventTasks } from "@/lib/events";
import Link from "next/link";

function formatShortDate(date: Date | null): string {
  if (!date) return "-";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const LOCATION_BADGE: Record<EventLocation, string> = {
  "와우": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "아이디": "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

// 차수의 '월'(roundMonth) 기준 그룹 키
function roundKeyOf(i: EventTask): string {
  return i.roundMonth != null ? String(i.roundMonth) : "기타";
}

function roundLabel(key: string): string {
  return key === "기타" ? "차수 미지정" : `${key}월`;
}

function sortRoundKeys(a: string, b: string): number {
  if (a === "기타") return 1;
  if (b === "기타") return -1;
  return Number(a) - Number(b);
}

export default function ReportPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<EventTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsub = subscribeEventTasks(
      (data) => { setItems(data); setLoading(false); }
    );
    return () => unsub();
  }, []);

  if (!mounted) return null;

  const months = Array.from(new Set(items.map(roundKeyOf))).sort(sortRoundKeys);

  const filtered =
    selectedMonth === "all"
      ? items
      : items.filter((i) => roundKeyOf(i) === selectedMonth);

  const sorted = [...filtered].sort((a, b) => {
    const am = a.roundMonth ?? 999;
    const bm = b.roundMonth ?? 999;
    if (am !== bm) return am - bm;
    const as = a.roundSession ?? 999;
    const bs = b.roundSession ?? 999;
    if (as !== bs) return as - bs;
    return a.startDate.getTime() - b.startDate.getTime();
  });

  const totalBudget = filtered.reduce((sum, i) => sum + (i.budget || 0), 0);
  const uploadedCount = filtered.filter((i) => i.uploadDate).length;
  const completedCount = filtered.filter((i) => i.completed).length;

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity">
              AC&apos;SCENT EVENT
            </Link>
            <Badge variant="secondary" className="text-xs">리포트</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                대시보드
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

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        {/* Month filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setSelectedMonth("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedMonth === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            전체
            <span className="ml-1 text-xs opacity-70">{items.length}</span>
          </button>
          {months.map((m) => {
            const count = items.filter((i) => roundKeyOf(i) === m).length;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedMonth === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {roundLabel(m)}
                <span className="ml-1 text-xs opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">총 예산</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {totalBudget.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-0.5">원</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">이벤트 건수</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {filtered.length}<span className="text-sm font-normal text-muted-foreground ml-0.5">건</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">업로드 완료</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {uploadedCount}<span className="text-sm font-normal text-muted-foreground ml-0.5">/ {filtered.length}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">업무 완료</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {completedCount}<span className="text-sm font-normal text-muted-foreground ml-0.5">/ {filtered.length}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {loading ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">불러오는 중...</CardContent></Card>
        ) : sorted.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">표시할 이벤트가 없습니다.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap">차수</th>
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap">장소</th>
                    <th className="font-medium px-3 py-2.5 min-w-[140px]">이벤트 제목</th>
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap">이벤트 기간</th>
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap">기획 마감</th>
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap">디자인 마감</th>
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap">업로드일</th>
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap text-right">예산</th>
                    <th className="font-medium px-3 py-2.5 whitespace-nowrap text-center">완료</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => {
                    const round = formatRound(item.roundMonth, item.roundSession);
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap font-medium text-foreground">{round || "-"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${LOCATION_BADGE[item.location]}`}>
                            {item.location}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-foreground">{item.title}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {formatShortDate(item.startDate)} ~ {formatShortDate(item.endDate)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatShortDate(item.planningDeadline)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatShortDate(item.designDeadline)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatShortDate(item.uploadDate)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-right font-medium text-foreground">
                          {item.budget ? `${item.budget.toLocaleString()}원` : "-"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${item.completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                            {item.completed ? "완료" : "미완료"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold text-foreground">
                    <td className="px-3 py-2.5" colSpan={7}>합계</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">{totalBudget.toLocaleString()}원</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">{completedCount}/{filtered.length}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
