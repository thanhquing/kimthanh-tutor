import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App routes", () => {
  it("supports a deep route", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/availability"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Lịch rảnh" })).toBeInTheDocument();
  });

  it("renders a 404 state", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/does-not-exist"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Không tìm thấy trang" })).toBeInTheDocument();
  });
});
