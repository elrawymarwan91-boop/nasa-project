# Outpost Commander — Vehicle cockpit playtest

## Start the campaign
1. Run `START_OUTPOST_COMMANDER.bat`, or follow the setup steps in `README.md`.
2. Open `http://localhost:5173`.
3. Select **Start new campaign**, then **Enter the outpost**.
4. The campaign remains turn-based: orders are submitted to the backend and resolve when you advance a Sol.

## Switch workspaces
Use the top navigation:
- **OUTPOST** — base, facilities, crew, events, research and campaign operations.
- **SPACECRAFT** — first-person mission-systems cockpit with Flight Deck, Navigation, Life Support, Electrical and Communications modules.
- **ROVER** — surface cockpit with Driving, Terrain Map, Science Tools, Vehicle Health and Mission Log modules.

## Test the spacecraft cockpit
1. Open **SPACECRAFT**.
2. Move through each left-side module.
3. Verify oxygen, water, battery, cabin pressure, temperature and power balance match the resource strip and outpost view.
4. Expand the pre-operation checklist.
5. Return to Outpost and advance a Sol; verify the displayed readings update.

**Scope note:** the spacecraft cockpit is a functional mission-systems interface connected to the shared campaign state. Orbital mechanics, propulsion, attitude control and independent spacecraft flight physics are not implemented in this build. Navigation is a schematic mission display, not a trajectory solver.

## Test the Mars rover cockpit
1. Open **ROVER**.
2. Inspect the Driving module and available sorties.
3. Select a route such as Gale Ridge Survey, Dune Traverse or Basalt Sampling.
4. Confirm the garage is online and the sortie requirements are available (24 kWh and 8 kg provisions in the current game rules).
5. Select **QUEUE EXPLORATION SORTIE**.
6. Return to Outpost and advance the Sol. The action is sent to the existing backend; travel resolves through the turn-based simulation.
7. Return to Rover and inspect Mission Log / status updates.

**Scope note:** the rover view is an interactive cockpit and mission-command interface, not continuous real-time driving. Steering dynamics, wheel traction, suspension, obstacle collision and a georeferenced Gale map are not implemented yet.

## Visual design
The UI now uses a graphite / mineral-green / warm-ceramic palette with muted brass warnings. The palette is deliberately different from the previous orange-brown interface and avoids the generic purple/blue AI-dashboard style. The Martian terrain retains natural muted sandstone tones.

## Data honesty
Vehicle readouts use the current campaign simulation values. The app does not connect to a live NASA telemetry feed. Environmental values are a mixture of published reference constants and explicitly documented game assumptions.
