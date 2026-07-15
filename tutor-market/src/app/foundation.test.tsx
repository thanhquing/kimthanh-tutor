// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";
import Loading from "./loading";
import NotFound from "./not-found";

afterEach(cleanup);

describe("route foundation states", () => {
  it("renders the branded 404 with a safe home link", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang tìm gia sư" })).toHaveAttribute("href", "/");
  });

  it("allows retrying an error boundary", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("network")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("announces loading state", () => {
    render(<Loading />);
    expect(screen.getByLabelText("Đang tải")).toHaveAttribute("aria-live", "polite");
  });
});
