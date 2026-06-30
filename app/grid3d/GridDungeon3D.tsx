"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ── 定数 ────────────────────────────────────────────────────────────────────
const COLS = 7;
const ROWS = 7;
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

interface GameState {
  player: Player;
  grid: Cell[][];
  enemies: Map<string, Enemy>;
  phase: Phase;
  log: string[];
  fog: Set<string>;
}

// ── マップ生成 ───────────────────────────────────────────────────────────────
function makeMap(floor: number): { grid: Cell[][]; enemies: Map<string, Enemy> } {
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => "floor")
  );
  const enemies = new Map<string, Enemy>();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 && c === 0) continue;
      if (r === 0 && c === 1) continue;
      if (r === 1 && c === 0) continue;
      if (Math.random() < 0.18) grid[r][c] = "wall";
    }
  }

  const enemyCount = 4 + floor * 2;
  const emojiList = ["👺", "👹", "🐺", "🦇", "🕷️", "🐍"];
  let placed = 0, attempts = 0;
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

// ── 3Dタイルコンポーネント ───────────────────────────────────────────────────
function Tile({ x, z, cell, revealed, enemy }: {
  x: number; z: number; cell: Cell; revealed: boolean; enemy?: Enemy;
}) {
  if (!revealed) {
    return (
      <mesh position={[x, 0, z]}>
        <boxGeometry args={[0.95, 0.1, 0.95]} />
        <meshStandardMaterial color="#0d1b2a" />
      </mesh>
    );
  }

  if (cell === "wall") {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.95, 1, 0.95]} />
          <meshStandardMaterial color="#4a6a8a" />
        </mesh>
      </group>
    );
  }

  const floorColor = cell === "stairs" ? "#3a7a3a" : "#2a4a7a";

  return (
    <group position={[x, 0, z]}>
      {/* 床タイル */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.95, 0.1, 0.95]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>

      {/* 宝箱 */}
      {cell === "treasure" && (
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.4, 0.3, 0.3]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      )}

      {/* 階段 */}
      {cell === "stairs" && (
        <group>
          <mesh position={[-0.15, 0.1, 0]}>
            <boxGeometry args={[0.25, 0.1, 0.6]} />
            <meshStandardMaterial color="#6b8a3a" />
          </mesh>
          <mesh position={[0.1, 0.2, 0]}>
            <boxGeometry args={[0.25, 0.1, 0.6]} />
            <meshStandardMaterial color="#6b8a3a" />
          </mesh>
        </group>
      )}

      {/* 敵 */}
      {(cell === "enemy" || cell === "boss") && enemy && (
        <group>
          {/* 敵の体 */}
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[cell === "boss" ? 0.35 : 0.25, 8, 8]} />
            <meshStandardMaterial color={cell === "boss" ? "#dc2626" : "#ef4444"} />
          </mesh>
          {/* 目 */}
          <mesh position={[-0.08, 0.4, 0.2]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0.08, 0.4, 0.2]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
          </mesh>
          {/* HPバー */}
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[0.6, 0.06, 0.06]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
          <mesh position={[(enemy.hp / enemy.maxHp - 1) * 0.3, 0.7, 0.01]}>
            <boxGeometry args={[0.6 * (enemy.hp / enemy.maxHp), 0.06, 0.06]} />
            <meshStandardMaterial color="#4ade80" />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── プレイヤー3D ─────────────────────────────────────────────────────────────
function PlayerModel({ x, z }: { x: number; z: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3(x, 0.35, z));
  targetPos.current.set(x, 0.35, z);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.lerp(targetPos.current, 0.15);
      meshRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[x, 0.35, z]}>
        <capsuleGeometry args={[0.15, 0.3, 4, 8]} />
        <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={0.3} />
      </mesh>
      {/* プレイヤーの足元ライト */}
      <pointLight position={[x, 1.5, z]} intensity={2} distance={5} color="#93c5fd" />
    </group>
  );
}

