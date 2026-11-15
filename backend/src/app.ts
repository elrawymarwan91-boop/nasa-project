import "dotenv/config";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { z, ZodError } from "zod";
import {
  CAMPAIGN_ID,
  CAMPAIGN_LENGTH,
  SCIENCE_CARDS,
  type GameState,
  type PlayerAction
} from "../../shared/game.js";
import { createInitialState, simulateSol } from "./game/simulation.js";
import { DATA_SOURCES, PHYSICS_CONSTANTS } from "./data/sources.js";

const prisma = new PrismaClient();
const app = express();
const cookieName = "outpost_guest";

app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggle-building"), buildingId: z.enum(["habitat", "solar", "battery", "life-support", "water-recovery", "greenhouse", "shelter", "garage"]), online: z.boolean() }),
  z.object({ type: z.literal("upgrade-building"), buildingId: z.enum(["habitat", "solar", "battery", "life-support", "water-recovery", "greenhouse", "shelter", "garage"]) }),
  z.object({ type: z.literal("assign-crew"), crewId: z.string().min(1), task: z.enum(["maintenance", "biology", "research", "rover"]) }),
  z.object({ type: z.literal("send-rover"), missionId: z.string().min(1) }),
  z.object({ type: z.literal("resolve-event"), eventId: z.string().min(1), choiceId: z.string().min(1) })
]);
const advanceSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid()
});

class ApiError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseState(json: string): GameState {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || !("resources" in parsed) || !("stateVersion" in parsed)) {
    throw new Error("Stored campaign state is invalid.");
  }
  // Backward-compatible read for guest saves created before the environment
  // telemetry model was added. The next successful turn persists the upgraded shape.
  if (!("environment" in parsed)) {
    const upgraded = { ...(parsed as Omit<GameState, "environment">), environment: createInitialState(0).environment };
    return upgraded as GameState;
  }
  return parsed as GameState;
}

async function requireGame(req: Request): Promise<{ id: string; state: GameState }> {
  const token = req.cookies?.[cookieName] as string | undefined;
  if (!token) throw new ApiError(401, "A valid guest session is required.", "guest_session_required");
  const game = await prisma.gameSession.findFirst({
    where: { id: routeParam(req, "gameId"), guestTokenHash: hashToken(token) }
  });
  if (!game) throw new ApiError(404, "Campaign not found for this guest session.", "game_not_found");
  return { id: game.id, state: parseState(game.currentStateJson) };
}

