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
} from "firebase/firestore";
import { db } from "./firebase";
import type { CalendarEvent, CalendarEventInput, ChecklistItem } from "@/types/event";
import { createDefaultChecklist } from "@/types/event";

const COLLECTION_NAME = "events";

function toEvent(id: string, data: Record<string, unknown>): CalendarEvent {
  return {
    id,
    title: data.title as string,
    startDate: (data.startDate as Timestamp).toDate(),
    endDate: (data.endDate as Timestamp).toDate(),
    location: (data.location as CalendarEvent["location"]) ?? "와우",
    notes: (data.notes as string) ?? "",
    revenue: (data.revenue as number) ?? 0,
    visitors: (data.visitors as number) ?? 0,
    checklist: ((data.checklist as ChecklistItem[])?.length ? (data.checklist as ChecklistItem[]) : createDefaultChecklist()),
    hasOrganizer: (data.hasOrganizer as boolean) ?? false,
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  };
}

export async function addEvent(input: CalendarEventInput): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    title: input.title,
    startDate: Timestamp.fromDate(input.startDate),
    endDate: Timestamp.fromDate(input.endDate),
    location: input.location ?? "와우",
    notes: input.notes,
    revenue: input.revenue ?? 0,
    visitors: input.visitors ?? 0,
    checklist: input.checklist ?? createDefaultChecklist(),
    hasOrganizer: input.hasOrganizer ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateEvent(
  id: string,
  updates: Partial<CalendarEventInput>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const data: Record<string, unknown> = {
    ...updates,
    updatedAt: Timestamp.now(),
  };
  if (updates.startDate) {
    data.startDate = Timestamp.fromDate(updates.startDate);
  }
  if (updates.endDate) {
    data.endDate = Timestamp.fromDate(updates.endDate);
  }
  await updateDoc(docRef, data);
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export function subscribeEvents(
  callback: (events: CalendarEvent[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("startDate", "asc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const events = snapshot.docs.map((d) =>
        toEvent(d.id, d.data() as Record<string, unknown>)
      );
      callback(events);
    },
    (error) => {
      console.error("이벤트 구독 오류:", error);
      if (onError) onError(error);
    }
  );
}
