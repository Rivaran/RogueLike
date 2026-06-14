import Link from "next/link";
import { CardDungeon } from "./CardDungeon";

export default function CardPage() {
  return (
    <main className="shell game-shell">
      <div className="game-header">
        <Link href="/" className="back-btn">← もどる</Link>
        <h1>🃏 カードダンジョン</h1>
      </div>
      <CardDungeon />
    </main>
  );
}