function validateAction(state: GameState, action: PlayerAction): void {
  if (state.status !== "active") throw new ApiError(409, "This campaign has ended.", "campaign_ended");
  switch (action.type) {
    case "toggle-building": {
      if (!state.buildings.some((building) => building.id === action.buildingId)) throw new ApiError(422, "Unknown building.", "invalid_action");
      if (state.pendingActions.some((item) => item.type === "toggle-building" && item.buildingId === action.buildingId)) {
        throw new ApiError(422, "A toggle for this building is already queued. Cancel it before choosing another state.", "invalid_action");
      }
      if (action.buildingId === "garage" && !action.online && state.pendingActions.some((item) => item.type === "send-rover")) {
        throw new ApiError(422, "The Rover Garage cannot be set to standby while a rover launch is queued.", "invalid_action");
      }
      break;
    }
    case "upgrade-building": {
      const building = state.buildings.find((item) => item.id === action.buildingId);
      if (!building || building.level >= 3 || state.pendingActions.some((item) => item.type === "upgrade-building" && item.buildingId === action.buildingId)) {
        throw new ApiError(422, "This building cannot be upgraded further or already has an upgrade queued.", "invalid_action");
      }
      if (
        state.resources.waterLiters - reservedResource(state, "waterLiters") < 90 ||
        state.resources.batteryKwh - reservedResource(state, "batteryKwh") < 45 ||
        state.resources.sciencePoints - reservedResource(state, "sciencePoints") < 4
      ) {
        throw new ApiError(422, "An upgrade requires 90 L water, 45 kWh and 4 science points.", "insufficient_resources");
      }
      break;
    }
    case "assign-crew":
      if (!state.crew.some((person) => person.id === action.crewId)) throw new ApiError(422, "Unknown crew member.", "invalid_action");
      break;
    case "send-rover": {
      const mission = state.rover.find((item) => item.id === action.missionId);
      if (!mission || mission.status !== "available" || state.pendingActions.some((item) => item.type === "send-rover") || state.rover.some((item) => item.status === "enroute")) {
        throw new ApiError(422, "That rover route is unavailable, already queued, or another rover sortie is active.", "invalid_action");
      }
      const queuedGarageToggle = [...state.pendingActions].reverse().find(
        (item) => item.type === "toggle-building" && item.buildingId === "garage"
      );
      const garageWillBeOnline = queuedGarageToggle?.type === "toggle-building"
        ? queuedGarageToggle.online
        : state.buildings.some((building) => building.id === "garage" && building.online);
      if (!garageWillBeOnline) {
        throw new ApiError(422, "The Rover Garage must be online when the queued launch is executed.", "invalid_action");
      }
      if (
        state.resources.batteryKwh - reservedResource(state, "batteryKwh") < 24 ||
        state.resources.foodKg - reservedResource(state, "foodKg") < 8
      ) {
        throw new ApiError(422, "A rover launch requires 24 kWh and 8 kg food.", "insufficient_resources");
      }
      break;
    }
    case "resolve-event": {
      const event = state.events.find((item) => item.id === action.eventId && !item.resolved);
      if (
        !event ||
        !event.choices.some((choice) => choice.id === action.choiceId) ||
        state.pendingActions.some((item) => item.type === "resolve-event" && item.eventId === action.eventId)
      ) {
        throw new ApiError(422, "Choose an available response to an unresolved event.", "invalid_action");
      }
      const choice = event.choices.find((item) => item.id === action.choiceId);
      for (const resource of ["batteryKwh", "waterLiters", "foodKg"] as const) {
        const cost = choice?.cost[resource] ?? 0;
        if (state.resources[resource] - reservedResource(state, resource) < cost) {
          throw new ApiError(422, `Insufficient ${resource} for this response.`, "insufficient_resources");
        }
      }
      break;
    }
  }
}

function stateHash(state: GameState): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

function reservedResource(state: GameState, resource: "waterLiters" | "batteryKwh" | "foodKg" | "sciencePoints"): number {
  return state.pendingActions.reduce((reserved, action) => {
    if (action.type === "upgrade-building") {
      if (resource === "waterLiters") return reserved + 90;
      if (resource === "batteryKwh") return reserved + 45;
      if (resource === "sciencePoints") return reserved + 4;
    }
    if (action.type === "send-rover") {
      if (resource === "batteryKwh") return reserved + 24;
      if (resource === "foodKg") return reserved + 8;
    }
    if (action.type === "resolve-event") {
      const event = state.events.find((item) => item.id === action.eventId);
      const choice = event?.choices.find((item) => item.id === action.choiceId);
      if (resource === "sciencePoints") return reserved;
      return reserved + (choice?.cost[resource] ?? 0);
    }
    return reserved;
  }, 0);
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/v1/missions", (_req, res) => {
  res.json([{ id: CAMPAIGN_ID, slug: CAMPAIGN_ID, title: "Gale Crater: First Light", planet: "Mars", site: "Gale-inspired fictional outpost", durationSols: CAMPAIGN_LENGTH }]);
});

app.get("/api/v1/missions/:missionId", (req, res, next) => {
  if (routeParam(req, "missionId") !== CAMPAIGN_ID) return next(new ApiError(404, "Mission not found.", "mission_not_found"));
  res.json({ id: CAMPAIGN_ID, title: "Gale Crater: First Light", planet: "Mars", site: "Gale-inspired fictional outpost", durationSols: CAMPAIGN_LENGTH });
});

