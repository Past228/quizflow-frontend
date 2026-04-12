import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentProfile } from '../context/StudentProfileContext';
import { useStudentTests } from '../hooks/useStudentTests';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { supabase } from '../lib/supabaseClient';

const BONUS_GLYPH = { attempt: '↻', hint: '💡', skip: '?' };

export default function HomePage() {
  const navigate = useNavigate();
  const { groupId, loading: profileLoading } = useStudentProfile();
  const { tests, loading: testsLoading } = useStudentTests(groupId);
  const { all: leaders, loading: leadersLoading } = useLeaderboard(groupId);

  const [shopItems, setShopItems] = useState([]);
  const [shopPreviewLoading, setShopPreviewLoading] = useState(true);

  useEffect(() => {
    loadShopPreview();
  }, []);

  async function loadShopPreview() {
    setShopPreviewLoading(true);
    try {
      const [frameRes, colorRes, prefixRes, bonusRes] = await Promise.all([
        supabase.from('items_frames').select('id, name, image_url, price').order('price').limit(1),
        supabase.from('items_name_colors').select('id, name, hex_code, price').order('price').limit(1),
        supabase.from('items_prefixes').select('id, title, price').order('price').limit(1),
        supabase.from('shop_bonuses').select('id, name, price').order('price').limit(1),
      ]);
      const items = [];
      if (frameRes.data?.[0])  items.push({ type: 'frame',      ...frameRes.data[0] });
      if (colorRes.data?.[0])  items.push({ type: 'name_color', ...colorRes.data[0] });
      if (prefixRes.data?.[0]) items.push({ type: 'prefix',     ...prefixRes.data[0] });
      if (bonusRes.data?.[0])  items.push({ type: 'bonus',      ...bonusRes.data[0] });
      setShopItems(items);
    } catch (err) {
      console.error('Shop preview load error:', err);
    } finally {
      setShopPreviewLoading(false);
    }
  }

  function renderShopPreview(item) {
    if (item.type === 'frame') {
      return (
        <img
          src={item.image_url}
          alt={item.name}
          style={{ width: 56, height: 56, objectFit: 'contain' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      );
    }
    if (item.type === 'name_color') {
      return (
        <span style={{ color: item.hex_code, fontWeight: 900, fontSize: '1.4rem', fontFamily: 'var(--qf-font)' }}>
          Иван
        </span>
      );
    }
    if (item.type === 'prefix') {
      return (
        <span style={{ fontWeight: 700, color: 'var(--qf-bright-blue)', fontSize: '1.2rem', fontFamily: 'var(--qf-font)' }}>
          {item.title}
        </span>
      );
    }
    if (item.type === 'bonus') {
      return (
        <span style={{ fontSize: '2.4rem', lineHeight: 1 }} aria-hidden>
          {BONUS_GLYPH[item.id] || '★'}
        </span>
      );
    }
    return null;
  }

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
                <p style={{ color: 'var(--qf-text-body)' }}>Загрузка…</p>
              ) : displayTests.length === 0 ? (
                <p style={{ color: 'var(--qf-text-body)', marginBottom: 16 }}>
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
              {shopPreviewLoading ? (
                <p style={{ color: '#9ca3af', fontFamily: 'var(--qf-font)', fontSize: 14 }}>Загрузка…</p>
              ) : (
                <div className="home-shop-grid">
                  {shopItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate('/shop')}
                      className="home-shop-grid__item"
                    >
                      <div className="home-shop-grid__preview">
                        {renderShopPreview(item)}
                      </div>
                      <div className="home-shop-grid__title">{item.name || item.title}</div>
                      <div className="home-shop-grid__price">
                        <img src="/icons/sp_coins.png" alt="" width={18} height={18} style={{ verticalAlign: 'middle' }} />
                        <span className="home-shop-grid__price-txt">{item.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

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
                    {/* Avatar with optional frame */}
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
                    {/* Prefix + colored name */}
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
          color: var(--qf-text-body);
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
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          border: 2px solid var(--qf-accent-border-soft);
          border-radius: 14px;
          padding: 16px;
          background: var(--qf-card);
          color: var(--qf-text-body);
          cursor: pointer;
          text-align: center;
          transition: box-shadow 0.2s ease, color 0.2s ease, background-color 0.2s ease;
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
          color: var(--qf-text-body);
          font-family: var(--qf-font);
        }
        .home-shop-grid__price {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: var(--qf-fw-semibold);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
        }
        .home-shop-grid__price-txt {
          font-weight: var(--qf-fw-semibold);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
          display: inline-block;
          vertical-align: middle;
          line-height: 1;
          transform: translateY(1.2px);
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
        .home-leaders__row--last {
          border-bottom: none;
        }
        .home-leaders__name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 16px;
          font-weight: var(--qf-fw-bold);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
        }
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
      `}</style>
    </div>
  );
}
