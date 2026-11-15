import {
  BUILDINGS,
  CAMPAIGN_LENGTH,
  CREW,
  INITIAL_RESOURCES,
  ROVER_MISSIONS,
  type Building,
  type GameEnvironment,
  type GameEvent,
  type GameState,
  type PlayerAction,
  type TurnReport
} from "../../../shared/game.js";
import { GAME_ASSUMPTIONS, SCIENTIFIC_REFERENCE, SIMULATION } from "./config.js";
import { calculateSolarEnergy, cabinPressureDeltaKpa, lettuceDryHarvestKg, nextCabinTemperatureC, powerDemandKwh } from "./physics.js";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const buildingIsOnline = (state: GameState, id: Building["id"]) =>
  state.buildings.find((building) => building.id === id)?.online === true;

function calculateEnvironment(state: GameState, dustStorm: boolean): GameEnvironment {
  const solar = state.buildings.find((item) => item.id === "solar");
  const panelLevel = solar?.level ?? 1;
  const dustOpticalDepth = dustStorm ? GAME_ASSUMPTIONS.stormDustOpticalDepth : GAME_ASSUMPTIONS.clearDustOpticalDepth;
  const solarCalc = calculateSolarEnergy({
    dustOpticalDepth,
    arrayAreaM2: GAME_ASSUMPTIONS.solarArrayAreaM2PerLevel * panelLevel,
    efficiency: GAME_ASSUMPTIONS.photovoltaicEfficiency,
    conditionPercent: solar?.condition ?? 100,
    equivalentPeakSunHours: GAME_ASSUMPTIONS.equivalentPeakSunHoursPerSol,
    enabled: solar?.online === true
  });
  return {
    gravityMps2: SCIENTIFIC_REFERENCE.mars.gravityMps2,
    solLengthHours: SCIENTIFIC_REFERENCE.mars.solLengthHours,
    solarIrradianceTopWm2: SCIENTIFIC_REFERENCE.mars.meanSolarIrradianceWm2,
    solarIrradianceSurfaceWm2: round(solarCalc.surfaceIrradianceWm2, 1),
    dustOpticalDepth,
    equivalentPeakSunHours: GAME_ASSUMPTIONS.equivalentPeakSunHoursPerSol,
    outsideTemperatureC: GAME_ASSUMPTIONS.outsideTemperatureC,
    dustStorm,
    solarArrayAreaM2: GAME_ASSUMPTIONS.solarArrayAreaM2PerLevel * panelLevel,
    solarPeakPowerKw: round(solarCalc.peakPowerKw, 2),
    solarEnergyKwh: round(solarCalc.energyKwh, 2),
    energyDemandKwh: 0
  };
}

export function createInitialState(randomSeed: number): GameState {
  const state: GameState = {
    phase: "briefing",
    status: "active",
    sol: 1,
    totalSols: CAMPAIGN_LENGTH,
    stateVersion: 0,
    randomSeed,
    environment: {
      gravityMps2: SCIENTIFIC_REFERENCE.mars.gravityMps2,
      solLengthHours: SCIENTIFIC_REFERENCE.mars.solLengthHours,
      solarIrradianceTopWm2: SCIENTIFIC_REFERENCE.mars.meanSolarIrradianceWm2,
      solarIrradianceSurfaceWm2: 0,
      dustOpticalDepth: GAME_ASSUMPTIONS.clearDustOpticalDepth,
      equivalentPeakSunHours: GAME_ASSUMPTIONS.equivalentPeakSunHoursPerSol,
      outsideTemperatureC: GAME_ASSUMPTIONS.outsideTemperatureC,
      dustStorm: false,
      solarArrayAreaM2: GAME_ASSUMPTIONS.solarArrayAreaM2PerLevel,
      solarPeakPowerKw: 0,
      solarEnergyKwh: 0,
      energyDemandKwh: 0
    },
    resources: { ...INITIAL_RESOURCES },
    buildings: BUILDINGS.map((building) => ({ ...building })),
    crew: CREW.map((member) => ({ ...member })),
    rover: ROVER_MISSIONS.map((mission) => ({ ...mission })),
    events: [],
    pendingActions: [],
    history: [],
    objectives: { survive: false, science: false, rover: false },
    lastReport: null
  };
  const environment = calculateEnvironment(state, false);
  const demandKw = SIMULATION.fixedPowerKw + SIMULATION.lifeSupportPowerKw + SIMULATION.waterRecoveryPowerKw + SIMULATION.greenhousePowerKw + SIMULATION.thermalControlPowerKw;
  environment.energyDemandKwh = round(powerDemandKwh(demandKw), 2);
  state.environment = environment;
  state.resources.powerBalanceKw = round((environment.solarEnergyKwh - environment.energyDemandKwh) / environment.solLengthHours, 2);
  return state;
}

