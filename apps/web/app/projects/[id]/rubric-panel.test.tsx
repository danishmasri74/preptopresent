import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));

const pasteRubric = vi.fn();
vi.mock("@/app/projects/actions", () => ({
  pasteRubric: (input: unknown) => pasteRubric(input),
  registerRubric: vi.fn(),
}));
const uploadRubric = vi.fn();
vi.mock("@/components/rubric-upload", () => ({
  uploadRubric: (...args: unknown[]) => uploadRubric(...args),
}));

import { RubricPanel, type RubricSummary } from "./rubric-panel";

const ids = { userId: "user-1", projectId: "7c9e6679-7425-40de-944b-e07fc1f90ae7" };

function rubric(overrides: Partial<RubricSummary> = {}): RubricSummary {
  return {
    id: "r1",
    status: "parsed",
    error_code: null,
    source_kind: "file",
    original_filename: "fyp-rubric.pdf",
    weights_suggested: false,
    model: "claude-opus-5-5",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const criteria = [
  { id: "c1", position: 1, name: "Methodology", weight: 60, description: "Justifies the method." },
  { id: "c2", position: 2, name: "Delivery", weight: 40, description: "" },
];

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

describe("RubricPanel", () => {
  beforeEach(() => {
    refresh.mockReset();
    pasteRubric.mockReset();
    uploadRubric.mockReset();
    setOnline(true);
  });

  it("offers upload or paste when there is no rubric", () => {
    render(<RubricPanel {...ids} rubric={null} criteria={[]} />);
    expect(screen.getByRole("heading", { name: "Add your marking rubric" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Upload a file" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Read rubric" })).toBeDisabled();
  });

  it("sends pasted text and refreshes", async () => {
    pasteRubric.mockResolvedValue({ ok: true, data: null });
    render(<RubricPanel {...ids} rubric={null} criteria={[]} />);
    await userEvent.click(screen.getByRole("radio", { name: "Paste text" }));
    await userEvent.type(screen.getByLabelText("Rubric or brief text"), "1. Delivery - 100%");
    await userEvent.click(screen.getByRole("button", { name: "Read rubric" }));
    expect(pasteRubric).toHaveBeenCalledWith({
      projectId: ids.projectId,
      text: "1. Delivery - 100%",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a server error from pasting", async () => {
    pasteRubric.mockResolvedValue({ ok: false, message: "Paste the full rubric or brief." });
    render(<RubricPanel {...ids} rubric={null} criteria={[]} />);
    await userEvent.click(screen.getByRole("radio", { name: "Paste text" }));
    await userEvent.type(screen.getByLabelText("Rubric or brief text"), "hi");
    await userEvent.click(screen.getByRole("button", { name: "Read rubric" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Paste the full rubric or brief.");
  });

  it("shows progress while the rubric is being read", () => {
    render(<RubricPanel {...ids} rubric={rubric({ status: "processing" })} criteria={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading your rubric");
  });

  it("lists criteria with weights and total", () => {
    render(<RubricPanel {...ids} rubric={rubric()} criteria={criteria} />);
    expect(screen.getByText("2 criteria from fyp-rubric.pdf")).toBeInTheDocument();
    expect(screen.getByText("Methodology")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.queryByText(/not 100%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/test mode/i)).not.toBeInTheDocument();
  });

  it("flags totals that aren't 100%, suggested weights and test mode", () => {
    render(
      <RubricPanel
        {...ids}
        rubric={rubric({ weights_suggested: true, model: "mock" })}
        criteria={[{ ...criteria[0], weight: 70 }, criteria[1]]}
      />,
    );
    expect(screen.getByText(/add up to 110%, not 100%/)).toBeInTheDocument();
    expect(screen.getByText(/didn't give weights/)).toBeInTheDocument();
    expect(screen.getByText(/test mode/i)).toBeInTheDocument();
  });

  it("explains a failed reading and lets the user try again", () => {
    render(
      <RubricPanel
        {...ids}
        rubric={rubric({ status: "failed", error_code: "not_a_rubric" })}
        criteria={[]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "We couldn't read that rubric" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/couldn't find any marking criteria/)).toBeInTheDocument();
  });

  it("can replace a rubric and cancel", async () => {
    render(<RubricPanel {...ids} rubric={rubric()} criteria={criteria} />);
    await userEvent.click(screen.getByRole("button", { name: "Replace rubric" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep current rubric" }));
    expect(screen.getByText("Methodology")).toBeInTheDocument();
  });

  it("disables adding a rubric while offline", () => {
    setOnline(false);
    render(<RubricPanel {...ids} rubric={null} criteria={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    expect(screen.getByRole("button", { name: "Read rubric" })).toBeDisabled();
  });
});
