import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
