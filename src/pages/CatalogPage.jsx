import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentProfile } from '../context/StudentProfileContext';
import { useStudentTests } from '../hooks/useStudentTests';

const DEMO_TESTS = [
  { id: 'demo-js', title: 'ОСНОВЫ JAVASCRIPT', level: 'Средний', time: '30 мин', tag: 'JS' },
  { id: 'demo-rv', title: 'REACT & VUE.JS', level: 'Сложный', time: '40 мин', tag: 'RV' },
  { id: 'demo-db', title: 'БАЗЫ ДАННЫХ', level: 'Средний', time: '30 мин', tag: 'DB' },
  { id: 'demo-html', title: 'HTML', level: 'Легкий', time: '20 мин', tag: 'H5' },
  { id: 'demo-css', title: 'CSS', level: 'Легкий', time: '10 мин', tag: 'CSS' },
  { id: 'demo-py', title: 'PYTHON', level: 'Легкий', time: '20 мин', tag: 'PY' },
];

function levelForTest(t) {
  const q = t.questions_count || 0;
  if (q <= 5) return 'Легкий';
  if (q <= 15) return 'Средний';
  return 'Сложный';
}

export default function CatalogPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { groupId, loading: profileLoading } = useStudentProfile();
  const { tests, loading: testsLoading } = useStudentTests(groupId);

  const rows = useMemo(() => {
    const fromDb = tests.map((t) => ({
      id: String(t.id),
      title: (t.title || 'Тест').toUpperCase(),
      level: levelForTest(t),
      time: t.time_limit ? `${t.time_limit} мин` : '—',
      tag: '★',
    }));
    const merged = fromDb.length ? fromDb : DEMO_TESTS;
    const q = query.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((x) => x.title.toLowerCase().includes(q));
  }, [tests, query]);

  const loading = profileLoading || testsLoading;

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide">
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <h1 className="student-page-title" style={{ marginBottom: 0 }}>
            КАТАЛОГ ТЕСТОВ
          </h1>
          <input
            type="search"
            className="qf-search"
            placeholder="Поиск тестов..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск тестов"
          />
        </header>

        {loading ? 'Загрузка…' : null}
        {!loading && tests.length === 0 ? (
          <p style={{ color: 'var(--qf-dark-blue)', marginBottom: 16 }}>
            Показаны демонстрационные карточки. Когда преподаватель назначит тесты группе, здесь появятся реальные
            данные.
          </p>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: 22,
          }}
        >
          {rows.map((card) => (
            <button
              key={card.id}
              type="button"
              className="student-card"
              onClick={() => navigate(`/test/${card.id}`)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                border: 'none',
                padding: '22px 24px',
                transition: 'transform 0.15s ease, box-shadow 0.2s ease',
              }}
            >
              <div
                className="qf-title-test"
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  marginTop: 10,
                  marginBottom: 20,
                  color: 'var(--qf-text-body)',
                }}
              >
                {card.title}
              </div>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--qf-text-muted)', marginBottom: 12 }}>
                Уровень: {card.level}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--qf-text-muted)' }}>
                  Время: {card.time}
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    width: 85,
                    height: 85,
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, #338ff9, #20aeb9)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--qf-font)',
                  }}
                >
                  {card.tag}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
