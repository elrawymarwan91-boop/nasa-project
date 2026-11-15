import { describe, expect, it } from "vitest";
import { createInitialState, simulateSol } from "./simulation.js";
import { calculateSolarEnergy, cabinPressureDeltaKpa, lettuceDryHarvestKg, powerDemandKwh } from "./physics.js";
import { SCIENTIFIC_REFERENCE, GAME_ASSUMPTIONS } from "./config.js";

describe("physics calculations", () => {
  it("converts continuous kW load into kWh over one Martian Sol", () => {
    expect(powerDemandKwh(1)).toBeCloseTo(SCIENTIFIC_REFERENCE.mars.solLengthHours, 6);
    expect(powerDemandKwh(4.1)).toBeCloseTo(4.1 * 24.6597, 5);
  });

  it("applies dust attenuation and solar-array condition to PV output", () => {
    const clear = calculateSolarEnergy({ dustOpticalDepth: 0.5, arrayAreaM2: 250, efficiency: 0.22, equivalentPeakSunHours: 6.5, enabled: true, conditionPercent: 100 });
    const storm = calculateSolarEnergy({ dustOpticalDepth: 3, arrayAreaM2: 250, efficiency: 0.22, equivalentPeakSunHours: 6.5, enabled: true, conditionPercent: 100 });
    const damaged = calculateSolarEnergy({ dustOpticalDepth: 0.5, arrayAreaM2: 250, efficiency: 0.22, equivalentPeakSunHours: 6.5, enabled: true, conditionPercent: 50 });
    expect(clear.energyKwh).toBeGreaterThan(storm.energyKwh);
    expect(damaged.energyKwh).toBeCloseTo(clear.energyKwh / 2, 8);
    expect(clear.energyKwh).toBeCloseTo(clear.peakPowerKw * 6.5, 8);
  });

  it("uses the ideal-gas relation for oxygen and carbon-dioxide mass balance", () => {
    const pressureRise = cabinPressureDeltaKpa({ oxygenAddedKg: 1, oxygenRemovedKg: 0, carbonDioxideAddedKg: 0, carbonDioxideRemovedKg: 0, cabinTemperatureC: 20, cabinVolumeM3: 150 });
    const pressureDrop = cabinPressureDeltaKpa({ oxygenAddedKg: 0, oxygenRemovedKg: 1, carbonDioxideAddedKg: 0, carbonDioxideRemovedKg: 0, cabinTemperatureC: 20, cabinVolumeM3: 150 });
    expect(pressureRise).toBeGreaterThan(0);
    expect(pressureDrop).toBeCloseTo(-pressureRise, 10);
  });

  it("uses the published BVAD dry lettuce productivity as a mature-crop reference", () => {
    const harvest = lettuceDryHarvestKg({ greenhouseAreaM2: 60, conditionPercent: 100, biologyStaff: 1, powerFraction: 1 });
    expect(harvest).toBeCloseTo(0.00657 * 60, 8);
    expect(GAME_ASSUMPTIONS.greenhouseAreaM2).toBe(60);
  });
});

