export type Status = "pending" | "completed";
export type Priority = "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  eventPeriod: string;
  location: string;
  notes: string;
  designDeadline: Date | null;
  deadline: Date;
  priority: Priority;
  status: Status;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskInput {
  title: string;
  eventPeriod: string;
  location: string;
  notes: string;
  designDeadline: Date | null;
  deadline: Date;
  priority?: Priority;
  status?: Status;
}
