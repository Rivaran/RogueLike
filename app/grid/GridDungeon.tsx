"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── 定数 ────────────────────────────────────────────────────────────────────
const COLS = 7;
const ROWS = 7;
const CELL = 56;          // px per cell (canvas logical)
const SCALE = 2;
const W = COLS * CELL;
const H = ROWS * CELL;
const FLOORS = 3;

type Cell = "floor" | "wall" | "enemy" | "treasure" | "stairs" | "boss";
type Phase = "playing" | "dead" | "cleared";

interface Enemy {
  hp: number;
  maxHp: number;
  atk: number;
  emoji: string;
}

interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  floor: number;
}

// ── マップ生成 ───────────────────────────────────────────────────────────────
function makeMap(floor: number): { grid: Cell[][]; enemies: Map<string, Enemy> } {
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => "floor")
  );
  const enemies = new Map<string, Enemy>();

  // ランダムに壁を配置（プレイヤーの出発点(0,0)は空ける）
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // スタート地点(0,0)とその隣は壁にしない
      if (r === 0 && c === 0) continue;
      if (r === 0 && c === 1) continue;
      if (r === 1 && c === 0) continue;
      if (Math.random() < 0.18) grid[r][c] = "wall";
    }
  }

  // 敵を配置
  const enemyCount = 4 + floor * 2;
  const emojiList = ["👺", "👹", "🐺", "🦇", "🕷️", "🐍"];
  let placed = 0;
  let attempts = 0;
  while (placed < enemyCount && attempts < 200) {
    attempts++;
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if ((r === 0 && c === 0) || grid[r][c] !== "floor") continue;
    const hp = 2 + floor + Math.floor(Math.random() * 3);
    grid[r][c] = "enemy";
    enemies.set(`${r},${c}`, {
      hp, maxHp: hp,
      atk: 1 + Math.floor(floor / 2),
      emoji: emojiList[Math.floor(Math.random() * emojiList.length)],
    });
    placed++;
  }

  // ボス（最終フロアのみ）
  if (floor === FLOORS) {
    let done = false;
    while (!done) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if ((r === 0 && c === 0) || grid[r][c] !== "floor") continue;
      grid[r][c] = "boss";
      enemies.set(`${r},${c}`, { hp: 12, maxHp: 12, atk: 3, emoji: "🐲" });
      done = true;
    }
  }

  // 宝箱
  const treasureCount = 2 + Math.floor(Math.random() * 2);
  let tPlaced = 0, tAttempts = 0;
  while (tPlaced < treasureCount && tAttempts < 100) {
    tAttempts++;
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if ((r === 0 && c === 0) || grid[r][c] !== "floor") continue;
    grid[r][c] = "treasure";
    tPlaced++;
  }

  // 階段（最終フロア以外）
  if (floor < FLOORS) {
    let done = false;
    while (!done) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if ((r === 0 && c === 0) || grid[r][c] !== "floor") continue;
      grid[r][c] = "stairs";
      done = true;
    }
  }

  return { grid, enemies };
}