// ── カメラ追従 ────────────────────────────────────────────────────────────────
function CameraFollower({ x, z }: { x: number; z: number }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(x, 0, z));
  target.current.set(x, 0, z);

  useFrame(() => {
    const t = target.current;
    const camTarget = new THREE.Vector3(t.x + 4, 6, t.z + 4);
    camera.position.lerp(camTarget, 0.05);
    const lookAt = new THREE.Vector3();
    lookAt.copy(t);
    lookAt.y = 0;
    camera.lookAt(lookAt);
  });

  return null;
}

// ── メインコンポーネント ─────────────────────────────────────────────────────
export function GridDungeon3D() {
  const [state, setState] = useState<GameState>(() => {
    const { grid, enemies } = makeMap(1);
    const fog = new Set<string>();
    // 初期視界
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = 0 + dr, c = 0 + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) fog.add(`${r},${c}`);
      }
    }
    return {
      player: { x: 0, y: 0, hp: 10, maxHp: 10, atk: 3, floor: 1 },
      grid, enemies, phase: "playing", log: [], fog,
    };
  });

  const updateFog = useCallback((s: GameState) => {
    const { x, y } = s.player;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = y + dr, c = x + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) s.fog.add(`${r},${c}`);
      }
    }
  }, []);

  const initFloor = useCallback((floor: number, prev: GameState): GameState => {
    const { grid, enemies } = makeMap(floor);
    const fog = new Set<string>();
    const newState: GameState = {
      ...prev,
      grid, enemies, fog,
      player: { ...prev.player, x: 0, y: 0, floor },
    };
    updateFog(newState);
    return newState;
  }, [updateFog]);

  const move = useCallback((dx: number, dy: number) => {
    setState(prev => {
      if (prev.phase !== "playing") return prev;
      const s: GameState = {
        ...prev,
        player: { ...prev.player },
        grid: prev.grid.map(row => [...row]),
        enemies: new Map(prev.enemies),
        log: [...prev.log],
        fog: new Set(prev.fog),
      };

      const nx = s.player.x + dx;
      const ny = s.player.y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return prev;

      const cell = s.grid[ny][nx];
      const key = `${ny},${nx}`;

      if (cell === "wall") return prev;

      if (cell === "enemy" || cell === "boss") {
        const enemy = s.enemies.get(key)!;
        const newEnemy = { ...enemy, hp: enemy.hp - s.player.atk };
        s.log = [`⚔️ ${enemy.emoji}に${s.player.atk}ダメージ！ (残HP: ${Math.max(0, newEnemy.hp)})`, ...s.log].slice(0, 20);

        if (newEnemy.hp <= 0) {
          s.enemies.delete(key);
          s.grid[ny][nx] = "floor";
          s.log = [`💥 ${enemy.emoji}を倒した！`, ...s.log].slice(0, 20);
          if (cell === "boss") {
            s.phase = "cleared";
            s.log = ["🎉 ボスを倒した！クリア！", ...s.log].slice(0, 20);
          }
        } else {
          s.enemies.set(key, newEnemy);
          s.player.hp -= enemy.atk;
          s.log = [`💢 ${enemy.emoji}から${enemy.atk}ダメージ！ (残HP: ${s.player.hp})`, ...s.log].slice(0, 20);
          if (s.player.hp <= 0) {
            s.phase = "dead";
            s.log = ["💀 やられた...", ...s.log].slice(0, 20);
          }
        }
      } else if (cell === "treasure") {
        if (Math.random() < 0.5) {
          const heal = 2 + Math.floor(Math.random() * 3);
          s.player.hp = Math.min(s.player.maxHp, s.player.hp + heal);
          s.log = [`💰 宝箱！ HP+${heal}`, ...s.log].slice(0, 20);
        } else {
          s.player.atk += 1;
          s.log = [`💰 宝箱！ こうげき力+1`, ...s.log].slice(0, 20);
        }
        s.grid[ny][nx] = "floor";
        s.player.x = nx;
        s.player.y = ny;
      } else if (cell === "stairs") {
        const nextFloor = s.player.floor + 1;
        s.log = [`🪜 ${nextFloor}階へ進んだ！`, ...s.log].slice(0, 20);
        const newState = initFloor(nextFloor, s);
        newState.log = s.log;
        return newState;
      } else {
        s.player.x = nx;
        s.player.y = ny;
      }

      updateFog(s);
      return s;
    });
  }, [initFloor, updateFog]);

  const restart = useCallback(() => {
    const { grid, enemies } = makeMap(1);
    const fog = new Set<string>();
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = 0 + dr, c = 0 + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) fog.add(`${r},${c}`);
      }
    }
    setState({
      player: { x: 0, y: 0, hp: 10, maxHp: 10, atk: 3, floor: 1 },
      grid, enemies, phase: "playing", log: [], fog,
    });
  }, []);

  // キーボード
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
  const touchRef = useRef({ x: 0, y: 0 });

  const hpRatio = state.player.hp / state.player.maxHp;
  const hpColor = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#f87171";

  return (
    <div className="game-layout">
      {/* 3Dキャンバス */}
      <div className="play-panel card" style={{ padding: 0, minHeight: 350 }}>
        <div
          style={{ width: "100%", height: 350, touchAction: "none" }}
          onTouchStart={(e) => {
            touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchRef.current.x;
            const dy = e.changedTouches[0].clientY - touchRef.current.y;
            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
            if (Math.abs(dx) >= Math.abs(dy)) {
              move(dx > 0 ? 1 : -1, 0);
            } else {
              move(0, dy > 0 ? 1 : -1);
            }
          }}
        >
          <Canvas camera={{ position: [4, 6, 4], fov: 50 }}>
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 8, 5]} intensity={0.6} />

            <CameraFollower x={state.player.x} z={state.player.y} />

            {/* グリッド描画 */}
            {state.grid.map((row, r) =>
              row.map((cell, c) => (
                <Tile
                  key={`${r}-${c}`}
                  x={c}
                  z={r}
                  cell={cell}
                  revealed={state.fog.has(`${r},${c}`)}
                  enemy={state.enemies.get(`${r},${c}`)}
                />
              ))
            )}

            {/* プレイヤー */}
            <PlayerModel x={state.player.x} z={state.player.y} />
          </Canvas>
        </div>

        {/* モバイル用ボタン */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxWidth: 180, margin: "8px auto" }}>
          <div />
          <button className="btn btn-ghost" onClick={() => move(0, -1)} style={{ padding: "10px", fontSize: "1.2rem" }}>↑</button>
          <div />
          <button className="btn btn-ghost" onClick={() => move(-1, 0)} style={{ padding: "10px", fontSize: "1.2rem" }}>←</button>
          <button className="btn btn-ghost" onClick={() => move(0, 1)}  style={{ padding: "10px", fontSize: "1.2rem" }}>↓</button>
          <button className="btn btn-ghost" onClick={() => move(1, 0)}  style={{ padding: "10px", fontSize: "1.2rem" }}>→</button>
        </div>
      </div>

      {/* ステータス */}
      <div className="stat-panel card">
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {state.player.floor}F / {FLOORS}F
        </div>

        <div className="stat-grid">
          <div className="stat-box">
            <span>❤️ HP</span>
            <strong style={{ color: hpColor }}>{Math.max(0, state.player.hp)} / {state.player.maxHp}</strong>
          </div>
          <div className="stat-box">
            <span>⚔️ こうげき</span>
            <strong>{state.player.atk}</strong>
          </div>
        </div>

        {(state.phase === "dead" || state.phase === "cleared") && (
          <button className="btn btn-primary" onClick={restart} style={{ width: "100%" }}>
            {state.phase === "cleared" ? "🎉 もう一度！" : "💀 リスタート"}
          </button>
        )}

        <div className="log-area">
          {state.log.length === 0
            ? <span>ダンジョンへ踏み込め！</span>
            : state.log.map((l, i) => <div key={i}>{l}</div>)
          }
        </div>
      </div>
    </div>
  );
}
