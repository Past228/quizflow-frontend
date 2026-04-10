import { useState } from 'react';

const TOP = [
  { rank: 1, name: 'Иван Р.', xp: 2154, medal: 'gold', trophy: true },
  { rank: 2, name: 'Михаил Т.', xp: 1989, medal: 'silver', trophy: false },
  { rank: 3, name: 'Анна С.', xp: 1950, medal: 'bronze', trophy: false },
];

const REST = [
  { rank: 4, name: 'Иван Б.', xp: 1867 },
  { rank: 5, name: 'Петр В.', xp: 1752 },
  { rank: 6, name: 'Арина К.', xp: 1683 },
  { rank: 7, name: 'Данил К.', xp: 1546 },
];

const COURSE_TOP = ['Иван Р.', 'Анна С.', 'Петр В.'];

export default function LeaderboardPage() {
  const [q, setQ] = useState('');

  const filtered = REST.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide lb-root">
        <header className="lb-header">
          <h1 className="student-page-title lb-title">ДОСКА ЛИДЕРОВ</h1>
          <input
            type="search"
            className="qf-search"
            placeholder="Поиск студентов..." 
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Поиск студентов"
          />
        </header>

        <div className="lb-grid">
          <div className="lb-main">
            {TOP.map((row) => (
              <div key={row.rank} className="student-card lb-top-card">
                <Medal rank={row.rank} variant={row.medal} />
                <div>
                  <div className="lb-name">
                    {row.name}
                    {row.trophy ? <span aria-hidden>🏆</span> : null}
                  </div>
                </div>
                <div className="lb-xp">{row.xp} XP</div>
              </div>
            ))}

            <div className="student-card lb-list">
              {filtered.map((row, i) => (
                <div key={row.rank} className={i < filtered.length - 1 ? 'lb-row' : 'lb-row lb-row--last'}>
                  <span className="lb-rank-num">{row.rank}</span>
                  <img src="/icons/Standard_avatar.png" alt="" width={40} height={40} className="lb-av" />
                  <span className="lb-row-name">{row.name}</span>
                  <span className="lb-row-xp">{row.xp} XP</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="student-card lb-aside">
            <h2 className="lb-aside-title">Рейтинг среди курса</h2>
            <ul className="lb-aside-list">
              {COURSE_TOP.map((n) => (
                <li key={n} className="lb-aside-item">
                  <img src="/icons/Standard_avatar.png" alt="" width={36} height={36} className="lb-av" />
                  <span style={{ fontWeight: 700 }}>{n}</span>
                </li>
              ))}
            </ul>
            <hr className="lb-hr" />
            <h2 className="lb-aside-title">Рейтинг среди группы</h2>
            <p className="lb-empty">Нет данных для отображения.</p>
          </aside>
        </div>
      </div>

      <style>{`
        .lb-root { width: 100%; max-width: none; margin: 0; }
        .lb-header {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .lb-title { margin-bottom: 0 !important; }
        .lb-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (min-width: 1024px) {
          .lb-grid {
            grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
            gap: 28px;
          }
        }
        .lb-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .lb-top-card {
          display: grid;
          grid-template-columns: 72px 1fr auto;
          align-items: center;
          gap: 18px;
          padding: 20px 24px;
        }
        .lb-name {
          font-weight: 800;
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lb-xp { font-weight: 900; font-size: 1.1rem; color: #338ff9; }
        .lb-list { padding: 0; overflow: hidden; }
        .lb-row {
          display: grid;
          grid-template-columns: 48px 48px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-bottom: 1px solid var(--qf-border-subtle);
        }
        .lb-row--last { border-bottom: none; }
        .lb-rank-num { font-weight: 800; color: var(--qf-dark-blue); }
        .lb-av { border-radius: 50%; object-fit: cover; }
        .lb-row-name { font-weight: 700; }
        .lb-row-xp { font-weight: 800; color: #338ff9; }
        .lb-aside { width: 100%; }
        .lb-aside-title { font-size: 1rem; font-weight: 800; color: var(--qf-dark-blue); margin: 0 0 16px; }
        .lb-aside-list { list-style: none; padding: 0; margin: 0; }
        .lb-aside-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .lb-hr { border: none; border-top: 1px solid var(--qf-border-subtle); margin: 16px 0; }
        .lb-empty { margin: 0; color: var(--qf-text-muted); font-size: 14px; }
        .lb-medal {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 900;
          font-size: 22px;
          box-shadow: 0 6px 16px rgba(0,0,0,0.12);
        }
      `}</style>
    </div>
  );
}

function Medal({ rank, variant }) {
  const bg =
    variant === 'gold'
      ? 'linear-gradient(145deg, #f6d365, #fda085)'
      : variant === 'silver'
        ? 'linear-gradient(145deg, #e2e8f0, #94a3b8)'
        : 'linear-gradient(145deg, #fdba74, #c2410c)';
  return (
    <div className="lb-medal" style={{ background: bg }} aria-hidden>
      {rank}
    </div>
  );
}
