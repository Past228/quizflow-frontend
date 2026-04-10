import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SETTINGS_KEYS as LS } from '../lib/studentSettings';

function readBool(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const [themeOn, setThemeOn] = useState(() => readBool(LS.theme));
  const [incognito, setIncognito] = useState(() => readBool(LS.incognito));
  const [a11y, setA11y] = useState(() => readBool(LS.a11y));

  useEffect(() => {
    document.documentElement.classList.toggle('qf-theme-alt', themeOn);
    try {
      localStorage.setItem(LS.theme, themeOn ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [themeOn]);

  useEffect(() => {
    document.documentElement.classList.toggle('qf-a11y', a11y);
    try {
      localStorage.setItem(LS.a11y, a11y ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [a11y]);

  useEffect(() => {
    try {
      localStorage.setItem(LS.incognito, incognito ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [incognito]);

  return (
    <div className="student-page-wrap">
      <div className="student-page" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="student-page-title student-page-title--accent">НАСТРОЙКИ</h1>

        <section className="student-card settings-card">
          <ToggleRow label="Сменить тему" on={themeOn} onToggle={() => setThemeOn((v) => !v)} />
          <ToggleRow
            label="Режим «Инкогнито» в таблице лидеров"
            on={incognito}
            onToggle={() => setIncognito((v) => !v)}
          />
          <ToggleRow label="Версия для слабовидящих" on={a11y} onToggle={() => setA11y((v) => !v)} />
        </section>

        <div style={{ marginTop: 28 }}>
          <button
            type="button"
            className="qf-btn-primary"
            style={{ background: '#127ab6' }}
            onClick={() => supabase.auth.signOut()}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>

      <style>{`
        .settings-card {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 8px 0;
        }
        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 24px;
          border-bottom: 1px solid #eaf4fc;
        }
        .settings-row:last-child {
          border-bottom: none;
        }
        .settings-label {
          font-weight: 700;
          font-size: 1rem;
          color: #1a202c;
          text-align: right;
          flex: 1;
        }
        .settings-toggle {
          flex-shrink: 0;
          min-width: 72px;
          padding: 10px 16px;
          border: none;
          border-radius: 12px;
          background: #338ff9;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
          transition: filter 0.2s ease, transform 0.15s ease;
        }
        .settings-toggle:hover {
          filter: brightness(1.06);
        }
        .settings-toggle--off {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

function ToggleRow({ label, on, onToggle }) {
  return (
    <div className="settings-row">
      <button type="button" className={'settings-toggle' + (on ? '' : ' settings-toggle--off')} onClick={onToggle}>
        {on ? 'ВКЛ' : 'ВЫКЛ'}
      </button>
      <div className="settings-label">{label}</div>
    </div>
  );
}
