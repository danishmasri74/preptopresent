import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home (Phase 0 placeholder)", () => {
  it("renders the main heading and primary action", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /walk in prepared/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
  });
});
