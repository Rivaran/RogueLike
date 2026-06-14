import Link from "next/link";
import { WaveBattle } from "./WaveBattle";

export default function WavePage() {
  return (
    <main className="shell game-shell">
      <div className="game-header">
        <Link href="/" className="back-btn">← もどる</Link>
        <h1>⚔️ ウェーブバトル</h1>
      </div>
      <WaveBattle />
    </main>
  );
}
