import Link from "next/link";

const protos = [
  {
    href: "/grid",
    icon: "🗺️",
    tag: "グリッド探索",
    tagClass: "tag-grid",
    title: "グリッドダンジョン",
    desc: "7×7のマップをターン制で探索。敵に隣接すると自動バトル。3フロアのボス撃破を目指せ。",
  },
  {
    href: "/wave",
    icon: "⚔️",
    tag: "ウェーブバトル",
    tagClass: "tag-wave",
    title: "ウェーブバトル",
    desc: "次々と現れる敵を倒してウェーブを突破。ウェーブごとにパワーアップを選んで強くなれ。",
  },
  {
    href: "/card-dungeon",
    icon: "🃏",
    tag: "カードイベント",
    tagClass: "tag-card",
    title: "カードダンジョン",
    desc: "ダンジョンを進むたびにカードを引く。カードの効果を判断しながら最深部を目指せ。",
  },
];

export default function Home() {
  return (
    <main className="shell">
      <section className="home-hero card">
        <p className="home-kicker">Rogue Proto</p>
        <h1>ローグライク<br />プロトタイプ</h1>
        <p>3つのアプローチを試して、いちばんおもしろいやつを育てる。</p>
      </section>

      <div className="proto-grid">
        {protos.map((p) => (
          <Link key={p.href} href={p.href} className="proto-card card">
            <div className="proto-icon">{p.icon}</div>
            <span className={`proto-tag ${p.tagClass}`}>{p.tag}</span>
            <h2>{p.title}</h2>
            <p>{p.desc}</p>
            <span className="proto-link">あそぶ →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
