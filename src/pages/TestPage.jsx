import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const DEMO = {
  title: 'ТЕСТ: ОСНОВЫ JS',
  total: 10,
  index: 3,
  question: "Что выведет typeof null?",
  codeHighlight: 'typeof null',
  options: ['object', 'null', 'undefined', 'string'],
  correct: 0,
  timeLeftSec: 19 * 60 + 34,
  healthPct: 100,
  progressPct: 30,
};

export default function TestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [testMeta, setTestMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEMO.timeLeftSec);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!testId || testId.startsWith('demo-')) {
        setTestMeta(null);
        return;
      }
      const { data, error } = await supabase.from('tests').select('id, title, time_limit').eq('id', testId).single();
      if (cancelled) return;
      if (!error && data) setTestMeta(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const title = testMeta?.title ? `ТЕСТ: ${testMeta.title}` : DEMO.title;

  const clock = useMemo(() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [timeLeft]);

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide" style={{ maxWidth: 'min(100%, 1200px)' }}>
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <h1 className="student-page-title" style={{ margin: 0, letterSpacing: '0.06em' }}>
            {title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#ff5959', fontSize: 20 }} aria-hidden>
              ♥
            </span>
            <div style={{ width: 120, height: 10, borderRadius: 999, background: 'rgba(255,89,89,0.2)' }}>
              <div
                style={{
                  width: `${DEMO.healthPct}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: '#ff5959',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontWeight: 800, color: '#ff5959', fontSize: 13 }}>{DEMO.healthPct}%</span>
          </div>
        </header>

        <div className="qf-progress" style={{ marginBottom: 22, height: 14 }}>
          <div className="qf-progress__fill" style={{ width: `${DEMO.progressPct}%` }} />
        </div>

        <section className="student-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              height: 44,
              background: 'rgba(51, 143, 249, 0.12)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '62%',
                background: '#338ff9',
                borderRadius: '0 999px 999px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                letterSpacing: '0.06em',
              }}
            >
              {clock}
            </div>
          </div>

          <div style={{ padding: '28px 28px 32px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#127ab6' }}>
              Вопрос {DEMO.index} из {DEMO.total}:
            </p>
            <p style={{ margin: '0 0 18px', fontSize: '1.2rem', lineHeight: 1.5, color: '#1a202c' }}>
              Что выведет <code style={{ color: '#20aeb9', fontWeight: 700 }}>{DEMO.codeHighlight}</code>?
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 14,
              }}
            >
              {DEMO.options.map((opt, i) => {
                const isSel = selected === i;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelected(i)}
                    style={{
                      padding: '18px 16px',
                      borderRadius: 14,
                      border: isSel ? '2px solid #338ff9' : '2px solid #cbd5e0',
                      background: isSel ? '#338ff9' : '#fff',
                      color: isSel ? '#fff' : '#1a202c',
                      fontWeight: 700,
                      fontSize: '1.08rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <button type="button" className="qf-btn-primary" onClick={() => navigate(-1)}>
                Назад
              </button>
              <button
                type="button"
                className="qf-btn-primary"
                style={{ background: '#20aeb9' }}
                onClick={() => navigate('/catalog')}
              >
                К каталогу
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