app.post("/api/v1/games", async (req, res) => {
  const missionId = req.body?.missionId ?? CAMPAIGN_ID;
  if (missionId !== CAMPAIGN_ID) throw new ApiError(422, "Unknown campaign.", "invalid_mission");
  const token = randomBytes(32).toString("base64url");
  const seed = randomInt(1, 2 ** 31 - 1);
  const state = createInitialState(seed);
  const id = randomUUID();
  await prisma.missionTemplate.upsert({
    where: { id: CAMPAIGN_ID },
    create: { id: CAMPAIGN_ID, slug: CAMPAIGN_ID, title: "Gale Crater: First Light", planet: "Mars", site: "Gale-inspired fictional outpost", durationSols: CAMPAIGN_LENGTH, configJson: JSON.stringify({ campaignLength: CAMPAIGN_LENGTH }) },
    update: {}
  });
  await prisma.$transaction(async (tx) => {
    await tx.gameSession.create({
      data: { id, missionId: CAMPAIGN_ID, guestTokenHash: hashToken(token), status: "active", currentSol: 1, totalSols: CAMPAIGN_LENGTH, randomSeed: seed, stateVersion: 0, currentStateJson: JSON.stringify(state) }
    });
    await tx.gameSnapshot.create({ data: { id: randomUUID(), gameId: id, sol: 0, stateJson: JSON.stringify(state), stateHash: stateHash(state) } });
  });
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 90
  });
  res.status(201).json({ gameId: id, state });
});

app.get("/api/v1/games/current", async (req, res) => {
  const token = req.cookies?.[cookieName] as string | undefined;
  if (!token) throw new ApiError(401, "No saved guest campaign was found.", "guest_session_required");
  const game = await prisma.gameSession.findFirst({
    where: { guestTokenHash: hashToken(token) },
    orderBy: { updatedAt: "desc" }
  });
  if (!game) throw new ApiError(404, "No saved campaign was found.", "game_not_found");
  res.json({ gameId: game.id, state: parseState(game.currentStateJson) });
});

app.get("/api/v1/games/:gameId", async (req, res) => {
  const game = await requireGame(req);
  res.json({ gameId: game.id, state: game.state });
});

app.post("/api/v1/games/:gameId/start", async (req, res) => {
  const game = await requireGame(req);
  const body = z.object({ expectedStateVersion: z.number().int().nonnegative() }).parse(req.body);
  if (body.expectedStateVersion !== game.state.stateVersion) {
    throw new ApiError(409, "Campaign state changed. Reload before starting.", "state_version_conflict");
  }
  if (game.state.status !== "active") throw new ApiError(409, "This campaign has already ended.", "campaign_ended");
  const updated = { ...game.state, phase: "game" as const, stateVersion: game.state.stateVersion + 1 };
  const write = await prisma.gameSession.updateMany({
    where: { id: game.id, stateVersion: body.expectedStateVersion },
    data: { stateVersion: updated.stateVersion, currentStateJson: JSON.stringify(updated) }
  });
  if (write.count !== 1) throw new ApiError(409, "Campaign state changed. Reload before starting.", "state_version_conflict");
  res.json({ gameId: game.id, state: updated });
});

app.post("/api/v1/games/:gameId/actions", async (req, res) => {
  const game = await requireGame(req);
  const action = actionSchema.parse(req.body) as PlayerAction;
  validateAction(game.state, action);
  const queuedAction = { ...action, id: randomUUID() };
  const updated: GameState = {
    ...game.state,
    pendingActions: [...game.state.pendingActions, queuedAction],
    stateVersion: game.state.stateVersion + 1
  };
  await prisma.$transaction(async (tx) => {
    const write = await tx.gameSession.updateMany({
      where: { id: game.id, stateVersion: game.state.stateVersion },
      data: { stateVersion: updated.stateVersion, currentStateJson: JSON.stringify(updated) }
    });
    if (write.count !== 1) throw new ApiError(409, "Campaign state changed. Reload and retry.", "state_version_conflict");
    await tx.playerAction.create({
      data: { id: queuedAction.id, gameId: game.id, sol: game.state.sol, actionType: action.type, payloadJson: JSON.stringify(queuedAction), status: "queued", idempotencyKey: queuedAction.id }
    });
  });
  res.status(201).json({ gameId: game.id, state: updated });
});

app.delete("/api/v1/games/:gameId/actions/:actionId", async (req, res) => {
  const game = await requireGame(req);
  const action = game.state.pendingActions.find((item) => item.id === routeParam(req, "actionId"));
  if (!action) throw new ApiError(404, "Queued action not found.", "action_not_found");
  const updated = {
    ...game.state,
    pendingActions: game.state.pendingActions.filter((item) => item.id !== action.id),
    stateVersion: game.state.stateVersion + 1
  };
  await prisma.$transaction(async (tx) => {
    const write = await tx.gameSession.updateMany({
      where: { id: game.id, stateVersion: game.state.stateVersion },
      data: { stateVersion: updated.stateVersion, currentStateJson: JSON.stringify(updated) }
    });
    if (write.count !== 1) throw new ApiError(409, "Campaign state changed. Reload and retry.", "state_version_conflict");
    await tx.playerAction.update({ where: { id: action.id }, data: { status: "cancelled" } });
  });
  res.json({ gameId: game.id, state: updated });
});

