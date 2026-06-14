"use client";

import { useState, useCallback } from "react";

const TOTAL_WAVES = 8;

interface Enemy {
  id: number;
  emoji: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
}

interface Player {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  wave: number;
}

interface Upgrade {
  icon: string;
  label: string;
  desc: string;
  apply: (p: Player) => Player;
}

const ENEMY_TEMPLATES = [
  { emoji: "🐭", name: "ネズミ",   hp: 3,  atk: 1 },
  { emoji: "🐺", name: "オオカミ", hp: 5,  atk: 2 },
  { emoji: "👺", name: "オニ",     hp: 7,  atk: 3 },
  { emoji: "🐉", name: "ドラゴン", hp: 12, atk: 4 },
  { emoji: "💀", name: "スケルトン",hp: 6, atk: 2 },
  { emoji: "🕷️", name: "クモ",     hp: 4,  atk: 2 },
  { emoji: "🦇", name: "コウモリ", hp: 3,  atk: 1 },
  { emoji: "🐍", name: "ヘビ",     hp: 5,  atk: 3 },
];

function makeWave(wave: number): Enemy[] {
  const count = Math.min(2 + Math.floor(wave / 2), 5);
  return Array.from({ length: count }, (_, i) => {
    const t = ENEMY_TEMPLATES[Math.floor(Math.random() * ENEMY_TEMPLATES.length)];
    const scale = 1 + wave * 0.3;
    const hp = Math.round(t.hp * scale);
    return {
      id: wave * 10 + i,
      emoji: t.emoji,
      name: t.name,
      hp,
      maxHp: hp,
      atk: Math.max(1, Math.round(t.atk * scale * 0.8)),
    };
  });
}

