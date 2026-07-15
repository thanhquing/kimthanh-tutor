import { Component, type ReactNode } from "react";
import { ErrorState } from "../components/states/ErrorState";

interface Props { children: ReactNode }
interface State { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch() {
    // Telemetry integration belongs to the observability task. Never log tokens/PII here.
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <ErrorState
            title="Không thể mở không gian làm việc"
            message="Ứng dụng gặp sự cố ngoài dự kiến. Bạn có thể tải lại để thử lần nữa."
            actionLabel="Tải lại"
            onAction={() => window.location.reload()}
          />
        </main>
      );
    }
    return this.props.children;
  }
}
