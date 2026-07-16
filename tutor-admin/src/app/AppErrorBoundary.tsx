import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { failed: boolean }
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch() { /* Không gửi token, PII hay state phiên vào telemetry. */ }
  render() { return this.state.failed ? <main className="access-state"><div><h1>Không thể mở console</h1><p>Ứng dụng gặp lỗi ngoài dự kiến. Hãy tải lại trang.</p><button className="button primary" onClick={() => window.location.reload()}>Tải lại</button></div></main> : this.props.children; }
}