function makeUpgrades(): Upgrade[] {
  const pool: Upgrade[] = [
    { icon: "⚔️", label: "こうげき+2", desc: "攻撃力が2上がる", apply: p => ({ ...p, atk: p.atk + 2 }) },
    { icon: "🛡️", label: "ぼうぎょ+1", desc: "防御力が1上がる（ダメージ軽減）", apply: p => ({ ...p, def: p.def + 1 }) },
    { icon: "❤️", label: "HP+5",      desc: "最大HPが5増えて全回復する", apply: p => ({ ...p, maxHp: p.maxHp + 5, hp: p.maxHp + 5 }) },
    { icon: "🍖", label: "全回復",     desc: "HPを全部回復する", apply: p => ({ ...p, hp: p.maxHp }) },
    { icon: "💪", label: "こうげき+3", desc: "攻撃力が3上がる", apply: p => ({ ...p, atk: p.atk + 3 }) },
    { icon: "🌟", label: "ぜんぶUP",  desc: "こうげき・ぼうぎょ・HPがちょっと上がる", apply: p => ({ ...p, atk: p.atk + 1, def: p.def + 1, maxHp: p.maxHp + 3, hp: Math.min(p.hp + 3, p.maxHp + 3) }) },
  ];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function makePlayer(): Player {
  return { hp: 20, maxHp: 20, atk: 4, def: 0, wave: 1 };
}

type Phase = "battle" | "upgrade" | "dead" | "cleared";

export function WaveBattle() {
  const [player, setPlayer] = useState<Player>(makePlayer);
  const [enemies, setEnemies] = useState<Enemy[]>(() => makeWave(1));
  const [phase, setPhase] = useState<Phase>("battle");
  const [log, setLog] = useState<string[]>(["ウェーブ 1 開始！"]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [animId, setAnimId] = useState<number | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 20));
  }, []);

  const attackEnemy = useCallback((enemyId: number) => {
    if (phase !== "battle" || animId !== null) return;

    setPlayer(prevPlayer => {
      setEnemies(prevEnemies => {
        const idx = prevEnemies.findIndex(e => e.id === enemyId);
        if (idx === -1) return prevEnemies;

        const target = { ...prevEnemies[idx] };
        target.hp -= prevPlayer.atk;
        addLog(`⚔️ ${target.name}に${prevPlayer.atk}ダメージ！ (残HP: ${Math.max(0, target.hp)})`);

        let nextEnemies: Enemy[];
        if (target.hp <= 0) {
          nextEnemies = prevEnemies.filter(e => e.id !== enemyId);
          addLog(`💥 ${target.name}を倒した！`);
        } else {
          nextEnemies = prevEnemies.map(e => e.id === enemyId ? target : e);
        }

        // 敵の反撃（生き残った敵全員が1回攻撃）
        let newHp = prevPlayer.hp;
        const counterEnemies = target.hp > 0 ? nextEnemies : nextEnemies;
        for (const e of counterEnemies) {
          if (e.id === enemyId && target.hp <= 0) continue;
          const dmg = Math.max(0, e.atk - prevPlayer.def);
          newHp -= dmg;
          addLog(`💢 ${e.name}から${dmg}ダメージ！`);
        }

        const newPlayer = { ...prevPlayer, hp: newHp };

        if (newHp <= 0) {
          addLog("💀 やられた...");
          setPhase("dead");
          return nextEnemies;
        }

        if (nextEnemies.length === 0) {
          if (prevPlayer.wave >= TOTAL_WAVES) {
            addLog("🎉 全ウェーブクリア！");
            setPhase("cleared");
          } else {
            addLog(`✨ ウェーブ ${prevPlayer.wave} クリア！パワーアップを選べ！`);
            setUpgrades(makeUpgrades());
            setPhase("upgrade");
          }
        }

        setPlayer(newPlayer);
        return nextEnemies;
      });
      return prevPlayer; // setPlayer は内部で更新するため最初は元の値を返す
    });
  }, [phase, animId, addLog]);

  const applyUpgrade = useCallback((upgrade: Upgrade) => {
    setPlayer(prev => {
      const next = upgrade.apply(prev);
      const nextWave = prev.wave + 1;
      const newEnemies = makeWave(nextWave);
      setEnemies(newEnemies);
      addLog(`ウェーブ ${nextWave} 開始！`);
      setPhase("battle");
      return { ...next, wave: nextWave };
    });
  }, [addLog]);

  const restart = useCallback(() => {
    const p = makePlayer();
    setPlayer(p);
    setEnemies(makeWave(1));
    setPhase("battle");
    setLog(["ウェーブ 1 開始！"]);
    setUpgrades([]);
    setAnimId(null);
  }, []);

  const hpRatio = player.hp / player.maxHp;
  const hpColor = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#f87171";

  return (
    <div className="game-layout">
      {/* ステータス */}
      <div className="stat-panel card">
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ウェーブ {player.wave} / {TOTAL_WAVES}
        </div>

        <div className="stat-grid">
          <div className="stat-box">
            <span>❤️ HP</span>
            <strong style={{ color: hpColor }}>{Math.max(0, player.hp)} / {player.maxHp}</strong>
          </div>
          <div className="stat-box">
            <span>⚔️ こうげき</span>
            <strong>{player.atk}</strong>
          </div>
          <div className="stat-box">
            <span>🛡️ ぼうぎょ</span>
            <strong>{player.def}</strong>
          </div>
          <div className="stat-box">
            <span>👹 のこり敵</span>
            <strong>{enemies.length}</strong>
          </div>
        </div>

        {(phase === "dead" || phase === "cleared") && (
          <button className="btn btn-primary" onClick={restart} style={{ width: "100%" }}>
            {phase === "cleared" ? "🎉 もう一度！" : "💀 リスタート"}
          </button>
        )}

        <div className="log-area">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      {/* バトルエリア */}
      <div className="play-panel card">
        {phase === "battle" && (
          <>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center" }}>
              👇 敵をタップ/クリックして攻撃！
            </p>
            <div className="enemy-row">
              {enemies.map(e => (
                <button
                  key={e.id}
                  className="enemy-card"
                  onClick={() => attackEnemy(e.id)}
                >
                  <div className="enemy-icon">{e.emoji}</div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{e.name}</div>
                  <div className="enemy-hp">❤️ {e.hp} / {e.maxHp}</div>
                  <div style={{ fontSize: "0.72rem", color: "#f97316", fontWeight: 700 }}>⚔️ {e.atk}</div>
                  {/* HPバー */}
                  <div style={{ width: "100%", height: 6, background: "#fee2e2", borderRadius: 3 }}>
                    <div style={{ width: `${(e.hp / e.maxHp) * 100}%`, height: "100%", background: "#dc2626", borderRadius: 3 }} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "upgrade" && (
          <>
            <p style={{ fontSize: "0.9rem", fontWeight: 700, textAlign: "center", color: "var(--text)" }}>
              🌟 パワーアップを1つ選ぼう！
            </p>
            <div className="upgrade-grid">
              {upgrades.map((u, i) => (
                <button key={i} className="upgrade-btn" onClick={() => applyUpgrade(u)}>
                  <div className="up-icon">{u.icon}</div>
                  <div className="up-label">{u.label}</div>
                  <div className="up-desc">{u.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "cleared" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>全ウェーブクリア！</div>
            <div style={{ color: "var(--muted)", marginBottom: 20 }}>
              最終スタック: こうげき{player.atk} / ぼうぎょ{player.def} / HP{player.hp}/{player.maxHp}
            </div>
            <button className="btn btn-primary" onClick={restart}>もう一度！</button>
          </div>
        )}

        {phase === "dead" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>💀</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>ウェーブ {player.wave} でやられた</div>
            <div style={{ color: "var(--muted)", marginBottom: 20 }}>
              最終スタック: こうげき{player.atk} / ぼうぎょ{player.def}
            </div>
            <button className="btn btn-primary" onClick={restart}>もう一度！</button>
          </div>
        )}

        {/* ウェーブ進捗バー */}
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 6 }}>進捗</div>
          <div className="floor-bar">
            {Array.from({ length: TOTAL_WAVES }, (_, i) => (
              <div
                key={i}
                className={`floor-step ${i + 1 < player.wave || phase === "cleared" ? "done" : i + 1 === player.wave ? "current" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
