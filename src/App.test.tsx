// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../backend/src/game/simulation";
import App from "./App";

const fetchMock = vi.fn();

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("campaign menu and briefing", () => {
  it("keeps Continue disabled when there is no guest save and opens the field guide", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/games/current")) return response({ error: { message: "No saved guest campaign was found." } }, 401);
      return response({ cards: [] });
    });
    const user = userEvent.setup();
    render(<App />);

    const continueButton = await screen.findByRole("button", { name: /continue campaign/i });
    expect(continueButton.hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", { name: /how to play/i }));
    expect(screen.getByRole("dialog", { name: /how to play/i })).toBeTruthy();
  });

  it("starts a campaign and displays mission details and initial supplies", async () => {
    const state = createInitialState(42);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/games/current")) return response({ error: { message: "No saved guest campaign was found." } }, 401);
      if (url.endsWith("/games") && init?.method === "POST") return response({ gameId: "test-game", state }, 201);
      return response({ cards: [] });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /start new campaign/i }));
    expect(await screen.findByRole("heading", { name: /gale crater outpost/i })).toBeTruthy();
    expect(screen.getByText("15 Sols")).toBeTruthy();
    expect(screen.getByText("1500")).toBeTruthy();
    expect(screen.getByText("340")).toBeTruthy();
  });


  it("continues a saved campaign from the mission briefing instead of skipping it", async () => {
    const state = createInitialState(7);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/games/current")) return response({ gameId: "saved-game", state });
      return response({ cards: [] });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /continue campaign/i }));
    expect(await screen.findByRole("button", { name: /enter the outpost/i })).toBeTruthy();
    expect(screen.getByText(/mission dossier/i)).toBeTruthy();
  });

  it("opens settings and applies reduced-motion preference", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      return String(input).endsWith("/games/current")
        ? response({ error: { message: "No saved guest campaign was found." } }, 401)
        : response({ cards: [] });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^settings$/i }));
    await user.click(screen.getByRole("checkbox", { name: /reduce motion/i }));
    await waitFor(() => expect(document.documentElement.classList.contains("reduce-motion")).toBe(true));
  });
});
