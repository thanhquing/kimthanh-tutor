import { CircleAlert } from "lucide-react";

export function ErrorState({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return <section className="state error-state" role="alert"><span className="state-symbol" aria-hidden="true"><CircleAlert size={22} /></span><h1>{title}</h1><p>{message}</p>{actionLabel && onAction ? <button className="button primary" type="button" onClick={onAction}>{actionLabel}</button> : null}</section>;
}
