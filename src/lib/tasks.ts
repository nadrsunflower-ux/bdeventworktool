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
import type { Task, TaskInput } from "@/types/task";

const COLLECTION_NAME = "tasks";

function toTask(id: string, data: Record<string, unknown>): Task {
  const designDl = data.designDeadline as Timestamp | null | undefined;
  return {
    id,
    title: data.title as string,
    eventPeriod: (data.eventPeriod as string) ?? "",
    location: (data.location as string) ?? "",
    notes: (data.notes as string) ?? "",
    designDeadline: designDl ? designDl.toDate() : null,
    deadline: (data.deadline as Timestamp).toDate(),
    priority: (data.priority as Task["priority"]) ?? "medium",
    status: data.status as Task["status"],
    order: (data.order as number) ?? 0,
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  };
}

export async function addTask(
  input: TaskInput,
  order: number
): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    title: input.title,
    eventPeriod: input.eventPeriod,
    location: input.location,
    notes: input.notes,
    designDeadline: input.designDeadline
      ? Timestamp.fromDate(input.designDeadline)
      : null,
    deadline: Timestamp.fromDate(input.deadline),
    priority: input.priority ?? "medium",
    status: input.status ?? "pending",
    order,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateTask(
  id: string,
  updates: Partial<TaskInput & { status: string; order: number }>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const data: Record<string, unknown> = {
    ...updates,
    updatedAt: Timestamp.now(),
  };
  if (updates.deadline) {
    data.deadline = Timestamp.fromDate(updates.deadline);
  }
  if (updates.designDeadline !== undefined) {
    data.designDeadline = updates.designDeadline
      ? Timestamp.fromDate(updates.designDeadline)
      : null;
  }
  await updateDoc(docRef, data);
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function reorderTasks(
  tasks: { id: string; order: number }[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const task of tasks) {
    const docRef = doc(db, COLLECTION_NAME, task.id);
    batch.update(docRef, { order: task.order, updatedAt: Timestamp.now() });
  }
  await batch.commit();
}

export function subscribeTasks(
  callback: (tasks: Task[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("order", "asc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs.map((d) =>
        toTask(d.id, d.data() as Record<string, unknown>)
      );
      callback(tasks);
    },
    (error) => {
      console.error("Firestore 구독 오류:", error);
      if (onError) onError(error);
    }
  );
}
