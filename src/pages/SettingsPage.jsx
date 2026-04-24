import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStudentProfile } from '../context/StudentProfileContext';
import { SETTINGS_KEYS as LS } from '../lib/studentSettings';

function readBool(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const { profile, refreshProfile } = useStudentProfile();
  const [themeOn, setThemeOn] = useState(() => readBool(LS.theme));
  const [incognito, setIncognito] = useState(() => readBool(LS.incognito));
  const [a11y, setA11y] = useState(() => readBool(LS.a11y));
  const incognitoSynced = useRef(false);

  // Sync initial incognito value from DB once profile loads
  useEffect(() => {
    if (profile && !incognitoSynced.current) {
      incognitoSynced.current = true;
      const dbVal = !!profile.incognito_mode;
      setIncognito(dbVal);
      try { localStorage.setItem(LS.incognito, dbVal ? '1' : '0'); } catch { /* ignore */ }
    }
  }, [profile]);

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

  async function handleIncognitoToggle() {
    const next = !incognito;
    setIncognito(next);
    try {
      localStorage.setItem(LS.incognito, next ? '1' : '0');
    } catch { /* ignore */ }
    if (profile?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ incognito_mode: next })
        .eq('id', profile.id);
      if (error) console.error('Failed to update incognito_mode:', error);
      else refreshProfile();
    }
  }

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide settings-page">
        <h1 className="settings-page__title">НАСТРОЙКИ</h1>

        <section className="student-card settings-card">
          <ThemeToggleRow on={themeOn} onToggle={() => setThemeOn((v) => !v)} />
          <ToggleRow
            label="Режим «Инкогнито» в таблице лидеров"
            on={incognito}
            onToggle={handleIncognitoToggle}
          />
          <A11yToggleRow on={a11y} onToggle={() => setA11y((v) => !v)} />
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
          max-width: min(960px, 100%);
          margin: 0 auto;
          text-align: center;
        }
        .settings-page__title {
          font-size: 40px;
          font-weight: var(--qf-fw-black);
          font-family: var(--qf-font);
          letter-spacing: 0.06em;
          color: var(--qf-bright-blue);
          margin: 0 0 32px;
          text-align: justify;
        }
        .settings-row--a11y {
          flex-wrap: wrap;
          align-items: flex-start;
        }
        @media (min-width: 600px) {
          .settings-row--a11y {
            flex-wrap: nowrap;
            align-items: center;
          }
        }
        .settings-a11y-stack {
          flex: 1;
          min-width: 0;
          text-align: left;
        }
        .settings-a11y-desc {
          margin: 10px 0 0;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.5;
          color: var(--qf-text-muted);
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
          gap: 28px;
          padding: 26px 32px;
          border-bottom: 1px solid var(--qf-border-subtle);
        }
        .settings-row:last-child {
          border-bottom: none;
        }
        .settings-label {
          font-weight: var(--qf-fw-medium);
          font-size: 20px;
          font-family: var(--qf-font);
          color: var(--qf-text-body);
          text-align: right;
          flex: 1;
        }
        .settings-row--theme {
          gap: 20px;
        }
        .settings-label--theme {
          text-align: left;
        }
        .settings-switch {
          position: relative;
          width: 54px;
          height: 30px;
          flex-shrink: 0;
          padding: 0;
          border: none;
          border-radius: 999px;
          background: #94a3b8;
          cursor: pointer;
          transition: background 0.22s ease, box-shadow 0.2s ease;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.12);
        }
        .settings-switch:hover {
          filter: brightness(1.05);
        }
        .settings-switch:focus-visible {
          outline: none;
          box-shadow:
            inset 0 1px 3px rgba(0, 0, 0, 0.12),
            0 0 0 3px rgba(51, 143, 249, 0.35);
        }
        .settings-switch--on {
          background: linear-gradient(135deg, #338ff9 0%, #127ab6 100%);
          box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
        }
        .settings-switch__thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .settings-switch--on .settings-switch__thumb {
          transform: translateX(24px);
        }
        .settings-toggle {
          flex-shrink: 0;
          min-width: 88px;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          background: #338ff9;
          color: #fff;
          font-family: var(--qf-font);
          font-weight: var(--qf-fw-bold);
          font-size: 20px;
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
          background: var(--qf-dark-blue) !important;
          min-width: 240px;
        }
        html.qf-theme-alt .settings-page__logout {
          background: linear-gradient(135deg, #4f8fe0, #1e4f7a) !important;
        }
        /* Switch track — off state matches the new muted border palette */
        html.qf-theme-alt .settings-switch:not(.settings-switch--on) {
          background: #3d5065;
        }
        /* A11y mode: larger row padding and text for better readability */
        html.qf-a11y .settings-row {
          padding: 30px 32px;
        }
        html.qf-a11y .settings-label {
          font-size: 22px;
          font-weight: var(--qf-fw-semibold);
        }
        html.qf-a11y .settings-switch {
          width: 62px;
          height: 36px;
        }
        html.qf-a11y .settings-switch__thumb {
          width: 28px;
          height: 28px;
          top: 4px;
          left: 4px;
        }
        html.qf-a11y .settings-switch--on .settings-switch__thumb {
          transform: translateX(26px);
        }
        html.qf-a11y .settings-toggle {
          min-height: 52px;
          font-size: 22px;
          padding: 14px 24px;
        }
        html.qf-a11y .settings-a11y-desc {
          font-size: 16px;
          color: var(--qf-text-body);
        }
      `}</style>
    </div>
  );
}

function ThemeToggleRow({ on, onToggle }) {
  return (
    <div className="settings-row settings-row--theme">
      <div className="settings-label settings-label--theme">Сменить тему</div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Тёмная тема: переключатель"
        className={'settings-switch' + (on ? ' settings-switch--on' : '')}
        onClick={onToggle}
      >
        <span className="settings-switch__thumb" aria-hidden />
      </button>
    </div>
  );
}

function ToggleRow({ label, on, onToggle }) {
  return (
    <div className="settings-row settings-row--theme">
      <div className="settings-label settings-label--theme">{label}</div>
      <button type="button" className={'settings-toggle' + (on ? '' : ' settings-toggle--off')} onClick={onToggle}>
        {on ? 'ВКЛ' : 'ВЫКЛ'}
      </button>
    </div>
  );
}

function A11yToggleRow({ on, onToggle }) {
  return (
    <div className="settings-row settings-row--theme settings-row--a11y">
      <div className="settings-a11y-stack">
        <div className="settings-label settings-label--theme" style={{ marginBottom: 0 }}>
          Версия для слабовидящих
        </div>
        <p className="settings-a11y-desc">
          Увеличивает шрифт, контраст и обводки, делает фон страницы чуть темнее голубого. Вы сразу увидите изменение
          на всех экранах. Выключить можно здесь же.
        </p>
      </div>
      <button
        type="button"
        className={'settings-toggle' + (on ? '' : ' settings-toggle--off')}
        onClick={onToggle}
        aria-pressed={on}
        aria-label="Версия для слабовидящих: ВКЛ или ВЫКЛ"
      >
        {on ? 'ВКЛ' : 'ВЫКЛ'}
      </button>
    </div>
  );
}