describe("Sol simulation", () => {
  it("balances oxygen production separately from carbon-dioxide scrubbing", () => {
    const state = createInitialState(42);
    state.pendingActions.push({ id: "life-standby", type: "toggle-building", buildingId: "life-support", online: false });

    const next = simulateSol(state);

    expect(next.resources.oxygenKg).toBeLessThan(state.resources.oxygenKg);
    expect(next.resources.carbonDioxideKg).toBeGreaterThan(state.resources.carbonDioxideKg);
    expect(next.resources.cabinPressureKpa).toBeLessThanOrEqual(state.resources.cabinPressureKpa);
  });

  it("exposes reference environmental values and reports modeled energy in kWh per Sol", () => {
    const state = createInitialState(41);
    expect(state.environment.gravityMps2).toBe(3.73);
    expect(state.environment.solLengthHours).toBe(24.6597);
    expect(state.environment.solarEnergyKwh).toBeGreaterThan(0);
    expect(state.environment.energyDemandKwh).toBeGreaterThan(0);
    expect(state.environment.solarArrayAreaM2).toBe(250);
  });

  it("reduces solar output when the array is damaged", () => {
    const state = createInitialState(42);
    const healthy = simulateSol(state);
    const damagedInput = createInitialState(42);
    damagedInput.buildings.find((item) => item.id === "solar")!.condition = 50;
    const damaged = simulateSol(damagedInput);
    expect(damaged.environment.solarEnergyKwh).toBeLessThan(healthy.environment.solarEnergyKwh);
  });

  it("keeps battery energy within its physical inventory limits", () => {
    const empty = createInitialState(12);
    empty.resources.batteryKwh = 3;
    const depleted = simulateSol(empty);
    expect(depleted.resources.batteryKwh).toBeGreaterThanOrEqual(0);

    const full = createInitialState(12);
    full.resources.batteryKwh = full.resources.batteryCapacityKwh;
    const charged = simulateSol(full);
    expect(charged.resources.batteryKwh).toBeLessThanOrEqual(full.resources.batteryCapacityKwh);
  });

  it("uses a deterministic event and weather sequence for the same campaign seed", () => {
    const first = simulateSol(createInitialState(123456));
    const second = simulateSol(createInitialState(123456));
    expect(first.resources).toEqual(second.resources);
    expect(first.events).toEqual(second.events);
    expect(first.lastReport).toEqual(second.lastReport);
  });

  it("consumes food every Sol while crop production remains gradual", () => {
    const state = createInitialState(7);
    state.resources.foodKg = 200;
    const next = simulateSol(state);
    expect(next.resources.foodKg).toBeLessThan(state.resources.foodKg);
    expect(next.lastReport?.completedActivities.some((item) => item.includes("harvested"))).toBe(true);
  });

  it("completes rover missions after two advances and awards science on return", () => {
    const state = createInitialState(99);
    state.pendingActions.push({ id: "launch-ridge", type: "send-rover", missionId: "ridge" });
    const first = simulateSol(state);
    expect(first.rover[0].status).toBe("enroute");
    expect(first.rover[0].solsRemaining).toBe(1);
    const second = simulateSol(first);
    expect(second.rover[0].status).toBe("complete");
    expect(second.objectives.rover).toBe(true);
    expect(second.resources.sciencePoints).toBeGreaterThan(first.resources.sciencePoints);
  });

  it("rejects a queued upgrade that cannot be paid for instead of creating negative inventory", () => {
    const state = createInitialState(2);
    state.resources.waterLiters = 0;
    state.pendingActions.push({ id: "unaffordable", type: "upgrade-building", buildingId: "habitat" });
    expect(() => simulateSol(state)).toThrow("Insufficient water");
    expect(state.resources.waterLiters).toBe(0);
  });

  it("records separate resource deltas and increments the state version", () => {
    const state = createInitialState(71);
    const next = simulateSol(state);
    expect(next.stateVersion).toBe(state.stateVersion + 1);
    expect(next.lastReport?.changes).toHaveProperty("oxygenKg");
    expect(next.lastReport?.changes).toHaveProperty("waterLiters");
    expect(next.history).toHaveLength(1);
  });

  it("can win the complete campaign with deliberate crew and rover planning", () => {
    let state = createInitialState(2026);
    state.pendingActions.push(
      { id: "biology", type: "assign-crew", crewId: "amara", task: "biology" },
      { id: "launch-ridge", type: "send-rover", missionId: "ridge" }
    );
    for (let sol = 0; sol < 15; sol += 1) state = simulateSol(state);
    expect(state.status).toBe("won");
    expect(state.objectives).toEqual({ survive: true, science: true, rover: true });
  });

  it("ends a campaign when oxygen inventory crosses the minimum threshold", () => {
    const state = createInitialState(13);
    state.resources.oxygenKg = 0;
    expect(simulateSol(state).status).toBe("lost");
  });
});
