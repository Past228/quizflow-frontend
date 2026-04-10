import { useNavigate } from 'react-router-dom';
import { useStudentProfile } from '../context/StudentProfileContext';
import { useStudentTests } from '../hooks/useStudentTests';

const LEADERS = [
  { name: 'Иван Р.', avatar: '/icons/Men_avatar.png' },
  { name: 'Анна С.', avatar: '/icons/Women_avatar.png' },
  { name: 'Петр В.', avatar: '/icons/Boy_avatar.png' },
];

const SHOP_PREVIEW = [
  { title: 'Неоновая рамка', price: 100, accent: '#ff5959' },
  { title: 'Цветное имя', price: 50, label: 'Иван' },
  { title: 'Пропуск вопроса', price: 100, glyph: '?' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { groupId, loading: profileLoading } = useStudentProfile();
  const { tests, loading: testsLoading } = useStudentTests(groupId);

  const displayTests = tests.slice(0, 3);
  const loading = profileLoading || testsLoading;

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide">
        <h1 className="student-page-title">ГЛАВНАЯ</h1>

        <div className="home-layout">
          <div className="home-layout__main">
            <section className="student-card">
              <h2 className="home-section-title">Доступные тесты:</h2>
              {loading ? (
                <p style={{ color: '#000' }}>Загрузка…</p>
              ) : displayTests.length === 0 ? (
                <p style={{ color: '#000', marginBottom: 16 }}>
                  Для вашей группы пока нет назначенных тестов. Откройте каталог.
                </p>
              ) : null}
              <div className="home-tests-actions">
                {displayTests.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="qf-btn-primary home-tests-actions__btn"
                    onClick={() => navigate(`/test/${t.id}`)}
                  >
                    {t.title || 'Тест'}
                  </button>
                ))}
                <button
                  type="button"
                  className="qf-btn-primary home-tests-actions__btn home-tests-actions__btn--catalog"
                  onClick={() => navigate('/catalog')}
                >
                  Каталог тестов
                </button>
              </div>
            </section>

            <section className="student-card">
              <h2 className="home-section-title">Магазин предметов:</h2>
              <div className="home-shop-grid">
                {SHOP_PREVIEW.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => navigate('/shop')}
                    className="home-shop-grid__item"
                  >
                    <div className="home-shop-grid__preview">
                      {item.glyph ? (
                        <span className="home-shop-grid__glyph">{item.glyph}</span>
                      ) : item.label ? (
                        <span className="home-shop-grid__gradient">{item.label}</span>
                      ) : (
                        <span
                          className="home-shop-grid__neon"
                          style={{ boxShadow: `0 0 0 4px ${item.accent}, 0 0 24px ${item.accent}` }}
                        />
                      )}
                    </div>
                    <div className="home-shop-grid__title">{item.title}</div>
                    <div className="home-shop-grid__price">
                      <img src="/icons/sp_coins.png" alt="" width={18} height={18} />
                      <span className="home-shop-grid__price-txt">
                        SP <span className="qf-num">{item.price}</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="student-card home-layout__aside">
            <h2 className="home-section-title">Лидеры</h2>
            <ul className="home-leaders">
              {LEADERS.map((u, i) => (
                <li key={u.name} className={i < LEADERS.length - 1 ? 'home-leaders__row' : 'home-leaders__row home-leaders__row--last'}>
                  <img src={u.avatar} alt="" width={48} height={48} style={{ borderRadius: '50%' }} />
                  <span className="home-leaders__name">{u.name}</span>
                </li>
              ))}
            </ul>
            <div className="home-leaders__footer">Рейтинг среди курса</div>
            <button type="button" className="qf-btn-primary home-leaders__btn" onClick={() => navigate('/leaderboard')}>
              Доска лидеров
            </button>
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
        .home-layout__aside {
          width: 100%;
        }
        .home-tests-actions {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        @media (min-width: 900px) {
          .home-tests-actions {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 14px;
          }
          .home-tests-actions__btn {
            flex: 1 1 calc(25% - 12px);
            min-width: min(100%, 200px);
            justify-content: center;
          }
        }
        .home-tests-actions__btn--catalog {
          background: #20aeb9 !important;
        }
        .home-section-title {
          font-size: 24px;
          font-weight: var(--qf-fw-bold);
          font-family: var(--qf-font);
          color: #000;
          margin: 0 0 22px;
          letter-spacing: 0.04em;
        }
        .home-shop-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        @media (min-width: 900px) {
          .home-shop-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        .home-shop-grid__item {
          border: 2px solid var(--qf-accent-border-soft);
          border-radius: 14px;
          padding: 16px;
          background: var(--qf-card);
          cursor: pointer;
          text-align: center;
          transition: box-shadow 0.2s ease;
        }
        .home-shop-grid__item:hover {
          box-shadow: 0 8px 24px rgba(18, 122, 182, 0.12);
        }
        .home-shop-grid__preview {
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }
        .home-shop-grid__glyph {
          font-size: 48px;
          font-weight: var(--qf-fw-black);
          font-family: var(--qf-font);
        }
        .home-shop-grid__gradient {
          font-size: 1.4rem;
          font-weight: var(--qf-fw-black);
          font-family: var(--qf-font);
          background: linear-gradient(90deg, #338ff9, #20aeb9);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .home-shop-grid__neon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: inline-block;
        }
        .home-shop-grid__title {
          font-weight: var(--qf-fw-medium);
          font-size: 16px;
          margin-bottom: 8px;
          color: #000;
          font-family: var(--qf-font);
        }
        .home-shop-grid__price {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: var(--qf-fw-semibold);
          font-family: var(--qf-font);
        }
        .home-shop-grid__price-txt {
          font-weight: var(--qf-fw-semibold);
        }
        .home-leaders__name {
          font-size: 18px;
          font-weight: var(--qf-fw-bold);
          font-family: var(--qf-font);
          color: #000;
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
          border-bottom: 1px solid var(--qf-border-subtle);
        }
        .home-leaders__row--last {
          border-bottom: none;
        }
        .home-leaders__footer {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--qf-border-subtle);
          font-size: 14px;
          font-weight: var(--qf-fw-medium);
          font-family: var(--qf-font);
          color: #000;
          text-align: center;
        }
        .home-leaders__btn {
          width: 100%;
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
}
