import { GAME_ASSUMPTIONS, SCIENTIFIC_REFERENCE } from "./config.js";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type SolarCalculation = {
  surfaceIrradianceWm2: number;
  peakPowerKw: number;
  energyKwh: number;
};

/**
 * Approximate direct-beam dust attenuation using Beer–Lambert transmission.
 * Peak-sun-hours fold solar angle/daylight geometry into one explicit
 * GAME_ASSUMPTION. This is a teaching model, not a site-specific forecast.
 */
export function calculateSolarEnergy(input: {
  dustOpticalDepth: number;
  arrayAreaM2: number;
  efficiency: number;
  equivalentPeakSunHours: number;
  enabled: boolean;
  conditionPercent?: number;
}): SolarCalculation {
  const tau = clamp(input.dustOpticalDepth, 0, 8);
  const panelCondition = clamp((input.conditionPercent ?? 100) / 100, 0, 1);
  const efficiency = clamp(input.efficiency, 0, 1) * panelCondition;
  const surfaceIrradianceWm2 = SCIENTIFIC_REFERENCE.mars.meanSolarIrradianceWm2 * Math.exp(-tau);
  const peakPowerKw = input.enabled
    ? surfaceIrradianceWm2 * Math.max(0, input.arrayAreaM2) * efficiency / 1000
    : 0;
  return {
    surfaceIrradianceWm2,
    peakPowerKw,
    energyKwh: peakPowerKw * Math.max(0, input.equivalentPeakSunHours)
  };
}

/** Average continuous loads (kW) converted to energy over one Martian Sol (kWh). */
export function powerDemandKwh(averageLoadKw: number): number {
  return Math.max(0, averageLoadKw) * SCIENTIFIC_REFERENCE.mars.solLengthHours;
}

/**
 * Ideal-gas pressure change from net O2 and CO2 mass flows into a fixed-volume
 * cabin. Mass inputs are kg; molar masses are kg/kmol; gas constant is
 * kPa·m³/(kmol·K). It is a simplified two-gas balance (other gases are fixed).
 */
export function cabinPressureDeltaKpa(input: {
  oxygenAddedKg: number;
  oxygenRemovedKg: number;
  carbonDioxideAddedKg: number;
  carbonDioxideRemovedKg: number;
  cabinTemperatureC: number;
  cabinVolumeM3?: number;
}): number {
  const oxygenDeltaKmol = (input.oxygenAddedKg - input.oxygenRemovedKg) / 32;
  const carbonDioxideDeltaKmol = (input.carbonDioxideAddedKg - input.carbonDioxideRemovedKg) / 44;
  const temperatureK = Math.max(150, input.cabinTemperatureC + 273.15);
  const volumeM3 = input.cabinVolumeM3 ?? GAME_ASSUMPTIONS.habitatVolumeM3;
  const gasConstant = 8.314462618;
  return (oxygenDeltaKmol + carbonDioxideDeltaKmol) * gasConstant * temperatureK / volumeM3;
}

/** Single-node cabin thermal balance: heater energy minus conductive heat loss. */
export function nextCabinTemperatureC(input: {
  currentC: number;
  outsideC: number;
  heaterPowerKw: number;
  solHours?: number;
}): number {
  const solHours = input.solHours ?? SCIENTIFIC_REFERENCE.mars.solLengthHours;
  const temperatureDifference = input.currentC - input.outsideC;
  const heatLossKwh = GAME_ASSUMPTIONS.habitatThermalConductanceKwPerC * temperatureDifference * solHours;
  const heatInputKwh = Math.max(0, input.heaterPowerKw) * solHours;
  return input.currentC + (heatInputKwh - heatLossKwh) / GAME_ASSUMPTIONS.habitatThermalMassKwhPerC;
}

/** Mature lettuce dry edible biomass estimate from BVAD Table 4-90. */
export function lettuceDryHarvestKg(input: {
  greenhouseAreaM2: number;
  conditionPercent: number;
  biologyStaff: number;
  powerFraction: number;
}): number {
  const staffFactor = Math.min(1.5, Math.max(0, input.biologyStaff));
  const condition = clamp(input.conditionPercent / 100, 0, 1);
  const power = clamp(input.powerFraction, 0, 1);
  const dryKgPerM2Sol = SCIENTIFIC_REFERENCE.lettuce.edibleDryBiomassKgPerM2Sol;
  return dryKgPerM2Sol * Math.max(0, input.greenhouseAreaM2) * condition * staffFactor * power;
}
