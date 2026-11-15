import Phaser from "phaser";
import type { Building, BuildingId, RoverMission } from "../../shared/game";

type SceneState = {
  buildings: Building[];
  rover: RoverMission[];
  selectedId: BuildingId;
  onSelect: (id: BuildingId) => void;
};

const colors: Record<BuildingId, number> = {
  habitat: 0x8ea99b,
  solar: 0x6c9691,
  battery: 0x758a83,
  "life-support": 0x78a995,
  "water-recovery": 0x759fa0,
  greenhouse: 0x91a978,
  shelter: 0x9d9878,
  garage: 0x7e9690
};

export class OutpostScene extends Phaser.Scene {
  private worldGraphics!: Phaser.GameObjects.Graphics;
  private hoverGraphics!: Phaser.GameObjects.Graphics;
  private overlayObjects: Phaser.GameObjects.GameObject[] = [];
  private state: SceneState;
  private dragPointerId: number | null = null;
  private dragOrigin = { x: 0, y: 0, scrollX: 0, scrollY: 0 };

  constructor(initialState: SceneState) {
    super({ key: "OutpostScene" });
    this.state = initialState;
  }

  create() {
    this.cameras.main.setBackgroundColor("#77806d");
    // Prevent the browser context menu from interrupting right-button camera panning.
    this.game.canvas.oncontextmenu = (event) => event.preventDefault();
    this.cameras.main.setBounds(0, 0, 1400, 960);
    this.worldGraphics = this.add.graphics();
    this.hoverGraphics = this.add.graphics().setDepth(2500);
    this.drawWorld();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        this.dragPointerId = pointer.id;
        this.dragOrigin = {
          x: pointer.x,
          y: pointer.y,
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY
        };
      }
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.dragPointerId) this.dragPointerId = null;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.dragPointerId || !pointer.isDown) return;
      this.cameras.main.scrollX = this.dragOrigin.scrollX - (pointer.x - this.dragOrigin.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY = this.dragOrigin.scrollY - (pointer.y - this.dragOrigin.y) / this.cameras.main.zoom;
    });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.58, 1.45));
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const step = 38 / this.cameras.main.zoom;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") this.cameras.main.scrollX -= step;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") this.cameras.main.scrollX += step;
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") this.cameras.main.scrollY -= step;
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") this.cameras.main.scrollY += step;
    });
    this.cameras.main.centerOn(700, 470);
  }

  updateState(state: SceneState) {
    this.state = state;
    if (this.worldGraphics) this.drawWorld();
  }

  zoomBy(delta: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom + delta, 0.58, 1.45));
  }

  resetCamera() {
    this.cameras.main.setZoom(0.92);
    this.cameras.main.centerOn(700, 470);
  }

  private pointForGrid(x: number, y: number) {
    return { x: 700 + (x - y) * 78, y: 130 + (x + y) * 43 };
  }

  private diamond(x: number, y: number, rx: number, ry: number) {
    return [
      new Phaser.Math.Vector2(x, y - ry),
      new Phaser.Math.Vector2(x + rx, y),
      new Phaser.Math.Vector2(x, y + ry),
      new Phaser.Math.Vector2(x - rx, y)
    ];
  }

  private drawWorld() {
    this.overlayObjects.forEach((object) => object.destroy());
    this.overlayObjects = [];
    this.worldGraphics.clear();
    this.hoverGraphics?.clear();
    this.worldGraphics.fillStyle(0x85816b, 1);
    this.worldGraphics.fillRect(0, 0, 1400, 960);
    this.worldGraphics.fillStyle(0xa4a181, 0.26);
    this.worldGraphics.fillCircle(250, 230, 160);
    this.worldGraphics.fillStyle(0x5b6856, 0.23);
    this.worldGraphics.fillCircle(1120, 655, 230);

    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const { x: px, y: py } = this.pointForGrid(x, y);
        const variation = ((x * 17 + y * 31) % 4) * 0.025;
        this.worldGraphics.fillStyle(0xb4aa86, 0.38 + variation);
        this.worldGraphics.fillPoints(this.diamond(px, py, 77, 43), true);
        this.worldGraphics.lineStyle(1, 0xe2dfbe, 0.18);
        this.worldGraphics.strokePoints(this.diamond(px, py, 77, 43), true);
      }
    }

    const rocks = [
      [255, 430, 20], [368, 253, 14], [1058, 316, 22], [1136, 480, 12],
      [940, 720, 19], [474, 752, 14], [225, 637, 11], [871, 205, 10]
    ];
    for (const [x, y, radius] of rocks) {
      this.worldGraphics.fillStyle(0x62624e, 0.88);
      this.worldGraphics.fillEllipse(x, y, radius * 2.2, radius);
      this.worldGraphics.fillStyle(0xc0ae85, 0.7);
      this.worldGraphics.fillEllipse(x - radius * 0.25, y - radius * 0.25, radius * 1.25, radius * 0.42);
    }

    // Draw farther isometric rows first so nearer structures visually overlap them.
    const depthSortedBuildings = [...this.state.buildings].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const building of depthSortedBuildings) {
      const { x: cx, y: cy } = this.pointForGrid(building.x, building.y);
      const selected = this.state.selectedId === building.id;
      const body = building.online ? colors[building.id] : 0x50545a;
      this.worldGraphics.fillStyle(0x3a4538, 0.38);
      this.worldGraphics.fillEllipse(cx + 5, cy + 14, 110, 30);
      if (selected) {
        this.worldGraphics.fillStyle(0x8ce0c5, 0.22);
        this.worldGraphics.fillPoints(this.diamond(cx, cy + 3, 73, 41), true);
        this.worldGraphics.lineStyle(2, 0xc8f2dc, 0.96);
        this.worldGraphics.strokePoints(this.diamond(cx, cy + 3, 73, 41), true);
      } else {
        this.worldGraphics.lineStyle(1, 0x4b6555, 0.65);
        this.worldGraphics.strokePoints(this.diamond(cx, cy + 3, 68, 38), true);
      }

      const width = building.id === "solar" ? 62 : 54;
      const height = building.id === "solar" ? 30 : 36;
      const roof = [
        new Phaser.Math.Vector2(cx - width / 2, cy - height / 2),
        new Phaser.Math.Vector2(cx, cy - height / 2 - 18),
        new Phaser.Math.Vector2(cx + width / 2, cy - height / 2),
        new Phaser.Math.Vector2(cx, cy - height / 2 + 18)
      ];
      this.worldGraphics.fillStyle(body, 1);
      this.worldGraphics.fillPoints(roof, true);
      this.worldGraphics.lineStyle(2, building.online ? 0xc8e5ce : 0x8c9890, 0.78);
      this.worldGraphics.strokePoints(roof, true);
      this.worldGraphics.fillStyle(0x657464, 1);
      this.worldGraphics.fillPoints([
        new Phaser.Math.Vector2(cx - width / 2, cy - height / 2),
        new Phaser.Math.Vector2(cx, cy - height / 2 + 18),
        new Phaser.Math.Vector2(cx, cy + height / 2 + 18),
        new Phaser.Math.Vector2(cx - width / 2, cy + height / 2)
      ], true);
      this.worldGraphics.fillStyle(0x82907b, 1);
      this.worldGraphics.fillPoints([
        new Phaser.Math.Vector2(cx + width / 2, cy - height / 2),
        new Phaser.Math.Vector2(cx, cy - height / 2 + 18),
        new Phaser.Math.Vector2(cx, cy + height / 2 + 18),
        new Phaser.Math.Vector2(cx + width / 2, cy + height / 2)
      ], true);
      if (building.id === "solar") {
        this.worldGraphics.fillStyle(0x345e5a, 0.95);
        this.worldGraphics.fillPoints(this.diamond(cx, cy - 25, 38, 12), true);
        this.worldGraphics.lineStyle(1, 0xa5e1cd, 0.8);
        this.worldGraphics.strokePoints(this.diamond(cx, cy - 25, 38, 12), true);
      } else {
        this.worldGraphics.fillStyle(building.online ? 0xd8d09a : 0x777f75, 0.9);
        this.worldGraphics.fillCircle(cx, cy - 19, 3.5);
      }
      this.worldGraphics.fillStyle(building.online ? 0x8bd4a5 : 0xd0a36f, 1);
      this.worldGraphics.fillCircle(cx + 39, cy - 1, 3);

      const zone = this.add.zone(cx, cy, 132, 84).setInteractive({ useHandCursor: true });
      zone.setDepth(cy + 60);
      this.overlayObjects.push(zone);
      zone.on("pointerover", () => {
        this.game.canvas.classList.add("world-hover");
        this.hoverGraphics.clear();
        this.hoverGraphics.fillStyle(0xa8e8cb, 0.18);
        this.hoverGraphics.fillPoints(this.diamond(cx, cy + 3, 73, 41), true);
        this.hoverGraphics.lineStyle(2, 0xc1f0d8, 0.9);
        this.hoverGraphics.strokePoints(this.diamond(cx, cy + 3, 73, 41), true);
      });
      zone.on("pointerout", () => {
        this.game.canvas.classList.remove("world-hover");
        this.hoverGraphics.clear();
      });
      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.state.onSelect(building.id);
      });
      const label = this.add.text(cx, cy + 40, building.name.toUpperCase(), {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: "9px",
        color: selected ? "#f1fff3" : "#e5ebd9",
        stroke: "#304239",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(cy + 70);
      this.overlayObjects.push(label);
    }

    this.drawCrew(621, 512, 0xa4dec1);
    this.drawCrew(775, 384, 0xaddccb);
    const mission = this.state.rover.find((item) => item.status === "enroute");
    if (mission) {
      this.worldGraphics.fillStyle(0x273b3e, 1);
      this.worldGraphics.fillEllipse(793, 533, 38, 17);
      this.worldGraphics.fillStyle(0xe4c28d, 1);
      this.worldGraphics.fillRoundedRect(777, 520, 31, 12, 4);
      this.worldGraphics.fillStyle(0x26373d, 1);
      this.worldGraphics.fillCircle(781, 535, 5);
      this.worldGraphics.fillCircle(802, 535, 5);
    }

    const mapLabel = this.add.text(700, 30, "GALE CRATER  /  FICTIONAL OUTPOST MAP", {
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: "11px",
      color: "#e8f0d9",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(2000);
    this.overlayObjects.push(mapLabel);
  }

  private drawCrew(x: number, y: number, color: number) {
    this.worldGraphics.fillStyle(0x38493e, 0.7);
    this.worldGraphics.fillEllipse(x, y + 9, 15, 7);
    this.worldGraphics.fillStyle(color, 1);
    this.worldGraphics.fillCircle(x, y - 3, 5);
    this.worldGraphics.fillRoundedRect(x - 4, y, 8, 12, 3);
  }
}
