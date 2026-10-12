import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";
import ConsolePage from "@/app/console/page";
import PresentationRedirect from "@/app/presentation/page";
import { PLATFORM_STATUS } from "@/lib/presentationConfig";

describe("OpenWay Product Presentation Homepage (/)", () => {
  it("renders the skip-to-content accessibility link", () => {
    render(<HomePage />);
    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink).toBeDefined();
    expect(skipLink.getAttribute("href")).toBe("#main-content");
  });

  it("renders the canonical product invariant prominently", () => {
    render(<HomePage />);
    expect(
      screen.getAllByText(/Detected is not resolved\. Resolved is not verified until fresh evidence proves the physical condition changed\./i).length
    ).toBeGreaterThan(0);
  });

  it("renders all key architectural sections", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector("#problem")).not.toBeNull();
    expect(container.querySelector("#how-it-works")).not.toBeNull();
    expect(container.querySelector("#walkthrough")).not.toBeNull();
    expect(container.querySelector("#architecture")).not.toBeNull();
    expect(container.querySelector("#safety-privacy")).not.toBeNull();
  });

  it("truthfully displays the verified status of runtime components", () => {
    render(<HomePage />);
    expect(screen.getByText(PLATFORM_STATUS.simulatorWorkflow.label)).toBeDefined();
    expect(screen.getByText(PLATFORM_STATUS.persistence.label)).toBeDefined();
    expect(screen.getByText(PLATFORM_STATUS.liveVisionInference.label)).toBeDefined();
    expect(screen.getAllByText(/FAIL-CLOSED/i).length).toBeGreaterThan(0);
  });

  it("displays the OpenWay Privacy Charter boundaries", () => {
    render(<HomePage />);
    expect(screen.getByText(/OpenWay analyzes the physical environment, not people’s identities/i)).toBeDefined();
    expect(screen.getByText(/No Facial Recognition/i)).toBeDefined();
    expect(screen.getByText(/No Disability Profiling/i)).toBeDefined();
  });

  it("navigates all presentation CTAs to the operator console at /console", () => {
    render(<HomePage />);
    const heroCta = screen.getByRole("link", { name: /launch live interactive console/i });
    expect(heroCta.getAttribute("href")).toBe("/console");

    const bottomCta = screen.getByRole("link", { name: /launch operator console/i });
    expect(bottomCta.getAttribute("href")).toBe("/console");

    const consoleLinks = screen.getAllByRole("link", { name: /console/i });
    expect(consoleLinks.length).toBeGreaterThan(0);
    for (const link of consoleLinks) {
      expect(link.getAttribute("href")).toBe("/console");
    }

    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
    expect(githubLinks[0].getAttribute("href")).toBe("https://github.com/subodhkant7/openway");
  });
});

describe("OpenWay Presentation Redirect (/presentation)", () => {
  it("redirects permanently to / via Next.js permanentRedirect", () => {
    try {
      PresentationRedirect();
      expect.fail("Expected permanentRedirect to throw NEXT_REDIRECT");
    } catch (err: unknown) {
      const error = err as { digest?: string; message?: string };
      expect(error.message).toBe("NEXT_REDIRECT");
      expect(error.digest).toContain("NEXT_REDIRECT;replace;/;308");
    }
  });
});

describe("OpenWay Operator Console Route (/console)", () => {
  it("renders the real operator dashboard and provides navigation back to /", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: { mode: "simulator", state: "CONNECTED" },
            devices: [],
            events: [],
            entrances: [],
          }),
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    try {
      render(<ConsolePage />);
      expect(screen.getByText("OPENWAY")).toBeDefined();
      expect(screen.getByText("Accessibility Assurance for Ring")).toBeDefined();

      // Navigation back to presentation at /
      const backLinks = screen.getAllByRole("link", { name: /product overview/i });
      expect(backLinks.length).toBeGreaterThan(0);
      expect(backLinks[0].getAttribute("href")).toBe("/");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
