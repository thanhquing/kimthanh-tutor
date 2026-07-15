import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <section className="state empty-state"><span className="state-symbol" aria-hidden="true"><Inbox size={22} /></span><h2>{title}</h2><p>{message}</p>{action}</section>;
}
