import { useEffect, useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { supabase } from '../lib/supabaseClient';

export default function TeacherHomePage({ session, onTabChange }) {
  const [tests, setTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const { all: leaders, loading: leadersLoading } = useLeaderboard(null);

  useEffect(() => {
    loadTeacherTests();
  }, [session]);

  async function loadTeacherTests() {
    setTestsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('id, title, description, is_active, questions_count, created_at')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTests(data || []);
    } catch (err) {
      console.error('Failed to load teacher tests:', err);
    } finally {
      setTestsLoading(false);
    }
  }

  const activeTests = tests.filter((t) => t.is_active);
  const displayTests = tests.slice(0, 6);

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide">
        <h1 className="student-page-title">ГЛАВНАЯ</h1>

        <div className="home-layout">
          <div className="home-layout__main">
            {/* My Tests */}
            <section className="student-card">
              <h2 className="home-section-title">Мои тесты</h2>
              {testsLoading ? (
                <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Загрузка…</p>
              ) : displayTests.length === 0 ? (
                <p style={{ color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)', marginBottom: 16 }}>
                  У вас пока нет созданных тестов.
                </p>
              ) : (
                <div className="tch-tests-grid">
                  {displayTests.map((t) => (
                    <div key={t.id} className="tch-test-card">
                      <div className="tch-test-card__title">{t.title || 'Без названия'}</div>
                      <div className="tch-test-card__meta">
                        <span>{t.questions_count || 0} вопр.</span>
                        <span className={t.is_active ? 'tch-test-card__badge--on' : 'tch-test-card__badge--off'}>
                          {t.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="qf-btn-primary home-leaders__btn"
                onClick={() => onTabChange('tests')}
              >
                Управление тестами
              </button>
            </section>

            {/* Stats */}
            <section className="student-card">
              <h2 className="home-section-title">Статистика</h2>
              <div className="tch-stats-row">
                <div className="tch-stat-block">
                  <div className="tch-stat-num">{tests.length}</div>
                  <div className="tch-stat-label">Всего тестов</div>
                </div>
                <div className="tch-stat-block">
                  <div className="tch-stat-num">{activeTests.length}</div>
                  <div className="tch-stat-label">Активных тестов</div>
                </div>
              </div>
            </section>
          </div>

          {/* Leaderboard aside — same as student */}
          <aside className="student-card home-layout__aside">
            <h2 className="home-section-title">Лидеры</h2>
            {leadersLoading ? (
              <div className="home-leaders__loading">Загрузка…</div>
            ) : leaders.length === 0 ? (
              <p className="home-leaders__empty">Нет данных</p>
            ) : (
              <ul className="home-leaders">
                {leaders.slice(0, 3).map((u, i, arr) => (
                  <li
                    key={u.id}
                    className={i < arr.length - 1 ? 'home-leaders__row' : 'home-leaders__row home-leaders__row--last'}
                  >
                    <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                      <img
                        src={u.avatarUrl || '/icons/Standard_avatar.png'}
                        alt=""
                        width={48}
                        height={48}
                        style={{ borderRadius: '50%', objectFit: 'cover', width: 48, height: 48 }}
                        onError={(e) => { e.currentTarget.src = '/icons/Standard_avatar.png'; }}
                      />
                      {u.activeFrame?.image_url && (
                        <img
                          src={u.activeFrame.image_url}
                          alt=""
                          style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%,-50%)',
                            width: 66, height: 66,
                            objectFit: 'contain', pointerEvents: 'none', zIndex: 1,
                          }}
                        />
                      )}
                    </div>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                      {u.activePrefix?.title && (
                        <span
                          className="qf-prefix-chip"
                          style={{
                            fontSize: 11, fontWeight: 700, padding: '1px 7px',
                            borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          {u.activePrefix.title}
                        </span>
                      )}
                      <span style={{
                        fontSize: 16, fontWeight: 700, fontFamily: 'var(--qf-font)',
                        color: u.activeColor?.hex_code || 'var(--qf-text-body)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {u.name}
                      </span>
                    </span>
                    <span className="home-leaders__score">{u.totalScore} очк.</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>

      <style>{`
        .home-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (min-width: 1024px) {
          .home-layout {
            grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
            gap: 28px;
          }
        }
        .home-layout__main {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-width: 0;
        }
        .home-layout__aside { width: 100%; }
        .home-section-title {
          font-size: 24px;
          font-weight: var(--qf-fw-bold);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
          margin: 0 0 22px;
          letter-spacing: 0.04em;
        }
        .home-leaders {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .home-leaders__row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 2px solid var(--qf-border-subtle, #e5e7eb);
        }
        .home-leaders__row--last { border-bottom: none; }
        .home-leaders__score {
          font-size: 14px;
          font-weight: var(--qf-fw-black);
          font-family: var(--qf-font);
          color: #338ff9;
          white-space: nowrap;
        }
        .home-leaders__loading,
        .home-leaders__empty {
          font-size: 14px;
          color: var(--qf-text-muted);
          font-family: var(--qf-font);
          padding: 8px 0;
        }
        .home-leaders__btn {
          width: 100%;
          margin-top: 16px;
        }

        /* Teacher test cards */
        .tch-tests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 4px;
        }
        .tch-test-card {
          border: 2px solid var(--qf-accent-border-soft);
          border-radius: 14px;
          padding: 18px 16px;
          background: var(--qf-card);
          transition: box-shadow 0.2s ease, background-color 0.25s ease;
        }
        .tch-test-card:hover {
          box-shadow: 0 6px 18px rgba(18, 122, 182, 0.1);
        }
        .tch-test-card__title {
          font-size: 16px;
          font-weight: var(--qf-fw-bold, 700);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
          margin-bottom: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tch-test-card__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          font-family: var(--qf-font);
          color: var(--qf-text-muted);
          font-weight: 600;
        }
        .tch-test-card__badge--on {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }
        .tch-test-card__badge--off {
          background: rgba(148, 163, 184, 0.15);
          color: var(--qf-text-muted);
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        /* Teacher stats */
        .tch-stats-row {
          display: flex;
          gap: 20px;
        }
        .tch-stat-block {
          flex: 1;
          text-align: center;
          padding: 18px 12px;
          border: 2px solid var(--qf-accent-border-soft);
          border-radius: 14px;
          background: var(--qf-card);
          transition: background-color 0.25s ease;
        }
        .tch-stat-num {
          font-size: 32px;
          font-weight: var(--qf-fw-black, 900);
          font-family: var(--qf-font);
          color: var(--qf-bright-blue);
          font-variant-numeric: tabular-nums;
        }
        .tch-stat-label {
          font-size: 14px;
          font-weight: 600;
          font-family: var(--qf-font);
          color: var(--qf-text-muted);
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
