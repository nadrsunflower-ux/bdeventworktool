"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { XAccount, XAccountInput, XAccountStatus } from "@/types/xaccount";
import { X_ACCOUNT_STATUSES, formatEmail } from "@/types/xaccount";
import {
  addXAccount,
  updateXAccount,
  deleteXAccount,
  subscribeXAccounts,
} from "@/lib/xaccounts";

const STATUS_BADGE: Record<XAccountStatus, string> = {
  "사용중": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "사용대기": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "사용완료": "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "삭제": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "미지정": "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

const FILTERS = ["전체", ...X_ACCOUNT_STATUSES] as const;

export default function XAccountPanel() {
  const [items, setItems] = useState<XAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("전체");
  const [search, setSearch] = useState("");
  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<XAccount | null>(null);

  const [fName, setFName] = useState("");
  const [fTwitterId, setFTwitterId] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fStatus, setFStatus] = useState<XAccountStatus>("사용대기");

  useEffect(() => {
    const unsub = subscribeXAccounts((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetForm = useCallback(() => {
    setFName("");
    setFTwitterId("");
    setFEmail("");
    setFPassword("");
    setFStatus("사용대기");
    setEditing(null);
  }, []);

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (acc: XAccount) => {
    setEditing(acc);
    setFName(acc.name);
    setFTwitterId(acc.twitterId);
    setFEmail(acc.email);
    setFPassword(acc.password);
    setFStatus(acc.status);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!fTwitterId.trim() && !fName.trim()) return;
    const input: XAccountInput = {
      name: fName.trim(),
      twitterId: fTwitterId.trim(),
      email: fEmail.trim(),
      password: fPassword.trim(),
      status: fStatus,
    };
    try {
      if (editing) {
        await updateXAccount(editing.id, input);
      } else {
        const maxOrder = items.reduce((max, a) => Math.max(max, a.order), 0);
        await addXAccount(input, maxOrder + 1);
      }
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (acc: XAccount) => {
    if (!confirm(`'${acc.name || acc.twitterId}' 계정을 목록에서 삭제할까요?`)) return;
    deleteXAccount(acc.id).catch(console.error);
  };

  const handleChangeStatus = (acc: XAccount, status: XAccountStatus) => {
    updateXAccount(acc.id, { status }).catch(console.error);
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const q = search.trim().toLowerCase();
  const searched = q
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.twitterId.toLowerCase().includes(q) ||
          i.email.toLowerCase().includes(q)
      )
    : items;

  const counts = X_ACCOUNT_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = searched.filter((i) => i.status === s).length;
    return acc;
  }, {});

  const filtered =
    filter === "전체" ? searched : searched.filter((i) => i.status === filter);

  return (
    <div>
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="text-lg font-semibold text-foreground">
          X 계정 관리{" "}
          <span className="text-sm font-normal text-muted-foreground">{items.length}개</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevealAll((v) => !v)}
            className="text-xs"
          >
            {revealAll ? "비밀번호 가리기" : "비밀번호 모두 보기"}
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} size="sm">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                계정 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? "계정 수정" : "새 X 계정 추가"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="x-name">이름</Label>
                  <Input id="x-name" placeholder="예: 세븐틴 원우" value={fName} onChange={(e) => setFName(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="x-twitter">트위터 아이디</Label>
                  <Input id="x-twitter" placeholder="@ 없이 입력" value={fTwitterId} onChange={(e) => setFTwitterId(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="x-email">메일</Label>
                  <Input id="x-email" placeholder="앞부분만 입력 시 @neader.co.kr 자동" value={fEmail} onChange={(e) => setFEmail(e.target.value)} className="mt-1.5" />
                  {fEmail.trim() && (
                    <p className="text-xs text-muted-foreground mt-1">→ {formatEmail(fEmail)}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="x-pw">비밀번호</Label>
                  <Input id="x-pw" placeholder="비밀번호" value={fPassword} onChange={(e) => setFPassword(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>상태</Label>
                  <Select value={fStatus} onValueChange={(v) => setFStatus(v as XAccountStatus)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {X_ACCOUNT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSubmit} disabled={!fTwitterId.trim() && !fName.trim()} className="w-full">
                  {editing ? "수정 완료" : "추가"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 · 트위터 아이디 · 메일 검색"
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="검색 지우기"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map((f) => {
          const count = f === "전체" ? searched.length : counts[f] ?? 0;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f}
              <span className="ml-1 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 테이블 */}
      {loading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">불러오는 중...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          {q ? `'${search.trim()}' 검색 결과가 없습니다.` : "표시할 계정이 없습니다."}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="font-medium px-3 py-2.5 min-w-[120px]">이름</th>
                  <th className="font-medium px-3 py-2.5 whitespace-nowrap">트위터 아이디</th>
                  <th className="font-medium px-3 py-2.5 whitespace-nowrap">메일</th>
                  <th className="font-medium px-3 py-2.5 whitespace-nowrap">비밀번호</th>
                  <th className="font-medium px-3 py-2.5 whitespace-nowrap">상태</th>
                  <th className="font-medium px-3 py-2.5 whitespace-nowrap text-right">작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((acc) => {
                  const show = revealAll || revealed.has(acc.id);
                  return (
                    <tr key={acc.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-foreground">{acc.name || <span className="text-muted-foreground">-</span>}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {acc.twitterId ? (
                          <a
                            href={`https://x.com/${acc.twitterId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            @{acc.twitterId}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatEmail(acc.email) || "-"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {acc.password ? (
                          <button
                            onClick={() => toggleReveal(acc.id)}
                            className="font-mono text-foreground hover:text-primary transition-colors"
                            title={show ? "가리기" : "보기"}
                          >
                            {show ? acc.password : "••••••••"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Select value={acc.status} onValueChange={(v) => handleChangeStatus(acc, v as XAccountStatus)}>
                          <SelectTrigger className="h-7 w-[92px] px-2 text-xs border-0 bg-transparent shadow-none focus:ring-0">
                            <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${STATUS_BADGE[acc.status]}`}>
                              {acc.status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {X_ACCOUNT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(acc)} title="수정">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(acc)} title="삭제">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
