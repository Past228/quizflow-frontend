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
      <div className="student-page" style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h1 className="student-page-title">ГЛАВНАЯ</h1>

        <div className="home-layout">
          <div className="home-layout__main">
            <section className="student-card">
              <h2 className="home-section-title">Доступные тесты:</h2>
              {loading ? (
                <p style={{ color: '#127ab6' }}>Загрузка…</p>
              ) : displayTests.length === 0 ? (
                <p style={{ color: '#127ab6', marginBottom: 16 }}>
                  Для вашей группы пока нет назначенных тестов. Откройте каталог.
                </p>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {displayTests.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="qf-btn-primary"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => navigate(`/test/${t.id}`)}
                  >
                    {t.title || 'Тест'}
                  </button>
                ))}
                <button
                  type="button"
                  className="qf-btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    background: '#20aeb9',
                  }}
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
                      <span>SP {item.price}</span>
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
                  <img src={u.avatar} alt="" width={40} height={40} style={{ borderRadius: '50%' }} />
                  <span style={{ fontWeight: 700 }}>{u.name}</span>
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
            grid-template-columns: 1fr 300px;
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
        .home-section-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #127ab6;
          margin: 0 0 20px;
          letter-spacing: 0.04em;
        }
        .home-shop-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 16px;
        }
        .home-shop-grid__item {
          border: 2px solid rgba(51, 143, 249, 0.25);
          border-radius: 14px;
          padding: 16px;
          background: #fff;
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
          font-weight: 800;
        }
        .home-shop-grid__gradient {
          font-size: 1.4rem;
          font-weight: 800;
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
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .home-shop-grid__price {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: 700;
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
          border-bottom: 1px solid #eaf4fc;
        }
        .home-leaders__row--last {
          border-bottom: none;
        }
        .home-leaders__footer {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #eaf4fc;
          font-size: 13px;
          font-weight: 700;
          color: #127ab6;
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
