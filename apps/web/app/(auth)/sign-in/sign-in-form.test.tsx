import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SignInState } from "./actions";

const sendSignInLink = vi.fn<(prev: SignInState, data: FormData) => Promise<SignInState>>();
vi.mock("./actions", () => ({
  sendSignInLink: (...args: [SignInState, FormData]) => sendSignInLink(...args),
}));

let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));

import { SignInForm } from "./sign-in-form";

describe("SignInForm", () => {
  beforeEach(() => {
    sendSignInLink.mockReset();
    searchParams = new URLSearchParams();
  });

  it("shows the email field and primary action", () => {
    render(<SignInForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send me a sign-in link" })).toBeEnabled();
  });

  it("explains an expired link", () => {
    searchParams = new URLSearchParams("error=link");
    render(<SignInForm />);
    expect(screen.getByRole("alert")).toHaveTextContent(/expired or was already used/i);
  });

  it("passes a safe ?next path through, and drops an unsafe one", () => {
    searchParams = new URLSearchParams("next=/projects/1");
    const { container, unmount } = render(<SignInForm />);
    expect(container.querySelector('input[name="next"]')).toHaveValue("/projects/1");
    unmount();

    searchParams = new URLSearchParams("next=https://evil.example");
    const second = render(<SignInForm />);
    expect(second.container.querySelector('input[name="next"]')).toHaveValue("/home");
  });

  it("shows the check-your-email state after sending", async () => {
    sendSignInLink.mockResolvedValue({ status: "sent", email: "aina@uni.edu" });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText("Email"), "aina@uni.edu");
    await userEvent.click(screen.getByRole("button", { name: "Send me a sign-in link" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("aina@uni.edu")).toBeInTheDocument();
  });

  it("shows server errors next to the field and keeps the typed email", async () => {
    sendSignInLink.mockResolvedValue({
      status: "error",
      email: "aina@uni.edu",
      message: "Please wait a minute before requesting another link.",
    });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText("Email"), "aina@uni.edu");
    await userEvent.click(screen.getByRole("button", { name: "Send me a sign-in link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a minute/i);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
