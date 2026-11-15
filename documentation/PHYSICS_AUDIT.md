# Physics & data implementation audit

## Implemented in the server simulation

| System | Implemented relationship | Reference/input classification | Limitations |
|---|---|---|---|
| Mars gravity and Sol | 3.73 m/s²; 24.6597 h/Sol | NASA/NSSDC reference | Gravity is currently displayed as context; no vehicle/structural dynamics use it. |
| Solar irradiance | I_surface = I_TOA × exp(-τ) | NASA planetary reference + scenario τ | Simplified direct-beam attenuation; no full radiative-transfer or diffuse model. |
| PV power/energy | P = I × A × η × condition; E = P × peak-sun-hours | Explicit game assumptions for A, η, condition and hours | No detailed Sun-angle, temperature coefficient, dust deposition or array tracking. |
| Electrical demand | E = average kW × Sol hours | Unit-consistent model; loads are game assumptions | One daily accounting interval, not hourly dispatch. |
| Battery | kWh storage with charge/discharge efficiencies and capacity bounds | Game assumptions | No voltage, current, SOC curve, thermal effects, aging or degradation model. |
| O₂ / CO₂ / food / potable water | Per-person baseline loads from BVAD Rev. 2 Table 3-31 | NASA BVAD reference | Not a complete human metabolic/mass balance. |
| Electrolysis water | 18/16 kg water per kg oxygen | Chemical stoichiometry | Electrolyzer hardware efficiency and power rating are game assumptions. |
| Cabin pressure | Ideal gas law for O₂ and CO₂ mole changes | Fundamental physics + fixed-volume scenario | Other gases held constant; no leaks or pressure controller. |
| Lettuce output | 6.57 g dry edible biomass/m²/day × area and scenario factors | NASA BVAD Rev. 2 Table 4-90 | Mature crop steady-harvest approximation; no 28-day growth-cycle simulation. |
| Cabin temperature | Single-node thermal energy balance | First-principles structure + assumed parameters | No geometry/material-specific thermal model or latent heat. |
| Radiation indicator | Ordinal 0–100 score | Game assumption | Not dose, mSv, measured Mars dose rate or shielding simulation. |

## Corrections made in this update

- Converted electrical energy demand using `kW × hours per Sol = kWh per Sol`; battery inventory is retained in kWh.
- Solar output now responds to the solar-array building's condition as well as its on/off state and the dust scenario.
- Exposed planetary constants and assumptions separately via `GET /api/v1/data/physics-constants`.
- Kept `/api/v1/data/observations` empty and explicit because no raw time-series observations have been downloaded; reference constants are not mislabeled as observations.
- Added validation to prevent duplicate/conflicting queued building toggles and rover dispatches when the Rover Garage is queued offline.
- Added backward-compatible state parsing for existing guest saves without the newer environment telemetry fields.
- Added tests for unit conversions, attenuation, array condition, pressure response, BVAD crop yield, physics constants, and command validation.

## Not yet implemented / not claimed

- No live ingestion or local time-series from REMS, RAD, DONKI, OSDR, Mars Trek or CSA.
- No absolute crew radiation dosimetry, shielding-transport calculation or medical simulation.
- No full 3D/CFD thermal, habitat atmosphere or ECLSS mass-flow simulation.
- No free-placement construction system with backend construction actions. The current colony begins with its eight core buildings and supports operating them and upgrading them.
- No calibrated Gale Crater weather forecast.

## Validation status

The tests added in this update are included in the project. A production build and test run still need to be executed in an environment where the locked npm packages can be installed. In this runtime, package-registry requests timed out with DNS `EAI_AGAIN`, so a fresh Linux dependency install could not be completed. Do not treat the build as verified until `npm ci`, `npm run build`, and `npm test` pass on the target machine.
