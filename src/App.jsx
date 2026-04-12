import { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import AuthWithHTML from './components/AuthWithHTML';
import Profile from './components/Profile';
import TeacherLayout from './components/teacher/TeacherLayout';
import TeacherHomePage from './pages/TeacherHomePage';
import StudentLayout from './components/student/StudentLayout';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import TestPage from './pages/TestPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ShopPage from './pages/ShopPage';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import ProfileRoute from './pages/ProfileRoute';

function TeacherApp({ session }) {
  const [tab, setTab] = useState('home');

  return (
    <TeacherLayout session={session} activeTab={tab} onTabChange={setTab}>
      {tab === 'home' && <TeacherHomePage session={session} onTabChange={setTab} />}
      {tab === 'tests' && <Profile key={session.user.id} session={session} />}
      {tab === 'settings' && <TeacherSettingsPane />}
      {tab === 'help' && <TeacherHelpPane />}
    </TeacherLayout>
  );
}

function TeacherSettingsPane() {
  const [themeOn, setThemeOn] = useState(() => {
    try { return localStorage.getItem('qf_setting_theme') === '1'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('qf-theme-alt', themeOn);
    try { localStorage.setItem('qf_setting_theme', themeOn ? '1' : '0'); } catch { /* ignore */ }
  }, [themeOn]);

  return (
    <div style={{ padding: '28px 32px 40px', flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div className="student-page student-page--wide" style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 className="student-page-title" style={{ color: 'var(--qf-bright-blue)' }}>НАСТРОЙКИ</h1>
        <div className="student-card" style={{ padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 28, padding: '26px 32px',
            borderBottom: '1px solid var(--qf-border-subtle)',
          }}>
            <div style={{
              fontWeight: 'var(--qf-fw-medium)', fontSize: 20,
              fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)',
            }}>
              Сменить тему
            </div>
            <button
              type="button"
              onClick={() => setThemeOn(v => !v)}
              style={{
                position: 'relative', width: 54, height: 30, padding: 0,
                border: 'none', borderRadius: 999, cursor: 'pointer',
                background: themeOn
                  ? 'linear-gradient(135deg, #338ff9 0%, #127ab6 100%)'
                  : '#94a3b8',
                transition: 'background 0.22s ease',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: 3,
                width: 24, height: 24, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
                transform: themeOn ? 'translateX(24px)' : 'translateX(0)',
              }} />
            </button>
          </div>
          <div style={{ padding: '26px 32px' }}>
            <button
              type="button"
              className="qf-btn-primary"
              style={{ background: 'var(--qf-dark-blue)', minWidth: 240 }}
              onClick={() => supabase.auth.signOut()}
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherHelpPane() {
  return (
    <div style={{ padding: '28px 32px 40px', flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div className="student-page student-page--wide" style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 className="student-page-title" style={{ color: 'var(--qf-bright-blue)' }}>ПОМОЩЬ</h1>
        <div className="student-card" style={{ padding: '28px 32px' }}>
          <p style={{
            fontFamily: 'var(--qf-font)', fontSize: 18,
            fontWeight: 500, color: 'var(--qf-text-body)', lineHeight: 1.7,
          }}>
            Если у вас возникли вопросы по работе с платформой, обратитесь к администратору вашего учебного заведения.
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        className="app-root app-root--loading"
        style={{
          fontFamily: 'var(--qf-font), "Gothic A1", sans-serif',
          background: 'var(--qf-bg, #eaf4fc)',
          color: 'var(--qf-text-body, #1a202c)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: '3px solid rgba(51, 143, 249, 0.25)',
              borderTopColor: '#338ff9',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'qf-spin 0.9s linear infinite',
            }}
          />
          <div style={{ fontSize: '1.1rem', fontWeight: 'var(--qf-fw-black, 900)', color: '#127ab6' }}>
            Загрузка СТУДТЕСТ…
          </div>
          <p style={{ color: 'var(--qf-text-muted, #64748b)', marginTop: 8, fontWeight: 500 }}>Пожалуйста, подождите</p>
        </div>
        <style>{`
          @keyframes qf-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const isTeacher = session?.user?.user_metadata?.role === 'teacher';

  return (
    <div className="app-root" style={{ background: 'var(--qf-bg, #eaf4fc)' }}>
      {!session ? (
        <div className="app-root__fill">
          <AuthWithHTML />
        </div>
      ) : isTeacher ? (
        <div className="app-root__fill">
          <TeacherApp session={session} />
        </div>
      ) : (
        <BrowserRouter>
          <div className="app-root__fill">
            <Routes>
              <Route path="/" element={<StudentLayout session={session} />}>
                <Route index element={<HomePage />} />
                <Route path="catalog" element={<CatalogPage />} />
                <Route path="test/:testId" element={<TestPage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="shop" element={<ShopPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="profile" element={<ProfileRoute />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      )}
    </div>
  );
}

export default App;
