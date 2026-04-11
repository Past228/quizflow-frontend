import { useState, useMemo } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useStudentProfile } from '../context/StudentProfileContext';

const MEDAL_VARIANTS = ['gold', 'silver', 'bronze'];

export default function LeaderboardPage() {
  const [q, setQ] = useState('');
  const { profile } = useStudentProfile();
  const { all, groupRanking, loading } = useLeaderboard(profile?.group_id ?? null);

  const top3 = useMemo(() => all.slice(0, 3), [all]);
  const rest = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.slice(3).filter((r) => !term || r.name.toLowerCase().includes(term));
  }, [all, q]);

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

        {loading ? (
          <div className="lb-spinner-wrap">
            <div className="lb-spinner" />
            <p className="lb-spinner-text">Загрузка рейтинга…</p>
          </div>
        ) : all.length === 0 ? (
          <div className="lb-empty-root">
            <div className="lb-empty-icon">🏆</div>
            <p className="lb-empty-msg">
              Пока нет данных для отображения. Пройдите первый тест!
            </p>
          </div>
        ) : (
          <div className="lb-grid">
            {/* ── Main column ── */}
            <div className="lb-main">
              {/* Top-3 podium cards */}
              {top3.map((row, i) => (
                <div
                  key={row.id}
                  className={`student-card lb-top-card${row.id === profile?.id ? ' lb-card--me' : ''}`}
                >
                  <Medal rank={row.rank} variant={MEDAL_VARIANTS[i]} />
                  <Avatar url={row.avatarUrl} size={52} />
                  <div className="lb-name-block">
                    <div className="lb-name">{row.name}</div>
                  </div>
                  <div className="lb-tests-count">{row.testsCompleted} тест.</div>
                  <div className="lb-xp">{row.totalScore} очков</div>
                </div>
              ))}

              {/* Ranked list (rank 4+) */}
              {all.length > 3 && (
                <div className="student-card lb-list">
                  {rest.length === 0 ? (
                    <p className="lb-not-found">Студент не найден</p>
                  ) : (
                    rest.map((row, i) => (
                      <div
                        key={row.id}
                        className={[
                          'lb-row',
                          i === rest.length - 1 && 'lb-row--last',
                          row.id === profile?.id && 'lb-row--me',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <span className="lb-rank-num">{row.rank}</span>
                        <Avatar url={row.avatarUrl} size={40} />
                        <span className="lb-row-name">{row.name}</span>
                        <span className="lb-tests-count">{row.testsCompleted} тест.</span>
                        <span className="lb-row-xp">{row.totalScore} очков</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── Aside: group ranking ── */}
            <aside className="student-card lb-aside">
              <h2 className="lb-aside-title">Рейтинг группы</h2>
              {groupRanking.length === 0 ? (
                <p className="lb-empty">
                  {profile?.group_id
                    ? 'Нет данных для отображения.'
                    : 'Вы не состоите в группе.'}
                </p>
              ) : (
                <ul className="lb-aside-list">
                  {groupRanking.slice(0, 10).map((r) => (
                    <li
                      key={r.id}
                      className={`lb-aside-item${r.id === profile?.id ? ' lb-aside-item--me' : ''}`}
                    >
                      <span className="lb-aside-rank">{r.rank}</span>
                      <Avatar url={r.avatarUrl} size={34} />
                      <span className="lb-aside-name">{r.name}</span>
                      <span className="lb-aside-score">{r.totalScore}</span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </div>

      <style>{`
        /* ── Layout ── */
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
          .lb-grid { grid-template-columns: minmax(0,1fr) minmax(260px,340px); gap: 28px; }
        }

        /* ── Spinner / empty states ── */
        .lb-spinner-wrap {
          display: flex; flex-direction: column; align-items: center;
          padding: 60px 0; gap: 16px; color: var(--qf-text-muted);
        }
        .lb-spinner {
          width: 36px; height: 36px;
          border: 3px solid var(--qf-border-subtle);
          border-top-color: #338ff9;
          border-radius: 50%;
          animation: lb-spin .8s linear infinite;
        }
        @keyframes lb-spin { to { transform: rotate(360deg); } }
        .lb-spinner-text { font-size: 15px; font-family: var(--qf-font); }
        .lb-empty-root {
          display: flex; flex-direction: column; align-items: center;
          padding: 60px 0; gap: 12px; color: var(--qf-text-muted);
        }
        .lb-empty-icon { font-size: 52px; }
        .lb-empty-msg { font-size: 15px; font-family: var(--qf-font); text-align: center; }

        /* ── Main column ── */
        .lb-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

        /* Top-3 cards */
        .lb-top-card {
          display: grid;
          grid-template-columns: 72px 56px 1fr auto auto;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
        }
        .lb-card--me { outline: 2px solid #338ff9; }
        .lb-name-block { min-width: 0; }
        .lb-name {
          font-weight: var(--qf-fw-bold);
          font-size: 18px;
          font-family: var(--qf-font);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .lb-xp {
          font-weight: var(--qf-fw-black);
          font-size: 18px;
          color: #338ff9;
          font-family: var(--qf-font);
          white-space: nowrap;
        }

        /* Tests count chip */
        .lb-tests-count {
          font-size: 13px; font-weight: var(--qf-fw-medium);
          color: var(--qf-text-muted); font-family: var(--qf-font);
          white-space: nowrap;
        }

        /* Ranked list */
        .lb-list { padding: 0; overflow: hidden; }
        .lb-not-found {
          padding: 20px; text-align: center;
          color: var(--qf-text-muted); font-size: 14px; font-family: var(--qf-font);
        }
        .lb-row {
          display: grid;
          grid-template-columns: 48px 44px 1fr auto auto;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-bottom: 1px solid var(--qf-border-subtle);
          transition: background .15s;
        }
        .lb-row:hover { background: #f8faff; }
        .lb-row--last { border-bottom: none; }
        .lb-row--me { background: #eff6ff; }
        .lb-row--me:hover { background: #dbeafe; }
        .lb-rank-num {
          font-size: 17px; font-weight: var(--qf-fw-black);
          color: #111; font-family: var(--qf-font);
        }
        .lb-row-name {
          font-size: 16px; font-weight: var(--qf-fw-bold);
          font-family: var(--qf-font);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .lb-row-xp {
          font-size: 16px; font-weight: var(--qf-fw-black);
          color: #338ff9; font-family: var(--qf-font); white-space: nowrap;
        }

        /* Avatar */
        .lb-av { border-radius: 50%; object-fit: cover; flex-shrink: 0; }

        /* ── Aside ── */
        .lb-aside { width: 100%; }
        .lb-aside-title {
          text-align: center; display: block;
          font-size: 16px; font-weight: var(--qf-fw-extrabold);
          font-family: var(--qf-font); color: #111; margin: 0 0 16px;
        }
        .lb-aside-list { list-style: none; padding: 0; margin: 0; }
        .lb-aside-item {
          display: grid;
          grid-template-columns: 28px 38px 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 7px 0;
          border-bottom: 1px solid var(--qf-border-subtle);
        }
        .lb-aside-item:last-child { border-bottom: none; }
        .lb-aside-item--me { background: #eff6ff; border-radius: 8px; padding: 7px 6px; }
        .lb-aside-rank {
          font-size: 13px; font-weight: var(--qf-fw-black);
          color: #555; font-family: var(--qf-font); text-align: center;
        }
        .lb-aside-name {
          font-size: 14px; font-weight: var(--qf-fw-bold);
          font-family: var(--qf-font);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .lb-aside-score {
          font-size: 13px; font-weight: var(--qf-fw-black);
          color: #338ff9; font-family: var(--qf-font); white-space: nowrap;
        }
        .lb-hr { border: none; border-top: 2px solid var(--qf-border-subtle); margin: 16px 0; }
        .lb-empty {
          margin: 0; color: var(--qf-text-muted);
          font-size: 14px; font-weight: var(--qf-fw-medium); font-family: var(--qf-font);
        }

        /* ── Medal circle ── */
        .lb-medal {
          width: 64px; height: 64px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: var(--qf-fw-black); font-size: 24px;
          font-family: var(--qf-font); font-variant-numeric: tabular-nums;
          box-shadow: 0 6px 16px rgba(0,0,0,.12);
        }
      `}</style>
    </div>
  );
}

/* ── Sub-components ── */

function Medal({ rank, variant }) {
  const bg =
    variant === 'gold'
      ? 'linear-gradient(145deg,#f6d365,#fda085)'
      : variant === 'silver'
        ? 'linear-gradient(145deg,#e2e8f0,#94a3b8)'
        : 'linear-gradient(145deg,#fdba74,#c2410c)';
  return (
    <div className="lb-medal" style={{ background: bg }} aria-hidden>
      {rank}
    </div>
  );
}

function Avatar({ url, size }) {
  return (
    <img
      src={url || '/icons/Standard_avatar.png'}
      alt=""
      width={size}
      height={size}
      className="lb-av"
      onError={(e) => { e.currentTarget.src = '/icons/Standard_avatar.png'; }}
    />
  );
}
