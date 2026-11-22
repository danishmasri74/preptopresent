import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult, DeleteAccountState } from "./actions";

const setPreference = vi.fn<(input: { kind: string; granted: boolean }) => Promise<ActionResult>>();
const deleteAccount =
  vi.fn<(prev: DeleteAccountState, data: FormData) => Promise<DeleteAccountState>>();
vi.mock("./actions", () => ({
  setPreference: (input: { kind: string; granted: boolean }) => setPreference(input),
  deleteAccount: (prev: DeleteAccountState, data: FormData) => deleteAccount(prev, data),
}));

import { PrivacySettings } from "./privacy-settings";

const prefs = { save_video_default: true, study_participation: false };

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

describe("PrivacySettings", () => {
  beforeEach(() => {
    setPreference.mockReset();
    deleteAccount.mockReset();
    setOnline(true);
  });

  it("shows current preferences and the data actions", () => {
    render(<PrivacySettings preferences={prefs} recordingCount={0} />);
    expect(screen.getByRole("switch", { name: "Save video for playback" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Help evaluate PrepToPresent" })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "/settings/export",
    );
    expect(screen.getByRole("button", { name: "Delete account" })).toBeEnabled();
  });

  it("explains the empty recordings state and disables deleting them", () => {
    render(<PrivacySettings preferences={prefs} recordingCount={0} />);
    expect(screen.getByText(/no recordings yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete recordings" })).toBeDisabled();
  });

  it("saves a preference change", async () => {
    setPreference.mockResolvedValue({ ok: true });
    render(<PrivacySettings preferences={prefs} recordingCount={0} />);
    const toggle = screen.getByRole("switch", { name: "Help evaluate PrepToPresent" });
    await userEvent.click(toggle);
    expect(setPreference).toHaveBeenCalledWith({ kind: "study_participation", granted: true });
    await waitFor(() => expect(toggle).toBeChecked());
  });

  it("reverts the switch and shows an error when saving fails", async () => {
    setPreference.mockResolvedValue({ ok: false, message: "We couldn't save that change." });
    render(<PrivacySettings preferences={prefs} recordingCount={0} />);
    const toggle = screen.getByRole("switch", { name: "Save video for playback" });
    await userEvent.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save that change.");
    expect(toggle).toBeChecked();
  });

  it("disables changes while offline", () => {
    setOnline(false);
    render(<PrivacySettings preferences={prefs} recordingCount={0} />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    expect(screen.getByRole("switch", { name: "Save video for playback" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
  });

  it("only allows deleting the account after typing the confirm phrase", async () => {
    deleteAccount.mockResolvedValue({ status: "error", message: "Something went wrong." });
    render(<PrivacySettings preferences={prefs} recordingCount={0} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Delete your account?" });
    const submit = screen.getAllByRole("button", { name: "Delete account" }).at(-1)!;
    expect(dialog).toContainElement(submit);
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(deleteAccount.mock.calls[0]![1].get("confirm")).toBe("DELETE");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
  });
});
