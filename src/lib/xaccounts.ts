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
import type { XAccount, XAccountInput, XAccountStatus } from "@/types/xaccount";

const COLLECTION_NAME = "xAccounts";

function tsToDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  return null;
}

function toXAccount(id: string, data: Record<string, unknown>): XAccount {
  return {
    id,
    name: (data.name as string) ?? "",
    twitterId: (data.twitterId as string) ?? "",
    email: (data.email as string) ?? "",
    password: (data.password as string) ?? "",
    status: ((data.status as XAccountStatus) || "미지정"),
    order: (data.order as number) ?? 0,
    createdAt: tsToDate(data.createdAt) ?? new Date(),
    updatedAt: tsToDate(data.updatedAt) ?? new Date(),
  };
}

export async function addXAccount(
  input: XAccountInput,
  order: number
): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    name: input.name,
    twitterId: input.twitterId,
    email: input.email,
    password: input.password,
    status: input.status,
    order,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateXAccount(
  id: string,
  updates: Partial<XAccountInput & { order: number }>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
}

export async function deleteXAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export function subscribeXAccounts(
  callback: (items: XAccount[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, COLLECTION_NAME), orderBy("order", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((d) =>
          toXAccount(d.id, d.data() as Record<string, unknown>)
        )
      );
    },
    (error) => {
      console.error("X 계정 구독 오류:", error);
      if (onError) onError(error);
    }
  );
}
