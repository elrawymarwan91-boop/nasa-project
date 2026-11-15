# Vehicle cockpit interface design

## Shared workspace navigation
The active campaign now exposes three workspaces: Outpost, Spacecraft and Rover. All three use the same `GameState` returned by the backend. Switching workspace does not create a second copy of resources or advance the campaign.

## Spacecraft cockpit
Modules:
- Flight Deck: campaign phase and headline environmental-system readouts.
- Navigation: schematic mission route and Mars reference values.
- Life Support: oxygen, water, cabin pressure, carbon dioxide and cabin temperature.
- Electrical: stored energy, capacity, power balance and solar-array state.
- Communications: local guest-session link and campaign synchronization status.

Scope boundary: the spacecraft cockpit is currently a mission-systems interface linked to outpost telemetry. It does not simulate orbit propagation, propulsion, attitude dynamics, docking, real radio delay or a separate spacecraft resource state.

## Mars rover cockpit
Modules:
- Driving: vehicle readiness and available survey sorties.
- Terrain Map: Gale-inspired schematic with selectable destination cards.
- Science Tools: explanatory panels for represented instruments.
- Vehicle Health: garage, battery, provisions and dust scenario checks.
- Mission Log: available, en-route and completed rover tasks.

The selected sortie is submitted through the existing `send-rover` backend action. The backend validates the garage and required reserves; the turn-based simulation updates travel progress when the player advances a Sol.

Scope boundary: this is not continuous real-time driving. Wheel traction, suspension, steering physics, collision, autonomous navigation and a georeferenced Gale map are not implemented.

## Visual language
- Primary surfaces: graphite and deep mineral green.
- Main highlight: mineral teal / pale jade.
- Secondary instrumentation: warm ceramic and muted brass.
- Status: sage green for nominal, brass for caution, muted coral for critical warnings.
- Martian terrain retains subdued sandstone and sage colors; the user-interface panels no longer use the prior dominant rust-brown palette.

The windscreen viewport uses original CSS scene artwork. The cockpit is a NASA-inspired fictional interface, not an exact replica of any NASA crew vehicle.
