import { useMemo, useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useTeacherBuildingLeaderboard } from '../hooks/useTeacherBuildingLeaderboard';

const MEDAL_VARIANTS = ['gold', 'silver', 'bronze'];

export default function TeacherLeaderboardPage({ session }) {
  const [q, setQ] = useState('');
  const { all: globalRows, loading: globalLoading } = useLeaderboard(null);
  const { rows: buildingRows, buildingName, loading: buildingLoading } = useTeacherBuildingLeaderboard(
    session?.user?.id
  );

  const loading = globalLoading || buildingLoading;
  const hasRows = globalRows.length > 0;

  const term = q.trim().toLowerCase();
  const top3 = useMemo(() => {
    return globalRows.slice(0, 3).filter((r) => !term || (r.name || '').toLowerCase().includes(term));
  }, [globalRows, term]);
  const rest = useMemo(() => {
    return globalRows.slice(3).filter((r) => !term || (r.name || '').toLowerCase().includes(term));
  }, [globalRows, term]);

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide lb-root">
        <header className="lb-header">
          <h1 className="student-page-title lb-title">ДОСКА ЛИДЕРОВ</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {buildingName && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--qf-font)',
                  color: 'var(--qf-text-muted)',
                  background: 'var(--qf-accent-border-soft, rgba(51,143,249,0.12))',
                  padding: '6px 14px',
                  borderRadius: 999,
                }}
              >
                Ваш корпус: {buildingName}
              </span>
            )}
            <input
              type="search"
              className="qf-search"
              placeholder="Поиск студентов..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск студентов"
            />
          </div>
        </header>

        {loading ? (
          <div className="lb-spinner-wrap">
            <div className="lb-spinner" />
            <p className="lb-spinner-text">Загрузка рейтинга…</p>
          </div>
        ) : !hasRows ? (
          <div className="lb-empty-root">
            <div className="lb-empty-icon">🏆</div>
            <p className="lb-empty-msg">
              Нет студентов с ролью «студент» в системе, либо все включили режим инкогнито.
            </p>
          </div>
        ) : (
          <div className="lb-grid">
            <div className="lb-main">
              <p
                className="lb-scope-hint"
                style={{
                  margin: '0 0 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--qf-text-muted)',
                  fontFamily: 'var(--qf-font)',
                }}
              >
                Общий рейтинг колледжа: все студенты, в том числе с 0 очков.
              </p>
              <>
              {top3.map((row, i) => (
                <div key={row.id} className="student-card lb-top-card">
                  <Medal rank={row.rank} variant={MEDAL_VARIANTS[i]} />
                  <Avatar url={row.avatarUrl} size={52} frame={row.activeFrame} />
                  <div className="lb-name-block">
                    <PlayerName name={row.name} prefix={row.activePrefix} color={row.activeColor} size={18} />
                  </div>
                  <div className="lb-tests-count">{row.testsCompleted} тест.</div>
                  <div className="lb-xp">{row.totalScore} очков</div>
                </div>
              ))}

              {globalRows.length > 3 && (
                <div className="student-card lb-list">
                  {rest.length === 0 ? (
                    <p className="lb-not-found">Студент не найден</p>
                  ) : (
                    rest.map((row, i) => (
                      <div
                        key={row.id}
                        className={['lb-row', i === rest.length - 1 && 'lb-row--last'].filter(Boolean).join(' ')}
                      >
                        <span className="lb-rank-num">{row.rank}</span>
                        <Avatar url={row.avatarUrl} size={40} frame={row.activeFrame} />
                        <PlayerName name={row.name} prefix={row.activePrefix} color={row.activeColor} size={16} />
                        <span className="lb-tests-count">{row.testsCompleted} тест.</span>
                        <span className="lb-row-xp">{row.totalScore} очков</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              </>
            </div>

            <aside className="student-card lb-aside">
              <h2 className="lb-aside-title">
                {buildingName ? `Корпус «${buildingName}»` : 'Ваш корпус'}
              </h2>
              {!buildingName ? (
                <p className="lb-empty">В профиле не указан корпус — справа будет рейтинг вашего корпуса после привязки.</p>
              ) : buildingRows.length === 0 ? (
                <p className="lb-empty">
                  Нет студентов корпуса в списке (проверьте группы и курсы в базе) или все в инкогнито. Студенты с 0 очков
                  здесь тоже должны отображаться при корректных данных.
                </p>
              ) : (
                <ul className="lb-aside-list">
                  {buildingRows.slice(0, 12).map((r) => (
                    <li key={r.id} className="lb-aside-item">
                      <span className="lb-aside-rank">{r.rank}</span>
                      <Avatar url={r.avatarUrl} size={34} frame={r.activeFrame} />
                      <PlayerName name={r.name} prefix={r.activePrefix} color={r.activeColor} size={13} />
                      <span className="lb-aside-score">{r.totalScore} очк.</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="lb-empty" style={{ marginTop: 12, fontSize: 12 }}>
                Слева — общий рейтинг колледжа; справа — топ вашего корпуса (все студенты корпуса, в т.ч. с 0 очков).
              </p>
            </aside>
          </div>
        )}
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
          .lb-grid { grid-template-columns: minmax(0,1fr) minmax(260px,340px); gap: 28px; }
        }
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
        .lb-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .lb-top-card {
          display: grid;
          grid-template-columns: 72px 56px 1fr auto auto;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
        }
        .lb-name-block { min-width: 0; }
        .lb-xp {
          font-weight: var(--qf-fw-black);
          font-size: 18px;
          color: #338ff9;
          font-family: var(--qf-font);
          white-space: nowrap;
        }
        .lb-tests-count {
          font-size: 13px; font-weight: var(--qf-fw-medium);
          color: var(--qf-text-muted); font-family: var(--qf-font);
          white-space: nowrap;
        }
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
        .lb-rank-num {
          font-size: 17px; font-weight: var(--qf-fw-black);
          color: #111; font-family: var(--qf-font);
        }
        .lb-row-xp {
          font-size: 16px; font-weight: var(--qf-fw-black);
          color: #338ff9; font-family: var(--qf-font); white-space: nowrap;
        }
        .lb-av { border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .lb-aside { width: 100%; }
        .lb-aside-title {
          text-align: center; display: block;
          font-size: 16px; font-weight: var(--qf-fw-extrabold);
          font-family: var(--qf-font); color: #111; margin: 0 0 16px;
        }
        .lb-aside-list { list-style: none; padding: 0; margin: 0; }
        .lb-aside-item {
          display: grid;
          grid-template-columns: auto auto 1fr auto;
          align-items: center;
          gap: 6px;
          padding: 7px 10px 7px 0;
          border-bottom: 1px solid var(--qf-border-subtle);
        }
        .lb-aside-item:last-child { border-bottom: none; }
        .lb-aside-rank {
          font-size: 13px; font-weight: var(--qf-fw-black);
          color: #555; font-family: var(--qf-font);
          min-width: 16px; text-align: right;
        }
        .lb-aside-score {
          font-size: 13px; font-weight: var(--qf-fw-black);
          color: #338ff9; font-family: var(--qf-font); white-space: nowrap;
        }
        .lb-empty {
          margin: 0; color: var(--qf-text-muted);
          font-size: 14px; font-weight: var(--qf-fw-medium); font-family: var(--qf-font);
        }
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

function Avatar({ url, size, frame }) {
  const extra = Math.round(size * 0.38);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <img
        src={url || '/icons/Standard_avatar.png'}
        alt=""
        width={size}
        height={size}
        className="lb-av"
        onError={(e) => {
          e.currentTarget.src = '/icons/Standard_avatar.png';
        }}
      />
      {frame?.image_url && (
        <img
          src={frame.image_url}
          alt=""
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: size + extra,
            height: size + extra,
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}

function PlayerName({ name, prefix, color, size }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
      {prefix?.title && (
        <span
          className="qf-prefix-chip"
          style={{
            fontSize: Math.max(10, size - 3),
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {prefix.title}
        </span>
      )}
      <span
        style={{
          fontSize: size,
          fontWeight: 700,
          fontFamily: 'var(--qf-font)',
          color: color?.hex_code || 'var(--qf-text-body)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </span>
  );
}