// ── コンポーネント ───────────────────────────────────────────────────────────
export function GridDungeon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    player: { x: 0, y: 0, hp: 10, maxHp: 10, atk: 3, floor: 1 } as Player,
    grid: [] as Cell[][],
    enemies: new Map<string, Enemy>(),
    phase: "playing" as Phase,
    log: [] as string[],
    fog: new Set<string>(),
  });

  const [display, setDisplay] = useState({
    hp: 10, maxHp: 10, atk: 3, floor: 1,
    phase: "playing" as Phase,
    log: [] as string[],
  });

  const addLog = (msg: string) => {
    const s = stateRef.current;
    s.log = [msg, ...s.log].slice(0, 20);
  };

  const updateFog = useCallback(() => {
    const s = stateRef.current;
    const { x, y } = s.player;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = y + dr, c = x + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          s.fog.add(`${r},${c}`);
        }
      }
    }
  }, []);

  const initFloor = useCallback((floor: number) => {
    const s = stateRef.current;
    const { grid, enemies } = makeMap(floor);
    s.grid = grid;
    s.enemies = enemies;
    s.player.x = 0;
    s.player.y = 0;
    s.player.floor = floor;
    s.fog = new Set();
    updateFog();
  }, [updateFog]);

  // ── 描画 ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = `${r},${c}`;
        const revealed = s.fog.has(key);
        const x = c * CELL, y = r * CELL;

        if (!revealed) {
          ctx.fillStyle = "#0d1b2a";
          ctx.fillRect(x, y, CELL, CELL);
          continue;
        }

        const cell = s.grid[r][c];

        // 床
        ctx.fillStyle = cell === "wall" ? "#2d4a6b" : "#2a4a7a";
        ctx.fillRect(x, y, CELL, CELL);

        // グリッド線
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, CELL, CELL);

        ctx.font = `${CELL * 0.52}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const cx = x + CELL / 2, cy = y + CELL / 2;

        if (cell === "wall") {
          ctx.fillStyle = "#1e3a5f";
          ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
          ctx.fillText("🪨", cx, cy);
        } else if (cell === "enemy" || cell === "boss") {
          const enemy = s.enemies.get(key);
          if (enemy) {
            ctx.fillText(enemy.emoji, cx, cy - 4);
            // HPバー
            const bw = CELL - 12, bh = 5;
            const bx = x + 6, by = y + CELL - 9;
            ctx.fillStyle = "#dc2626";
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = "#4ade80";
            ctx.fillRect(bx, by, bw * (enemy.hp / enemy.maxHp), bh);
          }
        } else if (cell === "treasure") {
          ctx.fillText("💰", cx, cy);
        } else if (cell === "stairs") {
          ctx.fillText("🪜", cx, cy);
        }
      }
    }

    // プレイヤー
    const px = s.player.x * CELL + CELL / 2;
    const py = s.player.y * CELL + CELL / 2;
    ctx.font = `${CELL * 0.55}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧑", px, py);

    ctx.restore();
  }, []);

  // ── 移動 ──────────────────────────────────────────────────────────────────
  const move = useCallback((dx: number, dy: number) => {
    const s = stateRef.current;
    if (s.phase !== "playing") return;

    const nx = s.player.x + dx;
    const ny = s.player.y + dy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    const cell = s.grid[ny][nx];
    const key = `${ny},${nx}`;

    if (cell === "wall") return;

    if (cell === "enemy" || cell === "boss") {
      const enemy = s.enemies.get(key)!;
      enemy.hp -= s.player.atk;
      addLog(`⚔️ ${enemy.emoji}に${s.player.atk}ダメージ！ (残HP: ${Math.max(0, enemy.hp)})`);
      if (enemy.hp <= 0) {
        s.enemies.delete(key);
        s.grid[ny][nx] = "floor";
        addLog(`💥 ${enemy.emoji}を倒した！`);
        if (cell === "boss") {
          s.phase = "cleared";
          addLog("🎉 ボスを倒した！クリア！");
          setDisplay(d => ({ ...d, phase: "cleared" }));
        }
      } else {
        // 敵の反撃
        s.player.hp -= enemy.atk;
        addLog(`💢 ${enemy.emoji}から${enemy.atk}ダメージ！ (残HP: ${s.player.hp})`);
        if (s.player.hp <= 0) {
          s.phase = "dead";
          addLog("💀 やられた...");
          setDisplay(d => ({ ...d, hp: 0, phase: "dead" }));
        }
      }
    } else if (cell === "treasure") {
      const roll = Math.random();
      if (roll < 0.5) {
        const heal = 2 + Math.floor(Math.random() * 3);
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + heal);
        addLog(`💰 宝箱！ HP+${heal}`);
      } else {
        s.player.atk += 1;
        addLog(`💰 宝箱！ こうげき力+1`);
      }
      s.grid[ny][nx] = "floor";
      s.player.x = nx;
      s.player.y = ny;
    } else if (cell === "stairs") {
      const nextFloor = s.player.floor + 1;
      addLog(`🪜 ${nextFloor}階へ進んだ！`);
      initFloor(nextFloor);
    } else {
      s.player.x = nx;
      s.player.y = ny;
    }

    if (cell !== "stairs") {
      s.player.x = nx;
      s.player.y = ny;
    }

    updateFog();
    setDisplay({
      hp: s.player.hp,
      maxHp: s.player.maxHp,
      atk: s.player.atk,
      floor: s.player.floor,
      phase: s.phase,
      log: [...s.log],
    });
    draw();
  }, [draw, updateFog, initFloor]);

  // キーボード操作
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d"].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowUp"    || e.key === "w") move(0, -1);
      if (e.key === "ArrowDown"  || e.key === "s") move(0,  1);
      if (e.key === "ArrowLeft"  || e.key === "a") move(-1, 0);
      if (e.key === "ArrowRight" || e.key === "d") move(1,  0);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move]);

  // タッチスワイプ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let startX = 0, startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) >= Math.abs(dy)) {
        move(dx > 0 ? 1 : -1, 0);
      } else {
        move(0, dy > 0 ? 1 : -1);
      }
    };
    canvas.addEventListener("touchstart", onStart, { passive: true });
    canvas.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchend", onEnd);
    };
  }, [move]);

  // 初期化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    initFloor(1);
    draw();
  }, [initFloor, draw]);

  const restart = () => {
    const s = stateRef.current;
    s.player = { x: 0, y: 0, hp: 10, maxHp: 10, atk: 3, floor: 1 };
    s.phase = "playing";
    s.log = [];
    initFloor(1);
    setDisplay({ hp: 10, maxHp: 10, atk: 3, floor: 1, phase: "playing", log: [] });
    draw();
  };

  const hpRatio = display.hp / display.maxHp;
  const hpColor = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#f87171";

  return (
    <div className="game-layout">
      {/* ステータス */}
      <div className="stat-panel card">
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {display.floor}F / {FLOORS}F
        </div>

        <div className="stat-grid">
          <div className="stat-box">
            <span>❤️ HP</span>
            <strong style={{ color: hpColor }}>{Math.max(0, display.hp)} / {display.maxHp}</strong>
          </div>
          <div className="stat-box">
            <span>⚔️ こうげき</span>
            <strong>{display.atk}</strong>
          </div>
        </div>

        <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.6 }}>
          <div>🗺️ 矢印キー / WASD で移動</div>
          <div>📱 スワイプでも動く</div>
          <div>💰 宝箱でHP・攻撃力UP</div>
          <div>🪜 階段で次の階へ</div>
          <div>🐲 {FLOORS}階のボスを倒せ！</div>
        </div>

        {(display.phase === "dead" || display.phase === "cleared") && (
          <button className="btn btn-primary" onClick={restart} style={{ width: "100%" }}>
            {display.phase === "cleared" ? "🎉 もう一度！" : "💀 リスタート"}
          </button>
        )}

        <div className="log-area">
          {display.log.length === 0
            ? <span>ダンジョンへ踏み込め！</span>
            : display.log.map((l, i) => <div key={i}>{l}</div>)
          }
        </div>
      </div>

      {/* キャンバス */}
      <div className="play-panel card">
        <div className="canvas-wrap" style={{ background: "#0d1b2a" }}>
          <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />
        </div>
        {/* モバイル用ボタン */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxWidth: 180, margin: "0 auto" }}>
          <div />
          <button className="btn btn-ghost" onClick={() => move(0, -1)} style={{ padding: "10px", fontSize: "1.2rem" }}>↑</button>
          <div />
          <button className="btn btn-ghost" onClick={() => move(-1, 0)} style={{ padding: "10px", fontSize: "1.2rem" }}>←</button>
          <button className="btn btn-ghost" onClick={() => move(0, 1)}  style={{ padding: "10px", fontSize: "1.2rem" }}>↓</button>
          <button className="btn btn-ghost" onClick={() => move(1, 0)}  style={{ padding: "10px", fontSize: "1.2rem" }}>→</button>
        </div>
      </div>
    </div>
  );
}