function randomForSol(seed: number, sol: number): number {
  let value = (seed ^ Math.imul(sol, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

function makeEvent(state: GameState, sol: number): GameEvent | null {
  const random = randomForSol(state.randomSeed, sol);
  if (state.events.some((event) => !event.resolved) || (random > 0.54 && sol % 4 !== 0)) return null;
  const catalog: Array<Omit<GameEvent, "id" | "resolved">> = [
    {
      code: "dust-storm",
      title: "Dust front approaching",
      severity: "medium",
      description: "Atmospheric dust is reducing the solar array's available irradiance. Reassess stored energy and non-essential loads.",
      choices: [
        { id: "shelter", label: "Shelter the crew", detail: "Reduce the educational radiation-risk index; spend stored energy.", cost: { batteryKwh: 16 } },
        { id: "conserve", label: "Conserve power", detail: "Keep non-critical systems on standby; spend a smaller energy reserve.", cost: { batteryKwh: 5 } }
      ]
    },
    {
      code: "solar-alert",
      title: "Solar weather alert",
      severity: "low",
      description: "A heliophysics alert is being used as a scripted learning scenario. It is not converted into a Mars surface dose prediction.",
      choices: [
        { id: "suspend", label: "Suspend surface work", detail: "Protect the crew and rover; spend a small energy reserve.", cost: { batteryKwh: 8 } },
        { id: "observe", label: "Continue remote observations", detail: "Keep the crew indoors; receive a small science bonus.", cost: { batteryKwh: 4 } }
      ]
    },
    {
      code: "filter-fault",
      title: "Water recovery filter fault",
      severity: "medium",
      description: "The water loop's recovery efficiency is degraded. A maintenance response can restore the equipment condition.",
      choices: [
        { id: "repair", label: "Repair the filter", detail: "Use a crew shift and spare water.", cost: { waterLiters: 28 } },
        { id: "ration", label: "Run at reduced flow", detail: "Save supplies now, but accept lower recovery this Sol.", cost: {} }
      ]
    }
  ];
  const event = catalog[Math.floor(randomForSol(state.randomSeed + 13, sol) * catalog.length)];
  return { ...event, id: `event-${sol}-${event.code}`, resolved: false };
}

function applyAction(state: GameState, action: PlayerAction, activities: string[]): void {
  switch (action.type) {
    case "toggle-building": {
      const building = state.buildings.find((item) => item.id === action.buildingId);
      if (!building) throw new Error("Building no longer exists.");
      building.online = action.online;
      activities.push(`${building.name} switched ${action.online ? "online" : "to standby"}.`);
      break;
    }
    case "upgrade-building": {
      const building = state.buildings.find((item) => item.id === action.buildingId);
      if (!building) throw new Error("Building no longer exists.");
      if (building.level >= 3) throw new Error(`${building.name} is already at maximum level.`);
      if (
        state.resources.waterLiters < SIMULATION.upgradeCost.waterLiters ||
        state.resources.batteryKwh < SIMULATION.upgradeCost.batteryKwh ||
        state.resources.sciencePoints < SIMULATION.upgradeCost.sciencePoints
      ) throw new Error("Insufficient water, energy, or research for this upgrade.");
      state.resources.waterLiters -= SIMULATION.upgradeCost.waterLiters;
      state.resources.batteryKwh -= SIMULATION.upgradeCost.batteryKwh;
      state.resources.sciencePoints -= SIMULATION.upgradeCost.sciencePoints;
      building.level += 1;
      building.condition = clamp(building.condition + 8, 0, 100);
      activities.push(`${building.name} upgraded to level ${building.level}.`);
      break;
    }
    case "assign-crew": {
      const member = state.crew.find((person) => person.id === action.crewId);
      if (!member) throw new Error("Crew member no longer exists.");
      member.task = action.task;
      activities.push(`${member.name} assigned to ${action.task}.`);
      break;
    }
    case "send-rover": {
      const mission = state.rover.find((item) => item.id === action.missionId);
      if (!mission || mission.status !== "available") throw new Error("That rover route is not available.");
      if (!buildingIsOnline(state, "garage")) throw new Error("The Rover Garage must be online before launch.");
      if (state.resources.batteryKwh < SIMULATION.roverCost.batteryKwh || state.resources.foodKg < SIMULATION.roverCost.foodKg) {
        throw new Error("Insufficient rover energy or crew provisions.");
      }
      state.resources.batteryKwh -= SIMULATION.roverCost.batteryKwh;
      state.resources.foodKg -= SIMULATION.roverCost.foodKg;
      mission.status = "enroute";
      mission.solsRemaining = SIMULATION.roverDurationSols;
      activities.push(`Rover departed for ${mission.destination}.`);
      break;
    }
    case "resolve-event": {
      const event = state.events.find((item) => item.id === action.eventId && !item.resolved);
      if (!event) throw new Error("That event is no longer awaiting a decision.");
      const choice = event.choices.find((item) => item.id === action.choiceId);
      if (!choice) throw new Error("That event response is not available.");
      for (const [resource, amount] of Object.entries(choice.cost)) {
        if (amount === undefined) continue;
        const key = resource as keyof typeof state.resources;
        if (state.resources[key] < amount) throw new Error(`Insufficient ${resource} for this response.`);
        state.resources[key] -= amount;
      }
      event.resolved = true;
      if (event.code === "solar-alert" && action.choiceId === "observe") state.resources.sciencePoints += 3;
      if (event.code === "dust-storm" && action.choiceId === "shelter") state.resources.radiationRisk = clamp(state.resources.radiationRisk - GAME_ASSUMPTIONS.radiationShelterReduction, 0, 100);
      if (event.code === "filter-fault" && action.choiceId === "repair") {
        const unit = state.buildings.find((item) => item.id === "water-recovery");
        if (unit) unit.condition = clamp(unit.condition + 16, 0, 100);
      }
      activities.push(`Event resolved: ${choice.label}.`);
      break;
    }
  }
}

export function simulateSol(current: GameState): GameState {
  if (current.status !== "active") throw new Error("This campaign has already ended.");
  const state = structuredClone(current);
  const completedActivities: string[] = [];
  const changes: Record<string, number> = {};
  const before = { ...state.resources };

  for (const action of state.pendingActions) applyAction(state, action, completedActivities);

  const solar = state.buildings.find((item) => item.id === "solar");
  const lifeSupport = state.buildings.find((item) => item.id === "life-support");
  const waterUnit = state.buildings.find((item) => item.id === "water-recovery");
  const greenhouse = state.buildings.find((item) => item.id === "greenhouse");
  const shelter = state.buildings.find((item) => item.id === "shelter");
  const habitat = state.buildings.find((item) => item.id === "habitat");
  const garage = state.buildings.find((item) => item.id === "garage");
  const maintenanceCrew = state.crew.filter((member) => member.task === "maintenance").length;
  const biologyCrew = state.crew.filter((member) => member.task === "biology").length;
  const researchCrew = state.crew.filter((member) => member.task === "research").length;
  const roverCrew = state.crew.filter((member) => member.task === "rover").length;
  const weather = randomForSol(state.randomSeed, current.sol);
  const storm = weather < GAME_ASSUMPTIONS.dustStormProbability;
  const enroute = state.rover.some((mission) => mission.status === "enroute");

  // Solar array physics: irradiance × area × panel efficiency × equivalent sun hours.
  const solarCalc = calculateSolarEnergy({
    dustOpticalDepth: storm ? GAME_ASSUMPTIONS.stormDustOpticalDepth : GAME_ASSUMPTIONS.clearDustOpticalDepth,
    arrayAreaM2: GAME_ASSUMPTIONS.solarArrayAreaM2PerLevel * (solar?.level ?? 1),
    efficiency: GAME_ASSUMPTIONS.photovoltaicEfficiency,
    conditionPercent: solar?.condition ?? 100,
    equivalentPeakSunHours: GAME_ASSUMPTIONS.equivalentPeakSunHoursPerSol,
    enabled: solar?.online === true
  });

  const averageLoadKw =
    SIMULATION.fixedPowerKw +
    (lifeSupport?.online ? SIMULATION.lifeSupportPowerKw : 0) +
    (waterUnit?.online ? SIMULATION.waterRecoveryPowerKw : 0) +
    (greenhouse?.online ? SIMULATION.greenhousePowerKw : 0) +
    (habitat?.online ? SIMULATION.thermalControlPowerKw : 0) +
    (garage?.online && enroute ? SIMULATION.roverPowerKw : 0);
  const demandKwh = powerDemandKwh(averageLoadKw);
  const batteryBeforePower = state.resources.batteryKwh;
  const usableStoredEnergyKwh = batteryBeforePower * GAME_ASSUMPTIONS.batteryDischargeEfficiency;
  const powerServiceFraction = demandKwh <= 0 ? 1 : clamp((solarCalc.energyKwh + usableStoredEnergyKwh) / demandKwh, 0, 1);
  const netEnergyKwh = solarCalc.energyKwh - demandKwh;
  const batteryCapacity = 500 * (state.buildings.find((item) => item.id === "battery")?.level ?? 1);
  state.resources.batteryCapacityKwh = batteryCapacity;
  state.resources.batteryKwh = netEnergyKwh >= 0
    ? clamp(batteryBeforePower + netEnergyKwh * GAME_ASSUMPTIONS.batteryChargeEfficiency, 0, batteryCapacity)
    : clamp(batteryBeforePower - Math.min(batteryBeforePower, -netEnergyKwh / GAME_ASSUMPTIONS.batteryDischargeEfficiency), 0, batteryCapacity);
  state.resources.powerBalanceKw = round(netEnergyKwh / SCIENTIFIC_REFERENCE.mars.solLengthHours, 2);

  const environment = calculateEnvironment(state, storm);
  environment.solarIrradianceSurfaceWm2 = round(solarCalc.surfaceIrradianceWm2, 1);
  environment.solarPeakPowerKw = round(solarCalc.peakPowerKw, 2);
  environment.solarEnergyKwh = round(solarCalc.energyKwh, 2);
  environment.energyDemandKwh = round(demandKwh, 2);
  state.environment = environment;

  // Life support: NASA BVAD human metabolic loads plus explicit system assumptions.
  const lifeEfficiency = lifeSupport?.online
    ? clamp((lifeSupport.condition / 100) * (1 + maintenanceCrew * 0.025) * powerServiceFraction, 0, 1)
    : 0;
  const oxygenConsumed = SIMULATION.oxygenKgPerCrewSol * SIMULATION.crew;
  const co2Generated = SIMULATION.carbonDioxideKgPerCrewSol * SIMULATION.crew;
  const potableWater = SIMULATION.potableWaterLitersPerCrewSol * SIMULATION.crew;
  const hygieneLoopWater = SIMULATION.waterHygieneLoopLitersPerCrewSol * SIMULATION.crew;
  const recoverableHygieneWater = waterUnit?.online
    ? hygieneLoopWater * SIMULATION.waterRecoveryFraction * clamp(waterUnit.condition / 100, 0, 1) * powerServiceFraction
    : 0;
  const greenhouseMakeup = greenhouse?.online && powerServiceFraction > 0
    ? SIMULATION.greenhouseWaterMakeupLitersPerSol * powerServiceFraction
    : 0;
  const waterBeforeElectrolysis = Math.max(0, state.resources.waterLiters - potableWater - hygieneLoopWater + recoverableHygieneWater - greenhouseMakeup);
  const oxygenPotential = SIMULATION.oxygenProductionKgPerSol * lifeEfficiency;
  const electrolysisWaterAvailable = waterBeforeElectrolysis / GAME_ASSUMPTIONS.electrolysisWaterKgPerOxygenKg;
  const oxygenProduced = Math.min(oxygenPotential, electrolysisWaterAvailable);
  const electrolysisWater = oxygenProduced * GAME_ASSUMPTIONS.electrolysisWaterKgPerOxygenKg;
  const co2Scrubbed = lifeSupport?.online
    ? Math.min(co2Generated, SIMULATION.co2ScrubKgPerSol * lifeEfficiency)
    : 0;
  state.resources.oxygenKg = clamp(state.resources.oxygenKg + oxygenProduced - oxygenConsumed, 0, state.resources.oxygenCapacityKg);
  state.resources.carbonDioxideKg = clamp(state.resources.carbonDioxideKg + co2Generated - co2Scrubbed, 0, 100);
  state.resources.waterLiters = clamp(waterBeforeElectrolysis - electrolysisWater, 0, state.resources.waterCapacityLiters);

  // Cabin pressure follows the ideal-gas mass balance for O₂ and CO₂ in a fixed volume.
  const pressureDelta = cabinPressureDeltaKpa({
    oxygenAddedKg: oxygenProduced,
    oxygenRemovedKg: oxygenConsumed,
    carbonDioxideAddedKg: co2Generated,
    carbonDioxideRemovedKg: co2Scrubbed,
    cabinTemperatureC: state.resources.temperatureC,
    cabinVolumeM3: GAME_ASSUMPTIONS.habitatVolumeM3
  });
  state.resources.cabinPressureKpa = clamp(state.resources.cabinPressureKpa + pressureDelta, 0, 120);

  // Mature lettuce crop: NASA BVAD dry edible biomass productivity per m²-day.
  const grown = greenhouse?.online && state.resources.waterLiters > 0
    ? lettuceDryHarvestKg({
      greenhouseAreaM2: SIMULATION.greenhouseAreaM2,
      conditionPercent: greenhouse.condition,
      biologyStaff: biologyCrew,
      powerFraction: powerServiceFraction
    })
    : 0;
  const foodConsumed = SIMULATION.foodDryKgPerCrewSol * SIMULATION.crew;
  state.resources.foodKg = clamp(state.resources.foodKg + grown - foodConsumed, 0, state.resources.foodCapacityKg);
  if (grown > 0) completedActivities.push(`Greenhouse harvested ${grown.toFixed(2)} kg dry edible lettuce biomass.`);

  // One-node thermal balance. Outside temperature and insulation properties are scenario inputs.
  const heaterPower = habitat?.online ? SIMULATION.thermalControlPowerKw * powerServiceFraction : 0;
  state.resources.temperatureC = clamp(nextCabinTemperatureC({
    currentC: state.resources.temperatureC,
    outsideC: GAME_ASSUMPTIONS.outsideTemperatureC,
    heaterPowerKw: heaterPower
  }), -80, 45);

  // The radiation-risk value is intentionally ordinal, not physical dosimetry.
  state.resources.radiationRisk = clamp(
    state.resources.radiationRisk + GAME_ASSUMPTIONS.radiationRiskDailyIncrease + (storm ? GAME_ASSUMPTIONS.radiationRiskStormIncrease : 0) -
      (shelter?.online ? GAME_ASSUMPTIONS.radiationShelterReduction * (shelter.condition / 100) : 0),
    0,
    100
  );
  if (researchCrew > 0) state.resources.sciencePoints += 1.5 * researchCrew;

  for (const member of state.crew) {
    const stability = state.resources.oxygenKg > 50 && state.resources.waterLiters > 150 && state.resources.foodKg > 100 &&
      state.resources.cabinPressureKpa > 85 && state.resources.temperatureC > 5 && state.resources.carbonDioxideKg < 25;
    member.condition = clamp(member.condition + (stability ? 0.25 : -2), 0, 100);
  }

  const roverMission = state.rover.find((mission) => mission.status === "enroute");
  if (roverMission) {
    roverMission.solsRemaining = Math.max(0, roverMission.solsRemaining - 1);
    if (roverMission.solsRemaining === 0) {
      roverMission.status = "complete";
      state.resources.sciencePoints += roverMission.reward + roverCrew * 2;
      state.objectives.rover = true;
      completedActivities.push(`${roverMission.title} returned with ${roverMission.reward} science points.`);
    }
  }

  const pressureFailure = state.resources.cabinPressureKpa < SIMULATION.failure.cabinPressureKpa;
  const crewFailure = state.crew.some((member) => member.condition < SIMULATION.failure.crewCondition);
  const failure =
    state.resources.oxygenKg < SIMULATION.failure.oxygenKg ||
    state.resources.carbonDioxideKg > SIMULATION.failure.carbonDioxideKg ||
    state.resources.waterLiters < SIMULATION.failure.waterLiters ||
    state.resources.foodKg < SIMULATION.failure.foodKg ||
    state.resources.batteryKwh < SIMULATION.failure.batteryKwh ||
    pressureFailure || crewFailure;
  const nextSol = current.sol + 1;
  const campaignEnds = current.sol >= current.totalSols;
  const scienceComplete = state.resources.sciencePoints >= SIMULATION.minVictoryScience;
  state.objectives.science = scienceComplete;
  state.objectives.survive = !failure && campaignEnds;

  const newEvent = failure ? null : makeEvent(state, nextSol);
  if (newEvent) state.events.push(newEvent);
  for (const key of Object.keys(before) as Array<keyof typeof before>) {
    if (typeof before[key] === "number") changes[key] = round(state.resources[key] - before[key], 2);
  }
  const won = campaignEnds && !failure && scienceComplete && state.objectives.rover;
  state.status = failure ? "lost" : won ? "won" : "active";
  state.phase = failure || won ? "debrief" : "game";
  state.sol = nextSol;
  state.pendingActions = [];

  const report: TurnReport = {
    sol: current.sol,
    summary: failure
      ? "Critical life-support or environmental conditions ended the campaign."
      : won
        ? "The outpost completed its 15-Sol campaign and science objectives."
        : "The crew completed the Sol and continues the campaign.",
    changes,
    completedActivities,
    eventTitle: newEvent?.title ?? null
  };
  state.lastReport = report;
  state.history.push(report);
  state.stateVersion = current.stateVersion + 1;
  return state;
}
