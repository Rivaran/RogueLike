"use client";

import { useState, useCallback } from "react";

// ── 定数 ────────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 15; // ダンジョンの深さ（カード枚数）
const BOSS_STEP = TOTAL_STEPS;

// ── カード定義 ───────────────────────────────────────────────────────────────
type CardType = "enemy" | "treasure" | "trap" | "heal" | "upgrade" | "boss";

interface DungeonCard {
  type: CardType;
  icon: string;
  name: string;
  desc: string;
  effect: (p: PlayerState) => { player: PlayerState; msg: string };
}

interface PlayerState {
  hp: number;
  maxHp: number;
  atk: number;
  step: number;
}

function makePlayer(): PlayerState {
  return { hp: 15, maxHp: 15, atk: 3, step: 0 };
}

function makeCard(step: number): DungeonCard {
  // ボスは最後のステップ
  if (step === BOSS_STEP) {
    return {
      type: "boss",
      icon: "🐲",
      name: "ラスボス",
      desc: "ダンジョンの守護者。強力な一撃に備えろ！",
      effect: (p) => {
        const dmg = Math.max(0, 8 - p.atk);
        const reward = p.atk + 3;
        const survived = p.hp - dmg > 0;
        return {
          player: survived
            ? { ...p, hp: p.hp - dmg }
            : { ...p, hp: 0 },
          msg: survived
            ? `🐲 ラスボスとバトル！ ${dmg}ダメージ受けた！ 勝利！`
            : `🐲 ラスボスにやられた... (ダメージ: ${dmg})`,
        };
      },
    };
  }

  const depth = step / TOTAL_STEPS;

  // ウェイト調整: 深いほど敵・トラップが増える
  const weights: [CardType, number][] = [
    ["enemy",   25 + depth * 20],
    ["treasure",20 - depth * 10],
    ["trap",    10 + depth * 15],
    ["heal",    20 - depth * 10],
    ["upgrade", 15 - depth * 5],
  ];

  const total = weights.reduce((s, [, w]) => s + Math.max(w, 0), 0);
  let r = Math.random() * total;
  let chosen: CardType = "enemy";
  for (const [type, w] of weights) {
    if (w <= 0) continue;
    r -= w;
    if (r <= 0) { chosen = type; break; }
  }

  const enemyList: DungeonCard[] = [
    { type: "enemy", icon: "👺", name: "オニ",     desc: "強そうな鬼が立ちはだかった！こうげき力次第でダメージが変わる。",
      effect: p => { const dmg = Math.max(1, 4 - Math.floor(p.atk / 2)); return { player: { ...p, hp: p.hp - dmg }, msg: `👺 オニが現れた！ ${dmg}ダメージ受けた！` }; } },
    { type: "enemy", icon: "🐺", name: "オオカミ", desc: "素早い狼が飛びかかってくる！",
      effect: p => { const dmg = Math.max(1, 3 - Math.floor(p.atk / 3)); return { player: { ...p, hp: p.hp - dmg }, msg: `🐺 オオカミが飛びかかった！ ${dmg}ダメージ！` }; } },
    { type: "enemy", icon: "🕷️", name: "クモ",     desc: "天井から大グモが落ちてきた！",
      effect: p => { const dmg = Math.max(1, 2 - Math.floor(p.atk / 4)); return { player: { ...p, hp: p.hp - dmg }, msg: `🕷️ 大グモに噛まれた！ ${dmg}ダメージ！` }; } },
  ];

  switch (chosen) {
    case "enemy":
      return enemyList[Math.floor(Math.random() * enemyList.length)];

    case "treasure": {
      const roll = Math.random();
      if (roll < 0.5) {
        return { type: "treasure", icon: "💰", name: "金貨", desc: "輝く金貨がたっぷり！こうげき力が上がる。",
          effect: p => ({ player: { ...p, atk: p.atk + 1 }, msg: "💰 金貨を発見！ こうげき力+1！" }) };
      } else {
        return { type: "treasure", icon: "💎", name: "宝石", desc: "美しい宝石を発見！HPが少し回復する。",
          effect: p => ({ player: { ...p, hp: Math.min(p.maxHp, p.hp + 3) }, msg: "💎 宝石を発見！ HP+3！" }) };
      }
    }

    case "trap": {
      const roll = Math.random();
      if (roll < 0.5) {
        return { type: "trap", icon: "🪤", name: "ワナ", desc: "足元に罠が！ダメージを受ける。",
          effect: p => { const dmg = 1 + Math.floor(step / 5); return { player: { ...p, hp: p.hp - dmg }, msg: `🪤 罠にかかった！ ${dmg}ダメージ！` }; } };
      } else {
        return { type: "trap", icon: "☠️", name: "毒ガス", desc: "毒ガスが充満している！少しHPが下がる。",
          effect: p => ({ player: { ...p, hp: p.hp - 2 }, msg: "☠️ 毒ガスを吸った！ 2ダメージ！" }) };
      }
    }

    case "heal":
      return { type: "heal", icon: "🧪", name: "ポーション", desc: "回復薬を発見！HPを大きく回復する。",
        effect: p => { const heal = 4 + Math.floor(p.maxHp * 0.2); return { player: { ...p, hp: Math.min(p.maxHp, p.hp + heal) }, msg: `🧪 ポーション発見！ HP+${heal}！` }; } };

    case "upgrade":
      return { type: "upgrade", icon: "⬆️", name: "鍛冶屋", desc: "旅の鍛冶屋に出会った！武器を強化してもらえる。",
        effect: p => ({ player: { ...p, atk: p.atk + 2 }, msg: "⬆️ 武器を強化した！ こうげき力+2！" }) };

    default:
      return enemyList[0];
  }
}

