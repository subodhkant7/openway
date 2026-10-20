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
    it("renders Ring connection status, provider mode, and discovered devices", async () => {
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/ring/status")) {
          return new Response(
            JSON.stringify({
              success: true,
              status: {
                mode: "simulator",
                state: "CONNECTED",
                isConfigured: true,
                baseUrl: "https://api.amazonvision.com",
                details: "Deterministic simulator provider active",
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

      expect(screen.getByText("Deterministic Simulator")).toBeInTheDocument();
      expect(screen.getByText("Linked & Authorized")).toBeInTheDocument();
      expect(screen.getByText(/ava1.ring.account.test_venue_cafe/)).toBeInTheDocument();
      expect(screen.getByText("Front Ramp Camera")).toBeInTheDocument();
      expect(screen.getByText("Disconnect Ring Account")).toBeInTheDocument();
    });
  });
});
