/**
 * Simulation configuration.
 * Values marked NASA_REFERENCE are quoted from NASA reference publications.
 * Values marked GAME_ASSUMPTION are scenario inputs chosen for playability and
 * must not be represented as flight-hardware specifications or observations.
 */
export const SCIENTIFIC_REFERENCE = {
  mars: {
    gravityMps2: 3.73,
    meanSolarIrradianceWm2: 586.2,
    solLengthHours: 24.6597,
    classification: "NASA_REFERENCE"
  },
  crew: {
    oxygenConsumptionKgPerCrewSol: 0.895,
    carbonDioxideGenerationKgPerCrewSol: 1.085,
    foodDrySolidsKgPerCrewSol: 0.8,
    potableWaterKgPerCrewSol: 3.217,
    classification: "NASA_BVAD_REFERENCE"
  },
  lettuce: {
    edibleDryBiomassKgPerM2Sol: 0.00657,
    edibleFreshBiomassKgPerM2Sol: 0.13135,
    growthPeriodDays: 28,
    classification: "NASA_BVAD_REFERENCE"
  }
} as const;

export const GAME_ASSUMPTIONS = {
  // NASA material describes optical depth around 0.5 for relatively clear
  // conditions and values around 2–4 during dust storms. These are scenario
  // selections within that published range, not a Gale weather forecast.
  clearDustOpticalDepth: 0.5,
  stormDustOpticalDepth: 3.0,
  dustStormProbability: 0.16,
  equivalentPeakSunHoursPerSol: 6.5,
  solarArrayAreaM2PerLevel: 250,
  photovoltaicEfficiency: 0.22,
  outsideTemperatureC: -60,
  habitatVolumeM3: 150,
  habitatThermalMassKwhPerC: 120,
  habitatThermalConductanceKwPerC: 0.015,
  potableHygieneLoopLitersPerCrewSol: 8,
  hygieneWaterRecoveryFraction: 0.8,
  greenhouseAreaM2: 60,
  greenhouseWaterMakeupLitersPerSol: 6.3,
  electrolysisWaterKgPerOxygenKg: 18 / 16,
  electrolysisEnergyKwhPerOxygenKg: 5,
  batteryChargeEfficiency: 0.92,
  batteryDischargeEfficiency: 0.92,
  // The radiation score is an ordinal classroom/gameplay indicator. It is
  // deliberately not mSv, dose, or a prediction of astronaut exposure.
  radiationRiskStormIncrease: 12,
  radiationRiskDailyIncrease: 3,
  radiationShelterReduction: 8
} as const;

const NOMINAL_OXYGEN_PRODUCTION_KG_PER_SOL = 3.8;
const LIFE_SUPPORT_AUXILIARY_POWER_KW = 0.13;

export const SIMULATION = {
  crew: 4,
  // NASA BVAD Rev 2 nominal human interface values (kg per crewmember-day).
  oxygenKgPerCrewSol: SCIENTIFIC_REFERENCE.crew.oxygenConsumptionKgPerCrewSol,
  carbonDioxideKgPerCrewSol: SCIENTIFIC_REFERENCE.crew.carbonDioxideGenerationKgPerCrewSol,
  foodDryKgPerCrewSol: SCIENTIFIC_REFERENCE.crew.foodDrySolidsKgPerCrewSol,
  potableWaterLitersPerCrewSol: SCIENTIFIC_REFERENCE.crew.potableWaterKgPerCrewSol,
  // The following throughput and equipment ratings are game assumptions.
  waterHygieneLoopLitersPerCrewSol: GAME_ASSUMPTIONS.potableHygieneLoopLitersPerCrewSol,
  waterRecoveryFraction: GAME_ASSUMPTIONS.hygieneWaterRecoveryFraction,
  greenhouseWaterMakeupLitersPerSol: GAME_ASSUMPTIONS.greenhouseWaterMakeupLitersPerSol,
  greenhouseAreaM2: GAME_ASSUMPTIONS.greenhouseAreaM2,
  oxygenProductionKgPerSol: NOMINAL_OXYGEN_PRODUCTION_KG_PER_SOL,
  co2ScrubKgPerSol: 4.8,
  // Power ratings are average continuous kW over a Martian Sol.
  fixedPowerKw: 1.0,
  // Electrolyzer energy is explicitly included in the life-support average load.
  // The small auxiliary allowance is an equipment-level game assumption.
  lifeSupportPowerKw: (NOMINAL_OXYGEN_PRODUCTION_KG_PER_SOL * GAME_ASSUMPTIONS.electrolysisEnergyKwhPerOxygenKg) / SCIENTIFIC_REFERENCE.mars.solLengthHours + LIFE_SUPPORT_AUXILIARY_POWER_KW,
  waterRecoveryPowerKw: 0.5,
  greenhousePowerKw: 0.7,
  thermalControlPowerKw: 1.0,
  roverPowerKw: 0.35,
  roverDurationSols: 2,
  upgradeCost: { waterLiters: 90, batteryKwh: 45, sciencePoints: 4 },
  roverCost: { batteryKwh: 24, foodKg: 8 },
  minVictoryScience: 20,
  failure: {
    oxygenKg: 28,
    carbonDioxideKg: 48,
    waterLiters: 80,
    foodKg: 40,
    batteryKwh: 8,
    cabinPressureKpa: 72,
    crewCondition: 10
  }
} as const;
