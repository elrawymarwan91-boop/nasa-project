import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "file:./test.db";
const { app, prisma } = await import("./app.js");

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
const createdGames: string[] = [];

async function post(path: string, body: unknown, cookie?: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });
}

async function createGame() {
  const response = await post("/api/v1/games", {});
  expect(response.status).toBe(201);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  const payload = await response.json() as { gameId: string; state: { stateVersion: number } };
  expect(cookie).toBeTruthy();
  createdGames.push(payload.gameId);
  return { cookie: cookie!, ...payload };
}

beforeAll(async () => {
  await prisma.$connect();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (createdGames.length > 0) {
    await prisma.gameSession.deleteMany({ where: { id: { in: createdGames } } });
  }
  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("guest campaign API", () => {
  it("requires a guest cookie and restores a campaign for its owner", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/games/current`);
    expect(unauthenticated.status).toBe(401);

    const created = await createGame();
    const current = await fetch(`${baseUrl}/api/v1/games/current`, { headers: { Cookie: created.cookie } });
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({ gameId: created.gameId, state: { sol: 1, totalSols: 15 } });

    const stolenById = await fetch(`${baseUrl}/api/v1/games/${created.gameId}`);
    expect(stolenById.status).toBe(401);
  });

  it("queues, persists, and cancels valid actions while rejecting invalid costs", async () => {
    const created = await createGame();
    const queued = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "toggle-building",
      buildingId: "solar",
      online: false
    }, created.cookie);
    expect(queued.status).toBe(201);
    const queuedPayload = await queued.json() as { state: { pendingActions: Array<{ id: string }> } };
    expect(queuedPayload.state.pendingActions).toHaveLength(1);

    const insufficient = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "upgrade-building",
      buildingId: "habitat"
    }, created.cookie);
    expect(insufficient.status).toBe(422);
    expect(await insufficient.json()).toMatchObject({ error: { code: "insufficient_resources" } });

    const cancelled = await fetch(`${baseUrl}/api/v1/games/${created.gameId}/actions/${queuedPayload.state.pendingActions[0].id}`, {
      method: "DELETE",
      headers: { Cookie: created.cookie }
    });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({ state: { pendingActions: [] } });
  });

  it("advances once per idempotency key and rejects stale state versions", async () => {
    const created = await createGame();
    const started = await post(`/api/v1/games/${created.gameId}/start`, { expectedStateVersion: 0 }, created.cookie);
    expect(started.status).toBe(200);

    const advance = { expectedStateVersion: 1, idempotencyKey: randomUUID() };
    const first = await post(`/api/v1/games/${created.gameId}/advance`, advance, created.cookie);
    expect(first.status).toBe(200);
    const firstResult = await first.json() as { state: { sol: number; stateVersion: number } };
    expect(firstResult.state.sol).toBe(2);

    const duplicate = await post(`/api/v1/games/${created.gameId}/advance`, advance, created.cookie);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual(firstResult);

    const stale = await post(`/api/v1/games/${created.gameId}/advance`, {
      expectedStateVersion: 1,
      idempotencyKey: randomUUID()
    }, created.cookie);
    expect(stale.status).toBe(409);
  });

  it("persists equivalent event IDs safely across different guest campaigns", async () => {
    const campaigns = [await createGame(), await createGame()];
    for (const campaign of campaigns) {
      const state = { ...campaign.state, sol: 3, randomSeed: 19 };
      await prisma.gameSession.update({
        where: { id: campaign.gameId },
        data: { currentSol: 3, randomSeed: 19, currentStateJson: JSON.stringify(state) }
      });
      const started = await post(`/api/v1/games/${campaign.gameId}/start`, { expectedStateVersion: 0 }, campaign.cookie);
      expect(started.status).toBe(200);
      const advanced = await post(`/api/v1/games/${campaign.gameId}/advance`, {
        expectedStateVersion: 1,
        idempotencyKey: randomUUID()
      }, campaign.cookie);
      expect(advanced.status).toBe(200);
      expect((await advanced.json() as { state: { events: Array<{ id: string }> } }).state.events).toHaveLength(1);
    }

    const storedEvents = await prisma.gameEvent.findMany({
      where: { gameId: { in: campaigns.map((campaign) => campaign.gameId) } },
      select: { id: true, gameId: true }
    });
    expect(storedEvents).toHaveLength(2);
    expect(storedEvents[0].id).not.toBe(storedEvents[1].id);
  });

  it("exposes sourced scientific constants separately from game assumptions", async () => {
    const response = await fetch(`${baseUrl}/api/v1/data/physics-constants`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reference: {
        mars: { gravityMps2: 3.73, meanSolarIrradianceWm2: 586.2, solLengthHours: 24.6597 },
        crew: { oxygenConsumptionKgPerCrewSol: 0.895, carbonDioxideGenerationKgPerCrewSol: 1.085, foodDrySolidsKgPerCrewSol: 0.8, potableWaterKgPerCrewSol: 3.217 },
        lettuce: { edibleDryBiomassKgPerM2Sol: 0.00657 }
      },
      scenario: { solarArrayAreaM2PerLevel: 250, photovoltaicEfficiency: 0.22 }
    });
  });

  it("rejects a rover launch when the garage is already queued offline", async () => {
    const created = await createGame();
    const switchedOff = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "toggle-building", buildingId: "garage", online: false
    }, created.cookie);
    expect(switchedOff.status).toBe(201);
    const launch = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "send-rover", missionId: "ridge"
    }, created.cookie);
    expect(launch.status).toBe(422);
    expect(await launch.json()).toMatchObject({ error: { code: "invalid_action" } });
  });

  it("does not allow conflicting duplicate building toggles or duplicate rover orders", async () => {
    const created = await createGame();
    const firstToggle = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "toggle-building", buildingId: "solar", online: false
    }, created.cookie);
    expect(firstToggle.status).toBe(201);
    const secondToggle = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "toggle-building", buildingId: "solar", online: true
    }, created.cookie);
    expect(secondToggle.status).toBe(422);

    const roverOne = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "send-rover", missionId: "ridge"
    }, created.cookie);
    expect(roverOne.status).toBe(201);
    const roverTwo = await post(`/api/v1/games/${created.gameId}/actions`, {
      type: "send-rover", missionId: "dune"
    }, created.cookie);
    expect(roverTwo.status).toBe(422);
  });

  it("does not invent NASA observation records", async () => {
    const response = await fetch(`${baseUrl}/api/v1/data/observations`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ observations: [] });
  });
});