type Phase = "draw" | "result" | "dead" | "cleared";

export function CardDungeon() {
  const [player, setPlayer] = useState<PlayerState>(makePlayer);
  const [phase, setPhase] = useState<Phase>("draw");
  const [cards, setCards] = useState<DungeonCard[]>(() => [
    makeCard(1), makeCard(1), makeCard(1)
  ]);
  const [log, setLog] = useState<string[]>(["ダンジョンへ入った！"]);
  const [lastMsg, setLastMsg] = useState<string>("");

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 20));
  }, []);

  const chooseCard = useCallback((card: DungeonCard, idx: number) => {
    if (phase !== "draw") return;

    setPlayer(prev => {
      const nextStep = prev.step + 1;
      const { player: nextPlayer, msg } = card.effect({ ...prev, step: nextStep });
      const np = { ...nextPlayer, step: nextStep };

      addLog(msg);
      setLastMsg(msg);

      if (np.hp <= 0) {
        setPhase("dead");
        return { ...np, hp: 0 };
      }

      if (nextStep >= TOTAL_STEPS && card.type === "boss") {
        setPhase("cleared");
        return np;
      }

      // 次のカードを生成
      const nextCards = [
        makeCard(nextStep + 1),
        makeCard(nextStep + 1),
        makeCard(nextStep + 1),
      ];
      setCards(nextCards);
      setPhase("draw");

      return np;
    });
  }, [phase, addLog]);

  const restart = useCallback(() => {
    setPlayer(makePlayer());
    setPhase("draw");
    setCards([makeCard(1), makeCard(1), makeCard(1)]);
    setLog(["ダンジョンへ入った！"]);
    setLastMsg("");
  }, []);

  const hpRatio = player.hp / player.maxHp;
  const hpColor = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#f87171";

  const cardBgColor: Record<CardType, string> = {
    enemy:   "rgba(239,68,68,0.06)",
    boss:    "rgba(127,29,29,0.1)",
    treasure:"rgba(245,158,11,0.08)",
    trap:    "rgba(107,114,128,0.08)",
    heal:    "rgba(16,185,129,0.08)",
    upgrade: "rgba(37,99,235,0.08)",
  };
  const cardBorderColor: Record<CardType, string> = {
    enemy:   "rgba(239,68,68,0.25)",
    boss:    "rgba(127,29,29,0.4)",
    treasure:"rgba(245,158,11,0.3)",
    trap:    "rgba(107,114,128,0.2)",
    heal:    "rgba(16,185,129,0.25)",
    upgrade: "rgba(37,99,235,0.25)",
  };

  return (
    <div className="game-layout">
      {/* ステータス */}
      <div className="stat-panel card">
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {player.step} / {TOTAL_STEPS} 歩
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

      {/* カードエリア */}
      <div className="play-panel card">
        {/* 進捗バー */}
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 6 }}>ダンジョンの深さ</div>
          <div className="floor-bar" style={{ flexWrap: "wrap" }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`floor-step ${i + 1 < player.step ? "done" : i + 1 === player.step ? "current" : ""}`}
                style={{ flexGrow: 1 }}
              />
            ))}
          </div>
        </div>

        {phase === "draw" && (
          <>
            <p style={{ fontSize: "0.88rem", color: "var(--muted)", textAlign: "center" }}>
              3枚の中から1枚を選べ！
            </p>
            <div className="card-area">
              {cards.map((c, i) => (
                <button
                  key={i}
                  className="dungeon-card"
                  style={{
                    background: cardBgColor[c.type],
                    borderColor: cardBorderColor[c.type],
                  }}
                  onClick={() => chooseCard(c, i)}
                >
                  <div className="card-icon">{c.icon}</div>
                  <div className="card-name">{c.name}</div>
                  <div className="card-desc">{c.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "cleared" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>ダンジョン制覇！</div>
            <div style={{ color: "var(--muted)", marginBottom: 20 }}>
              最終スタック: こうげき{player.atk} / HP{player.hp}/{player.maxHp}
            </div>
            <button className="btn btn-primary" onClick={restart}>もう一度！</button>
          </div>
        )}

        {phase === "dead" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>💀</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>{player.step}歩目でやられた</div>
            <div style={{ color: "var(--muted)", marginBottom: 20 }}>
              残りHP: 0 / こうげき: {player.atk}
            </div>
            <button className="btn btn-primary" onClick={restart}>もう一度！</button>
          </div>
        )}
      </div>
    </div>
  );
}
