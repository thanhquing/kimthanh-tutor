export function LoadingState({ label = "Đang tải dữ liệu" }: { label?: string }) {
  return <div className="state state-loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton" aria-label="Đang tải">{Array.from({ length: lines }, (_, index) => <span key={index} />)}</div>;
}
