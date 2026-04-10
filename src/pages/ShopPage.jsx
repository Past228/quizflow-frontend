const NEON = ['#ff5959', '#338ff9', '#20aeb9'];
const NAMES = ['#e11d48', '#338ff9', '#ea580c'];
const PREFIXES = ['Крутой', 'Лучший', 'Умный'];

const ROWS = [
  {
    title: 'Неоновая рамка',
    price: 100,
    kind: 'neon',
  },
  {
    title: 'Цветное имя',
    price: 50,
    kind: 'name',
  },
  {
    title: 'Приписка к имени',
    price: 25,
    kind: 'prefix',
  },
  {
    title: 'Пропуск вопроса',
    price: 100,
    kind: 'skip',
  },
  {
    title: 'Подсказка',
    price: 50,
    kind: 'hint',
  },
  {
    title: 'Доп. попытка',
    price: 75,
    kind: 'retry',
  },
];

export default function ShopPage() {
  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide">
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 8,
          }}
        >
          <h1 className="student-page-title" style={{ marginBottom: 0 }}>
            МАГАЗИН ПРЕДМЕТОВ
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
            <span style={{ color: 'var(--qf-text-body)' }}>Монеты</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <img src="/icons/sp_coins.png" alt="" width={28} height={28} />
              <span style={{ fontSize: '1.2rem' }}>250</span>
            </span>
          </div>
        </header>
        <div className="shop-page-grid">
          {ROWS.map((item) => (
            <article key={item.title} className="student-card shop-card">
              <div className="shop-card__preview">{renderPreview(item)}</div>
              <h2 className="shop-card__title">{item.title}</h2>
              <div className="shop-card__price">
                <img src="/icons/sp_coins.png" alt="" width={20} height={20} />
                <span>SP {item.price}</span>
              </div>
              <button type="button" className="qf-btn-primary shop-card__btn">
                Купить
              </button>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .shop-page-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 22px;
          width: 100%;
        }
        @media (max-width: 1100px) {
          .shop-page-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 520px) {
          .shop-page-grid {
            grid-template-columns: 1fr;
          }
        }
        .shop-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 22px 18px 20px;
          min-height: 260px;
        }
        .shop-card__preview {
          min-height: 100px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .shop-card__title {
          font-size: 0.95rem;
          font-weight: 800;
          margin: 0 0 12px;
          color: var(--qf-text-body);
        }
        .shop-card__price {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 800;
          margin-bottom: 16px;
        }
        .shop-card__btn {
          width: 100%;
          margin-top: auto;
        }
        .shop-neon-row {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .shop-neon-dot {
          width: 40px;
          height: 40px;
          border-radius: 50%;
        }
        .shop-name-row {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .shop-name {
          font-weight: 900;
          font-size: 1.1rem;
        }
        .shop-prefix {
          font-weight: 800;
          color: var(--qf-dark-blue);
          font-size: 1rem;
        }
        .shop-glyph {
          font-size: 56px;
          font-weight: 900;
          color: var(--qf-text-body);
        }
      `}</style>
    </div>
  );
}

function renderPreview(item) {
  switch (item.kind) {
    case 'neon':
      return (
        <div className="shop-neon-row" aria-hidden>
          {NEON.map((c) => (
            <span key={c} className="shop-neon-dot" style={{ boxShadow: `0 0 0 3px ${c}, 0 0 20px ${c}` }} />
          ))}
        </div>
      );
    case 'name':
      return (
        <div className="shop-name-row">
          {NAMES.map((c) => (
            <span key={c} className="shop-name" style={{ color: c }}>
              Иван
            </span>
          ))}
        </div>
      );
    case 'prefix':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PREFIXES.map((p) => (
            <span key={p} className="shop-prefix">
              {p}
            </span>
          ))}
        </div>
      );
    case 'skip':
      return <span className="shop-glyph">?</span>;
    case 'hint':
      return <span style={{ fontSize: 48 }} aria-hidden>💡</span>;
    case 'retry':
      return <span style={{ fontSize: 44, color: '#338ff9' }} aria-hidden>↻</span>;
    default:
      return null;
  }
}
