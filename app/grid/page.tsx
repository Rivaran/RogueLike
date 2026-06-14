import Link from "next/link";
import { GridDungeon } from "./GridDungeon";

export default function GridPage() {
  return (
    <main className="shell game-shell">
      <div className="game-header">
        <Link href="/" className="back-btn">← もどる</Link>
        <h1>🗺️ グリッドダンジョン</h1>
      </div>
      <GridDungeon />
    </main>
  );
}
