"use client";

import { useEffect, useRef } from "react";

export interface BattleStageProps {
  pAttack: boolean;
  cAttack: boolean;
  pHit:    boolean;
  cHit:    boolean;
  pWinning: boolean;
  clashing: boolean;
  strategyName: string;
}

/* ── Stage constants ─────────────────────────────────────────────── */
const W = 600, H = 320;

// LuizMelo Hero Knight 2 — each animation is a separate PNG, 140×140 px per frame
const FRAME_W  = 140;
const FRAME_H  = 140;
const ANIMS = {
  idle:   { key: "knight-idle",   file: "/sprites/knight/Idle.png",     frames: 11, rate: 10, repeat: -1 },
  attack: { key: "knight-attack", file: "/sprites/knight/Attack.png",   frames: 6,  rate: 14, repeat:  0 },
  hit:    { key: "knight-hit",    file: "/sprites/knight/Take Hit.png", frames: 4,  rate: 12, repeat:  0 },
  death:  { key: "knight-death",  file: "/sprites/knight/Death.png",    frames: 9,  rate: 10, repeat:  0 },
} as const;

const FLOOR_Y      = H - 10;
const KNIGHT_SCALE = 2.2;           // ~308 px tall in a 320 px stage
const P_X = W * 0.22;
const C_X = W * 0.78;

