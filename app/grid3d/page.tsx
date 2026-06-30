import Link from "next/link";
import { GridDungeon3D } from "./GridDungeon3D";

export default function Grid3DPage() {
  return (
    <main className="page-shell game-page">
      <header className="game-header">
        <Link className="back-link" href="/">← もどる</Link>
        <h1>🗺️ 3Dダンジョン</h1>
      </header>
      <GridDungeon3D />
    </main>
  );
}
