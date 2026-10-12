import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PresentationPage from "@/app/presentation/page";
import { PLATFORM_STATUS } from "@/lib/presentationConfig";

describe("OpenWay Presentation Website (/presentation)", () => {
  it("renders the skip-to-content accessibility link", () => {
    render(<PresentationPage />);
    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink).toBeDefined();
    expect(skipLink.getAttribute("href")).toBe("#main-content");
  });

  it("renders the canonical product invariant prominently", () => {
    render(<PresentationPage />);
    expect(
      screen.getAllByText(/Detected is not resolved\. Resolved is not verified until fresh evidence proves the physical condition changed\./i).length
    ).toBeGreaterThan(0);
  });

  it("renders all key architectural sections", () => {
    const { container } = render(<PresentationPage />);
    expect(container.querySelector("#problem")).not.toBeNull();
    expect(container.querySelector("#how-it-works")).not.toBeNull();
    expect(container.querySelector("#walkthrough")).not.toBeNull();
    expect(container.querySelector("#architecture")).not.toBeNull();
    expect(container.querySelector("#safety-privacy")).not.toBeNull();
  });

  it("truthfully displays the verified status of runtime components", () => {
    render(<PresentationPage />);
    expect(screen.getByText(PLATFORM_STATUS.simulatorWorkflow.label)).toBeDefined();
    expect(screen.getByText(PLATFORM_STATUS.persistence.label)).toBeDefined();
    expect(screen.getByText(PLATFORM_STATUS.liveVisionInference.label)).toBeDefined();
    expect(screen.getAllByText(/FAIL-CLOSED/i).length).toBeGreaterThan(0);
  });

  it("displays the OpenWay Privacy Charter boundaries", () => {
    render(<PresentationPage />);
    expect(screen.getByText(/OpenWay analyzes the physical environment, not people’s identities/i)).toBeDefined();
    expect(screen.getByText(/No Facial Recognition/i)).toBeDefined();
    expect(screen.getByText(/No Disability Profiling/i)).toBeDefined();
  });

  it("includes links to the operator console and GitHub repository", () => {
    render(<PresentationPage />);
    const consoleLinks = screen.getAllByRole("link", { name: /console/i });
    expect(consoleLinks.length).toBeGreaterThan(0);
    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
  });
});
