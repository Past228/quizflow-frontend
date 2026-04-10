import { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import AuthWithHTML from './components/AuthWithHTML';
import Profile from './components/Profile';
import StudentLayout from './components/student/StudentLayout';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import TestPage from './pages/TestPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ShopPage from './pages/ShopPage';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import ProfileRoute from './pages/ProfileRoute';

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
          fontFamily:
            "'Century Gothic', CenturyGothic, 'Didact Gothic', 'Franklin Gothic Medium', sans-serif",
          background: '#eaf4fc',
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
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#127ab6' }}>Загрузка СТУДТЕСТ…</div>
          <p style={{ color: '#64748b', marginTop: 8 }}>Пожалуйста, подождите</p>
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
    <div className="app-root" style={{ background: '#eaf4fc' }}>
      {!session ? (
        <div className="app-root__fill">
          <AuthWithHTML />
        </div>
      ) : isTeacher ? (
        <div className="app-root__fill">
          <Profile key={session.user.id} session={session} />
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