app.post("/api/v1/games/:gameId/advance", async (req, res) => {
  const game = await requireGame(req);
  const body = advanceSchema.parse(req.body);
  const prior = await prisma.playerAction.findUnique({
    where: { gameId_idempotencyKey: { gameId: game.id, idempotencyKey: body.idempotencyKey } }
  });
  if (prior?.actionType === "advance" && prior.status === "completed") {
    return res.json(JSON.parse(prior.payloadJson));
  }
  if (body.expectedStateVersion !== game.state.stateVersion) {
    throw new ApiError(409, "Campaign state changed. Reload before advancing.", "state_version_conflict");
  }
  let updated: GameState;
  try {
    updated = simulateSol(game.state);
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : "The turn could not be simulated.", "invalid_turn");
  }
  const response = { gameId: game.id, state: updated };
  try {
    await prisma.$transaction(async (tx) => {
      const write = await tx.gameSession.updateMany({
        where: { id: game.id, stateVersion: body.expectedStateVersion },
        data: { currentSol: updated.sol, status: updated.status, stateVersion: updated.stateVersion, currentStateJson: JSON.stringify(updated) }
      });
      if (write.count !== 1) throw new ApiError(409, "Campaign state changed. Reload before advancing.", "state_version_conflict");
      await tx.gameSnapshot.create({
        data: { id: randomUUID(), gameId: game.id, sol: updated.sol - 1, stateJson: JSON.stringify(updated), stateHash: stateHash(updated) }
      });
      for (const event of updated.events.filter((item) => item.id.endsWith(`-${updated.sol}-${item.code}`))) {
        await tx.gameEvent.create({
          data: { id: randomUUID(), gameId: game.id, sol: updated.sol, eventCode: event.code, severity: event.severity, payloadJson: JSON.stringify(event) }
        });
      }
      await tx.playerAction.updateMany({ where: { gameId: game.id, status: "queued" }, data: { status: "completed" } });
      await tx.playerAction.create({
        data: { id: randomUUID(), gameId: game.id, sol: updated.sol - 1, actionType: "advance", payloadJson: JSON.stringify(response), status: "completed", idempotencyKey: body.idempotencyKey }
      });
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await prisma.playerAction.findUnique({
        where: { gameId_idempotencyKey: { gameId: game.id, idempotencyKey: body.idempotencyKey } }
      });
      if (duplicate?.actionType === "advance") return res.json(JSON.parse(duplicate.payloadJson));
    }
    throw error;
  }
  res.json(response);
});

app.get("/api/v1/games/:gameId/history", async (req, res) => {
  const game = await requireGame(req);
  const snapshots = await prisma.gameSnapshot.findMany({
    where: { gameId: game.id },
    orderBy: { sol: "asc" },
    select: { sol: true, stateHash: true, createdAt: true }
  });
  res.json({ history: game.state.history, snapshots });
});

app.get("/api/v1/data/sources", (_req, res) => res.json({ sources: DATA_SOURCES }));
app.get("/api/v1/data/physics-constants", (_req, res) => res.json(PHYSICS_CONSTANTS));
app.get("/api/v1/data/observations", (_req, res) => res.json({
  observations: [],
  note: "No raw time-series observation feed has been downloaded in this build. Verified published reference constants and BVAD values are exposed separately through /physics-constants; no generated fixture is presented as a NASA observation."
}));
app.get("/api/v1/data/science-cards", (_req, res) => res.json({ cards: SCIENCE_CARDS }));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(422).json({ error: { code: "validation_error", message: "Request validation failed.", details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } });
  }
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  console.error("Unhandled API error", error);
  return res.status(500).json({ error: { code: "internal_error", message: "An unexpected server error occurred." } });
});

app.use((req, res) => res.status(404).json({ error: { code: "not_found", message: `No route for ${req.method} ${req.path}.` } }));

export { app, prisma };

