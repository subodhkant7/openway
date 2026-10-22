import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import RingLinkPage from "@/app/ring/link/page";
import RingConfigPage from "@/app/ring/config/page";

// Mock next/navigation
const mockGet = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("Ring Integration UI Routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Ring Link Route (/ring/link)", () => {
    it("renders linking form with valid nonce and fresh timestamp", () => {
      const now = Date.now();
      mockGet.mockImplementation((param: string) => {
        if (param === "nonce") return "test_urlsafe_nonce_123";
        if (param === "time") return String(now);
        return null;
      });

      render(<RingLinkPage />);

      expect(screen.getByText("Connect Ring Account")).toBeInTheDocument();
      expect(screen.getByText("Authenticate & Confirm Ring Link")).toBeInTheDocument();
      expect(screen.getByDisplayValue("operator@maplestcafe.openway.org")).toBeInTheDocument();
    });

    it("displays warning banner when link request timestamp has expired (> 600s)", () => {
      const expiredTime = Date.now() - 700 * 1000;
      mockGet.mockImplementation((param: string) => {
        if (param === "nonce") return "test_urlsafe_nonce_123";
        if (param === "time") return String(expiredTime);
        return null;
      });

      render(<RingLinkPage />);

      expect(screen.getByText(/Link Request Expired/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Authenticate & Confirm Ring Link/i })).toBeDisabled();
    });

    it("displays warning when parameters are missing from URL", () => {
      mockGet.mockReturnValue(null);

      render(<RingLinkPage />);

      expect(screen.getByText(/Missing Nonce Parameters/i)).toBeInTheDocument();
    });

    it("submits linking request and displays success confirmation card", async () => {
      const now = Date.now();
      mockGet.mockImplementation((param: string) => {
        if (param === "nonce") return "test_urlsafe_nonce_123";
        if (param === "time") return String(now);
        return null;
      });

      global.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            ringAccountId: "ava1.ring.account.user_test_99",
            status: "LINKED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as unknown as typeof fetch;

      render(<RingLinkPage />);

      const submitBtn = screen.getByRole("button", { name: /Authenticate & Confirm Ring Link/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Account Linked Successfully!")).toBeInTheDocument();
      });

      expect(screen.getByText(/ava1.ring.account.user_test_99/)).toBeInTheDocument();
      expect(screen.getByText("Manage Ring Hardware Configuration")).toBeInTheDocument();
    });
  });

  describe("Ring Config Route (/ring/config)", () => {
    it("renders unlinked simulator state with prominent demo notice, 6-step guide, and zero discovered devices", async () => {
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/ring/status")) {
          return new Response(
            JSON.stringify({
              success: true,
              status: {
                mode: "simulator",
                state: "SIMULATED",
                isConfigured: true,
                baseUrl: "http://localhost:3000/simulator",
                details: "Deterministic simulator provider active",
                activeDeviceCount: 0,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("/api/ring/oauth/link")) {
          return new Response(
            JSON.stringify({
              linked: false,
              status: "NOT_LINKED",
              venueId: "venue_maple_cafe",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("/api/ring/devices")) {
          return new Response(
            JSON.stringify({
              success: true,
              devices: [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }) as unknown as typeof fetch;

      render(<RingConfigPage />);

      await waitFor(() => {
        expect(screen.getByText("Ring Partner Integration")).toBeInTheDocument();
      });

      // Prominent banner for not connected demo
      expect(
        screen.getByText("Ring account not connected. The public demo is using the deterministic simulator.")
      ).toBeInTheDocument();

      // Truthful cards
      expect(screen.getByText("Deterministic Simulator")).toBeInTheDocument();
      expect(screen.getByText("Not Connected")).toBeInTheDocument();
      expect(screen.getByText("0 Devices Discovered")).toBeInTheDocument();
      expect(screen.getAllByText("No authorized Ring devices discovered").length).toBeGreaterThan(0);

      // Connect Ring test account panel and 6 steps
      expect(screen.getByText("Connect a Ring test account")).toBeInTheDocument();
      expect(screen.getByText("Step 1")).toBeInTheDocument();
      expect(screen.getByText("Step 2")).toBeInTheDocument();
      expect(screen.getByText("Step 3")).toBeInTheDocument();
      expect(screen.getByText("Step 4")).toBeInTheDocument();
      expect(screen.getByText("Step 5")).toBeInTheDocument();
      expect(screen.getByText("Step 6")).toBeInTheDocument();

      // Official documentation link
      const docLink = screen.getByRole("link", { name: /Official Ring API Development Guide/i });
      expect(docLink.getAttribute("href")).toBe("https://developer.amazon.com/docs/ring/develop.html");

      // Action distinction
      expect(screen.getByText("1. Start Ring Account Linking")).toBeInTheDocument();
      expect(screen.getByText("2. Manage / Revoke Authorization")).toBeInTheDocument();
      expect(screen.getByText("3. Delete Local OpenWay Credentials")).toBeInTheDocument();

      // Unlinked user should not see Delete Local Credentials button
      expect(screen.queryByText("Delete Local Credentials")).toBeNull();
    });

    it("renders linked live state when account linking is established", async () => {
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/ring/status")) {
          return new Response(
            JSON.stringify({
              success: true,
              status: {
                mode: "api",
                state: "CONNECTED",
                isConfigured: true,
                baseUrl: "https://api.amazonvision.com",
                details: "Connected to official Ring Partner API",
                activeDeviceCount: 1,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("/api/ring/oauth/link")) {
          return new Response(
            JSON.stringify({
              linked: true,
              status: "LINKED",
              ringAccountReference: "ava1.ring.account.test_venue_cafe",
              venueId: "venue_maple_cafe",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("/api/ring/devices")) {
          return new Response(
            JSON.stringify({
              success: true,
              devices: [
                {
                  id: "cam_front_entrance",
                  name: "Front Ramp Camera",
                  kind: "doorbell",
                  online: true,
                  status: "online",
                  capabilities: {
                    supports_live_video: true,
                    supports_snapshots: true,
                    supports_media_clips: true,
                    supports_motion_events: true,
                  },
                  batteryLevel: 98,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }) as unknown as typeof fetch;

      render(<RingConfigPage />);

      await waitFor(() => {
        expect(screen.getByText("Ring Partner Integration")).toBeInTheDocument();
      });

      expect(screen.getByText("Official Ring Partner API")).toBeInTheDocument();
      expect(screen.getByText("Linked & Authorized")).toBeInTheDocument();
      expect(screen.getByText(/ava1.ring.account.test_venue_cafe/)).toBeInTheDocument();
      expect(screen.getByText("1 Devices Discovered")).toBeInTheDocument();
      expect(screen.getByText("Front Ramp Camera")).toBeInTheDocument();
      expect(screen.getByText("Delete Local Credentials")).toBeInTheDocument();
    });
  });
});
