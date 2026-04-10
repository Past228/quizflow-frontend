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
      <div className="student-page settings-page">
        <h1 className="settings-page__title">НАСТРОЙКИ</h1>

        <section className="student-card settings-card">
          <ToggleRow label="Сменить тему" on={themeOn} onToggle={() => setThemeOn((v) => !v)} />
          <ToggleRow
            label="Режим «Инкогнито» в таблице лидеров"
            on={incognito}
            onToggle={() => setIncognito((v) => !v)}
          />
          <ToggleRow label="Версия для слабовидящих" on={a11y} onToggle={() => setA11y((v) => !v)} />
        </section>

        <div className="settings-page__logout-wrap">
          <button
            type="button"
            className="qf-btn-primary settings-page__logout"
            onClick={() => supabase.auth.signOut()}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>

      <style>{`
        .settings-page {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          text-align: center;
        }
        .settings-page__title {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #338ff9;
          margin: 0 0 28px;
          text-align: center;
        }
        .settings-card {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 8px 0;
          text-align: left;
        }
        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 22px 28px;
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
          min-width: 80px;
          padding: 12px 18px;
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
        .settings-page__logout-wrap {
          margin-top: 32px;
          display: flex;
          justify-content: center;
        }
        .settings-page__logout {
          background: #127ab6 !important;
          min-width: 240px;
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
