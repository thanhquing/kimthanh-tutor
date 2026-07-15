import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function Broken(): never { throw new Error("test failure"); }

describe("AppErrorBoundary", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));

  it("shows a safe recovery state", () => {
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Không thể mở không gian làm việc");
    expect(screen.getByRole("button", { name: "Tải lại" })).toBeInTheDocument();
  });
});