/* ── BattleStage ─────────────────────────────────────────────────── */
export function BattleStage(props: BattleStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(props);
  stateRef.current = props;

  useEffect(() => {
    if (!mountRef.current) return;
    let game: any = null;
    let cancelled = false;

    import("phaser").then((mod) => {
      if (cancelled || !mountRef.current) return;
      const Phaser = mod.default;

      const prev = {
        pAttack: false, cAttack: false,
        pHit: false,    cHit: false,
        clashing: false,
      };

      class BattleScene extends Phaser.Scene {
        p!: Phaser.GameObjects.Sprite;
        c!: Phaser.GameObjects.Sprite;
        emitter!: any;

        constructor() { super("Battle"); }

        preload() {
          // Spark particle texture
          const g = this.make.graphics({ x: 0, y: 0 } as any);
          g.fillStyle(0xffffff); g.fillCircle(4, 4, 4);
          g.generateTexture("spark", 8, 8); g.destroy();

          // Knight sprite sheets
          for (const a of Object.values(ANIMS)) {
            this.load.spritesheet(a.key, a.file, { frameWidth: FRAME_W, frameHeight: FRAME_H });
          }

          // Graceful fallback: if sprites are missing Phaser shows placeholder — no crash
          this.load.on("loaderror", (file: any) => {
            console.warn("[BattleStage] sprite not found:", file.src,
              "\n→ Download from https://luizmelo.itch.io/hero-knight-2",
              "\n→ Place PNGs in frontend/public/sprites/knight/");
          });
        }

        create() {
          /* Floor */
          const floor = this.add.graphics();
          floor.lineStyle(1, 0xffffff, 0.07);
          floor.beginPath(); floor.moveTo(0, FLOOR_Y); floor.lineTo(W, FLOOR_Y); floor.strokePath();

          /* Animations */
          for (const a of Object.values(ANIMS)) {
            if (!this.anims.exists(a.key)) {
              this.anims.create({
                key: a.key,
                frames: this.anims.generateFrameNumbers(a.key, { start: 0, end: a.frames - 1 }),
                frameRate: a.rate,
                repeat: a.repeat,
              });
            }
          }

          /* Player knight — blue tint, faces right */
          this.p = this.add.sprite(P_X, FLOOR_Y, ANIMS.idle.key)
            .setOrigin(0.5, 1)
            .setScale(KNIGHT_SCALE)
            .setTint(0x88ddff);
          this.p.play(ANIMS.idle.key);
          this.p.on("animationcomplete", (anim: any) => {
            if ((anim.key === ANIMS.attack.key && !stateRef.current.pAttack) ||
                (anim.key === ANIMS.hit.key    && !stateRef.current.pHit)) {
              this.p.play(ANIMS.idle.key);
            }
          });

          /* CPU knight — red tint, mirrored */
          this.c = this.add.sprite(C_X, FLOOR_Y, ANIMS.idle.key)
            .setOrigin(0.5, 1)
            .setScale(KNIGHT_SCALE)
            .setFlipX(true)
            .setTint(0xff8877);
          this.c.play(ANIMS.idle.key);
          this.c.on("animationcomplete", (anim: any) => {
            if ((anim.key === ANIMS.attack.key && !stateRef.current.cAttack) ||
                (anim.key === ANIMS.hit.key    && !stateRef.current.cHit)) {
              this.c.play(ANIMS.idle.key);
            }
          });

          /* Particles */
          this.emitter = this.add.particles(0, 0, "spark", {
            speed:    { min: 80,  max: 320 },
            angle:    { min: 0,   max: 360 },
            scale:    { start: 1.4, end: 0 },
            alpha:    { start: 1,   end: 0 },
            lifespan: { min: 260, max: 680 },
            gravityY: 280, quantity: 0,
            tint: [0xffffff, 0xffdd00, 0xff8800, 0x88ddff, 0xff8877],
          });

          /* Strategy label */
          this.add.text(W / 2, H - 4, stateRef.current.strategyName.toUpperCase(), {
            fontFamily: "monospace", fontSize: "9px", color: "#ffffff",
          }).setOrigin(0.5, 1).setAlpha(0.2);
        }

        tw(targets: any, cfg: object) {
          this.tweens.killTweensOf(targets);
          this.tweens.add({ targets, ...cfg });
        }

        update() {
          const s = stateRef.current;

          /* ── Player ── */
          if (s.pAttack && !prev.pAttack) {
            this.p.play(ANIMS.attack.key, true);
            this.tw(this.p, { x: P_X + 72, ease: "Back.Out", duration: 160, yoyo: true, hold: 80 });
          }
          if (s.pHit && !prev.pHit) {
            this.p.play(ANIMS.hit.key, true);
            this.tw(this.p, { x: P_X - 55, ease: "Power3.In", duration: 100, yoyo: true });
          }
          if (!s.pAttack && prev.pAttack && !s.pHit &&
              this.p.anims.currentAnim?.key !== ANIMS.hit.key &&
              this.p.anims.currentAnim?.key !== ANIMS.idle.key) {
            this.p.play(ANIMS.idle.key);
          }

          /* ── CPU ── */
          if (s.cAttack && !prev.cAttack) {
            this.c.play(ANIMS.attack.key, true);
            this.tw(this.c, { x: C_X - 72, ease: "Back.Out", duration: 160, yoyo: true, hold: 80 });
          }
          if (s.cHit && !prev.cHit) {
            this.c.play(ANIMS.hit.key, true);
            this.tw(this.c, { x: C_X + 55, ease: "Power3.In", duration: 100, yoyo: true });
          }
          if (!s.cAttack && prev.cAttack && !s.cHit &&
              this.c.anims.currentAnim?.key !== ANIMS.hit.key &&
              this.c.anims.currentAnim?.key !== ANIMS.idle.key) {
            this.c.play(ANIMS.idle.key);
          }

          /* ── Clash ── */
          if (s.clashing && !prev.clashing) {
            this.emitter.explode(32, W / 2, FLOOR_Y - FRAME_H * KNIGHT_SCALE * 0.55);
            this.cameras.main.shake(160, 0.009);
            this.cameras.main.flash(90, 255, 255, 255, false, undefined as any, 0.18);
          }

          prev.pAttack = s.pAttack; prev.cAttack = s.cAttack;
          prev.pHit    = s.pHit;    prev.cHit    = s.cHit;
          prev.clashing = s.clashing;
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: W, height: H,
        transparent: true,
        parent: mountRef.current!,
        scene: [BattleScene],
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        banner: false,
      });
    });

    return () => { cancelled = true; game?.destroy(true); game = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} className="w-full" style={{ height: 320 }} />;
}
