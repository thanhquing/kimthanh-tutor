// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("SiteHeader", () => {
  beforeEach(() => { pathname = "/"; });
  afterEach(cleanup);

  it("render shared market shell and mobile navigation", () => {
    render(<SiteHeader />);
    expect(screen.getByLabelText("Kim Thanh Tutor — Tìm gia sư")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Điều hướng di động" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Học sinh" })).toHaveLength(2);
  });

  it("marks the current private route as active", () => {
    pathname = "/classes";
    render(<SiteHeader />);
    expect(screen.getAllByRole("link", { name: "Lớp học" }).every((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  });
});
