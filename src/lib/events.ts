import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { EventTask, EventTaskInput } from "@/types/event";

const COLLECTION_NAME = "eventTasks";

function tsToDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  return null;
}

// 기존(체크리스트 기반) 데이터에서 완료 여부 유추
function deriveCompleted(data: Record<string, unknown>): boolean {
  if (typeof data.completed === "boolean") return data.completed;
  if (data.hasOrganizer === true) return true;
  const checklist = data.checklist as { completed?: boolean }[] | undefined;
  if (checklist?.length) return checklist.every((c) => c.completed);
  return false;
}

function toEventTask(id: string, data: Record<string, unknown>): EventTask {
  return {
    id,
    title: (data.title as string) ?? "",
    roundMonth: (data.roundMonth as number) ?? null,
    roundSession: (data.roundSession as number) ?? null,
    location: (data.location as EventTask["location"]) ?? "와우",
    startDate: tsToDate(data.startDate) ?? new Date(),
    endDate: tsToDate(data.endDate) ?? new Date(),
    planningDeadline: tsToDate(data.planningDeadline),
    designDeadline: tsToDate(data.designDeadline),
    notes: (data.notes as string) ?? "",
    uploadDate: tsToDate(data.uploadDate),
    budget: (data.budget as number) ?? 0,
    completed: deriveCompleted(data),
    order: (data.order as number) ?? 0,
    createdAt: tsToDate(data.createdAt) ?? new Date(),
    updatedAt: tsToDate(data.updatedAt) ?? new Date(),
  };
}

function dateToTs(d: Date | null | undefined): Timestamp | null {
  return d ? Timestamp.fromDate(d) : null;
}

export async function addEventTask(
  input: EventTaskInput,
  order: number
): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    title: input.title,
    roundMonth: input.roundMonth ?? null,
    roundSession: input.roundSession ?? null,
    location: input.location ?? "와우",
    startDate: Timestamp.fromDate(input.startDate),
    endDate: Timestamp.fromDate(input.endDate),
    planningDeadline: dateToTs(input.planningDeadline),
    designDeadline: dateToTs(input.designDeadline),
    notes: input.notes,
    uploadDate: dateToTs(input.uploadDate),
    budget: input.budget ?? 0,
    completed: input.completed ?? false,
    order,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateEventTask(
  id: string,
  updates: Partial<EventTaskInput & { order: number }>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const data: Record<string, unknown> = {
    ...updates,
    updatedAt: Timestamp.now(),
  };
  if (updates.startDate) data.startDate = Timestamp.fromDate(updates.startDate);
  if (updates.endDate) data.endDate = Timestamp.fromDate(updates.endDate);
  if (updates.planningDeadline !== undefined)
    data.planningDeadline = dateToTs(updates.planningDeadline);
  if (updates.designDeadline !== undefined)
    data.designDeadline = dateToTs(updates.designDeadline);
  if (updates.uploadDate !== undefined)
    data.uploadDate = dateToTs(updates.uploadDate);
  await updateDoc(docRef, data);
}

export async function deleteEventTask(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function reorderEventTasks(
  items: { id: string; order: number }[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const item of items) {
    const docRef = doc(db, COLLECTION_NAME, item.id);
    batch.update(docRef, { order: item.order, updatedAt: Timestamp.now() });
  }
  await batch.commit();
}

export function subscribeEventTasks(
  callback: (items: EventTask[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, COLLECTION_NAME), orderBy("startDate", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        toEventTask(d.id, d.data() as Record<string, unknown>)
      );
      callback(items);
    },
    (error) => {
      console.error("이벤트 업무 구독 오류:", error);
      if (onError) onError(error);
    }
  );
}
