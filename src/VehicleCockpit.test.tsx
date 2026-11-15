// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../backend/src/game/simulation";
import VehicleCockpit from "./VehicleCockpit";

afterEach(() => cleanup());

describe("vehicle cockpit workspaces", () => {
  it("shows spacecraft modules and campaign-linked environmental telemetry", async () => {
    const game = createInitialState(123);
    const user = userEvent.setup();
    render(<VehicleCockpit
      vehicle="spacecraft"
      game={game}
      busy={false}
      onSelectVehicle={vi.fn()}
      onQueueRoverMission={vi.fn()}
      onAdvanceSol={vi.fn()}
    />);

    expect(screen.getByRole("heading", { name: /spacecraft systems overview/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /life support/i }));
    expect(screen.getByRole("heading", { name: /life support & cabin atmosphere/i })).toBeTruthy();
    expect(screen.getByText(/cab(in|in) pressure/i)).toBeTruthy();
  });

  it("queues a selected rover sortie through the supplied backend action handler", async () => {
    const game = createInitialState(456);
    const queueMission = vi.fn();
    const user = userEvent.setup();
    render(<VehicleCockpit
      vehicle="rover"
      game={game}
      busy={false}
      onSelectVehicle={vi.fn()}
      onQueueRoverMission={queueMission}
      onAdvanceSol={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: /queue exploration sortie/i }));
    expect(queueMission).toHaveBeenCalledWith(game.rover[0].id);
  });
});
