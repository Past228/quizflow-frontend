import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentProfile } from '../context/StudentProfileContext';
import { useStudentTests } from '../hooks/useStudentTests';

function levelForTest(t) {
  const q = t.questions_count || 0;
  if (q <= 5) return 'Легкий';
  if (q <= 15) return 'Средний';
  return 'Сложный';
}

export default function CatalogPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const { groupId, profile, loading: profileLoading } = useStudentProfile();
  const { tests, loading: testsLoading } = useStudentTests(groupId);
  const extraAttempts = profile?.bonus_extra_attempt_count || 0;

  const rows = useMemo(() => {
    const now = Date.now();
    const mapped = tests.map((t) => ({
      id: String(t.id),
      title: (t.title || 'Тест').toUpperCase(),
      level: levelForTest(t),
      time: t.time_limit_minutes ? `${t.time_limit_minutes} мин` : '—',
      attempts: t.attempts_allowed || 1,
      createdAt: t.created_at ? new Date(t.created_at) : null,
      tag: '★',
    }));
    const filteredByDate = mapped.filter((x) => {
      if (!x.createdAt || dateFilter === 'all') return true;
      const ageMs = now - x.createdAt.getTime();
      if (dateFilter === 'week') return ageMs <= 7 * 24 * 60 * 60 * 1000;
      if (dateFilter === 'month') return ageMs <= 30 * 24 * 60 * 60 * 1000;
      return true;
    });
    filteredByDate.sort((a, b) => {
      if (dateFilter === 'oldest') return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    });
    const q = query.trim().toLowerCase();
    if (!q) return filteredByDate;
    return filteredByDate.filter((x) => x.title.toLowerCase().includes(q));
  }, [tests, query, dateFilter]);

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
          <select
            className="qf-search"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Фильтр тестов по дате"
            style={{ maxWidth: 260 }}
          >
            <option value="all">Все даты</option>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="week">За 7 дней</option>
            <option value="month">За 30 дней</option>
          </select>
        </header>

        <div style={{ marginBottom: 16, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', fontWeight: 600 }}>
          Доп. попытка: ↻ {extraAttempts}
        </div>

        {loading && (
          <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', fontSize: 16 }}>
            Загрузка…
          </p>
        )}

        {!loading && rows.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 24px',
              color: 'var(--qf-text-muted)',
              fontFamily: 'var(--qf-font)',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--qf-text-body)' }}>
              Нет доступных тестов
            </div>
            <div style={{ fontSize: 15 }}>
              {groupId
                ? 'Преподаватель пока не назначил тесты вашей группе.'
                : 'Вы не состоите ни в одной учебной группе.'}
            </div>
          </div>
        )}

        {!loading && rows.length > 0 && (
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
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
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

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--qf-text-muted)', marginBottom: 4 }}>
                    Уровень: {card.level}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--qf-text-muted)', marginBottom: 14 }}>
                    Время: {card.time}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--qf-text-muted)', marginBottom: 12 }}>
                    Попыток: {card.attempts}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 85,
                        height: 85,
                        borderRadius: 18,
                        background: 'linear-gradient(135deg, #338ff9, #20aeb9)',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: 16,
                        fontFamily: 'var(--qf-font)',
                      }}
                    >
                      {card.tag}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
