import { useState, useEffect, useCallback } from 'react';
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

function TeacherControlPanel({ session }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('id, title, description, is_active, questions_count, time_limit_minutes, max_attempts, created_at')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTests(data || []);
    } catch (err) {
      console.error('Failed to load tests:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadTests(); }, [loadTests]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.target);
    try {
      const { error } = await supabase.from('tests').insert({
        title: fd.get('title'),
        description: fd.get('description') || '',
        max_attempts: Number(fd.get('maxAttempts')) || 1,
        questions_count: 0,
        created_by: session.user.id,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setShowCreateModal(false);
      loadTests();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить этот тест?')) return;
    try {
      const { error } = await supabase.from('tests').delete().eq('id', id).eq('created_by', session.user.id);
      if (error) throw error;
      loadTests();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  };

  const handleToggleActive = async (id, currentlyActive) => {
    try {
      const { error } = await supabase.from('tests').update({ is_active: !currentlyActive }).eq('id', id);
      if (error) throw error;
      loadTests();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  };

  const [view, setView] = useState('actions');

  return (
    <div style={{ padding: '28px 32px 40px', flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div className="student-page student-page--wide" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 className="student-page-title" style={{ color: 'var(--qf-bright-blue)' }}>ПАНЕЛЬ УПРАВЛЕНИЯ</h1>

        <div className="student-card" style={{ padding: '24px 28px', marginBottom: 28 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
          }}>
            <button type="button" onClick={() => setShowCreateModal(true)} style={{
              background: 'var(--qf-card)', border: '2px solid var(--qf-accent-border-soft, #e5e7eb)',
              borderRadius: 'var(--qf-radius-md, 12px)', padding: '22px 16px', cursor: 'pointer',
              textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontSize: 28 }}>📝</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>Создать тест</span>
            </button>
            <button type="button" onClick={() => setView('tests')} style={{
              background: view === 'tests' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
              border: '2px solid ' + (view === 'tests' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
              borderRadius: 'var(--qf-radius-md, 12px)', padding: '22px 16px', cursor: 'pointer',
              textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { if (view !== 'tests') e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontSize: 28 }}>📋</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>Мои тесты</span>
            </button>
            <button type="button" onClick={() => setView('groups')} style={{
              background: view === 'groups' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
              border: '2px solid ' + (view === 'groups' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
              borderRadius: 'var(--qf-radius-md, 12px)', padding: '22px 16px', cursor: 'pointer',
              textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { if (view !== 'groups') e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontSize: 28 }}>👥</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>Назначить группам</span>
            </button>
            <button type="button" onClick={() => setView('results')} style={{
              background: view === 'results' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
              border: '2px solid ' + (view === 'results' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
              borderRadius: 'var(--qf-radius-md, 12px)', padding: '22px 16px', cursor: 'pointer',
              textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { if (view !== 'results') e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontSize: 28 }}>📊</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>Результаты</span>
            </button>
          </div>
        </div>

        {view === 'groups' && (
          <div className="student-card" style={{ padding: '28px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
              Функция назначения групп будет доступна в ближайшее время.
            </p>
          </div>
        )}

        {view === 'results' && (
          <div className="student-card" style={{ padding: '28px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
              Функция просмотра результатов будет доступна в ближайшее время.
            </p>
          </div>
        )}

        {(view === 'actions' || view === 'tests') && (
          loading ? (
            <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Загрузка…</p>
          ) : tests.length === 0 ? (
            <div className="student-card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 18, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
                У вас пока нет тестов. Создайте первый тест!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {tests.map((t) => (
                <div key={t.id} className="student-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)', margin: 0 }}>
                      {t.title}
                    </h3>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, flexShrink: 0,
                      background: t.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                      color: t.is_active ? '#059669' : 'var(--qf-text-muted)',
                    }}>
                      {t.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', margin: 0 }}>
                    {t.description || 'Описание отсутствует'}
                  </p>
                  <div style={{ fontSize: 13, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', display: 'flex', gap: 16 }}>
                    <span>Вопросов: {t.questions_count || 0}</span>
                    <span>Попыток: {t.max_attempts || 1}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <button type="button" className="qf-btn-primary" style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                      onClick={() => handleToggleActive(t.id, t.is_active)}>
                      {t.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                    <button type="button" style={{
                      flex: 1, fontSize: 13, padding: '8px 12px', border: '2px solid #ef4444',
                      borderRadius: 'var(--qf-radius-md, 12px)', background: 'transparent',
                      color: '#ef4444', fontWeight: 700, fontFamily: 'var(--qf-font)', cursor: 'pointer',
                    }}
                      onClick={() => handleDelete(t.id)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {showCreateModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={() => setShowCreateModal(false)}>
            <div className="student-card" style={{ maxWidth: 480, width: '90%', padding: '28px 32px' }}
              onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)', marginBottom: 20 }}>
                Создать новый тест
              </h2>
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600, color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)' }}>
                    Название теста
                  </label>
                  <input name="title" required placeholder="Введите название" style={{
                    width: '100%', padding: '12px 14px', border: '2px solid var(--qf-accent-border-soft)',
                    borderRadius: 'var(--qf-radius-md, 12px)', fontSize: 15, fontFamily: 'var(--qf-font)',
                    background: 'var(--qf-card)', color: 'var(--qf-text-body)',
                  }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600, color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)' }}>
                    Описание
                  </label>
                  <textarea name="description" rows={3} placeholder="Описание теста" style={{
                    width: '100%', padding: '12px 14px', border: '2px solid var(--qf-accent-border-soft)',
                    borderRadius: 'var(--qf-radius-md, 12px)', fontSize: 15, fontFamily: 'var(--qf-font)',
                    background: 'var(--qf-card)', color: 'var(--qf-text-body)', resize: 'vertical',
                  }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600, color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)' }}>
                    Макс. попыток
                  </label>
                  <input name="maxAttempts" type="number" min={1} defaultValue={1} style={{
                    width: '100%', padding: '12px 14px', border: '2px solid var(--qf-accent-border-soft)',
                    borderRadius: 'var(--qf-radius-md, 12px)', fontSize: 15, fontFamily: 'var(--qf-font)',
                    background: 'var(--qf-card)', color: 'var(--qf-text-body)',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowCreateModal(false)} style={{
                    padding: '10px 22px', borderRadius: 'var(--qf-radius-md, 12px)', border: '2px solid var(--qf-accent-border-soft)',
                    background: 'transparent', fontWeight: 700, fontFamily: 'var(--qf-font)', cursor: 'pointer',
                    color: 'var(--qf-text-body)', fontSize: 15,
                  }}>
                    Отмена
                  </button>
                  <button type="submit" className="qf-btn-primary" disabled={creating}
                    style={{ padding: '10px 22px', fontSize: 15 }}>
                    {creating ? 'Создание…' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherLeaderboardPane({ session }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buildingName, setBuildingName] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('building_id, buildings(name)')
          .eq('id', session.user.id)
          .maybeSingle();

        const buildingId = teacher?.building_id;
        setBuildingName(teacher?.buildings?.name || '');

        if (!buildingId) {
          setLeaders([]);
          setLoading(false);
          return;
        }

        const { data: courses } = await supabase.from('courses').select('id').eq('building_id', buildingId);
        const courseIds = (courses || []).map(c => c.id);
        if (courseIds.length === 0) { setLeaders([]); setLoading(false); return; }

        const { data: groups } = await supabase.from('student_groups').select('id').in('course_id', courseIds);
        const groupIds = (groups || []).map(g => g.id);
        if (groupIds.length === 0) { setLeaders([]); setLoading(false); return; }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, group_id, active_frame_id, active_color_id, active_prefix_id, incognito_mode')
          .eq('role', 'student')
          .or('incognito_mode.is.null,incognito_mode.eq.false')
          .in('group_id', groupIds);

        const { data: results } = await supabase.from('test_results').select('student_id, score').eq('status', 'completed');
        const scoreMap = {};
        const testsMap = {};
        (results || []).forEach(r => {
          scoreMap[r.student_id] = (scoreMap[r.student_id] || 0) + (r.score || 0);
          testsMap[r.student_id] = (testsMap[r.student_id] || 0) + 1;
        });

        const unique = arr => [...new Set(arr.filter(Boolean))];
        const frameIds = unique((profiles || []).map(p => p.active_frame_id));
        const colorIds = unique((profiles || []).map(p => p.active_color_id));
        const prefixIds = unique((profiles || []).map(p => p.active_prefix_id));

        const [framesRes, colorsRes, prefixesRes] = await Promise.all([
          frameIds.length ? supabase.from('items_frames').select('id, image_url').in('id', frameIds) : { data: [] },
          colorIds.length ? supabase.from('items_name_colors').select('id, hex_code').in('id', colorIds) : { data: [] },
          prefixIds.length ? supabase.from('items_prefixes').select('id, title').in('id', prefixIds) : { data: [] },
        ]);
        const frameMap = Object.fromEntries((framesRes.data || []).map(f => [f.id, f]));
        const colorMap = Object.fromEntries((colorsRes.data || []).map(c => [c.id, c]));
        const prefixMap = Object.fromEntries((prefixesRes.data || []).map(p => [p.id, p]));

        const ranked = (profiles || [])
          .map(p => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(' '),
            avatarUrl: p.avatar_url || null,
            totalScore: scoreMap[p.id] || 0,
            testsCompleted: testsMap[p.id] || 0,
            activeFrame: p.active_frame_id ? (frameMap[p.active_frame_id] ?? null) : null,
            activeColor: p.active_color_id ? (colorMap[p.active_color_id] ?? null) : null,
            activePrefix: p.active_prefix_id ? (prefixMap[p.active_prefix_id] ?? null) : null,
          }))
          .sort((a, b) => b.totalScore - a.totalScore || b.testsCompleted - a.testsCompleted);

        ranked.forEach((r, i) => { r.rank = i + 1; });
        setLeaders(ranked);
      } catch (err) {
        console.error('Teacher leaderboard error:', err);
        setLeaders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const medalBg = (i) =>
    i === 0 ? 'linear-gradient(145deg,#f6d365,#fda085)'
    : i === 1 ? 'linear-gradient(145deg,#e2e8f0,#94a3b8)'
    : 'linear-gradient(145deg,#fdba74,#c2410c)';

  return (
    <div style={{ padding: '28px 32px 40px', flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div className="student-page student-page--wide" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 className="student-page-title" style={{ color: 'var(--qf-bright-blue)', margin: 0 }}>ДОСКА ЛИДЕРОВ</h1>
          {buildingName && (
            <span style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'var(--qf-font)',
              color: 'var(--qf-text-muted)', background: 'var(--qf-accent-border-soft, rgba(51,143,249,0.1))',
              padding: '6px 16px', borderRadius: 999,
            }}>
              Корпус: {buildingName}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Загрузка рейтинга…</div>
        ) : leaders.length === 0 ? (
          <div className="student-card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
            <p style={{ fontSize: 16, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
              Пока нет данных для отображения.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {leaders.slice(0, 3).map((row, i) => (
              <div key={row.id} className="student-card" style={{
                display: 'grid', gridTemplateColumns: '72px 52px 1fr auto auto',
                alignItems: 'center', gap: 16, padding: '20px 24px',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#fff',
                  fontWeight: 900, fontSize: 24, fontFamily: 'var(--qf-font)',
                  background: medalBg(i), boxShadow: '0 6px 16px rgba(0,0,0,.12)',
                }}>{row.rank}</div>
                <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                  <img src={row.avatarUrl || '/icons/Standard_avatar.png'} alt="" width={52} height={52}
                    style={{ borderRadius: '50%', objectFit: 'cover', width: 52, height: 52 }}
                    onError={e => { e.currentTarget.src = '/icons/Standard_avatar.png'; }} />
                  {row.activeFrame?.image_url && (
                    <img src={row.activeFrame.image_url} alt="" style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%,-50%)', width: 72, height: 72,
                      objectFit: 'contain', pointerEvents: 'none', zIndex: 1,
                    }} />
                  )}
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
                  {row.activePrefix?.title && (
                    <span className="qf-prefix-chip" style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {row.activePrefix.title}
                    </span>
                  )}
                  <span style={{
                    fontSize: 18, fontWeight: 700, fontFamily: 'var(--qf-font)',
                    color: row.activeColor?.hex_code || 'var(--qf-text-body)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{row.name}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', whiteSpace: 'nowrap' }}>
                  {row.testsCompleted} тест.
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#338ff9', fontFamily: 'var(--qf-font)', whiteSpace: 'nowrap' }}>
                  {row.totalScore} очков
                </span>
              </div>
            ))}

            {leaders.length > 3 && (
              <div className="student-card" style={{ padding: 0, overflow: 'hidden' }}>
                {leaders.slice(3).map((row, i, arr) => (
                  <div key={row.id} style={{
                    display: 'grid', gridTemplateColumns: '48px 44px 1fr auto auto',
                    alignItems: 'center', gap: 12, padding: '12px 20px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--qf-border-subtle)' : 'none',
                  }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)' }}>{row.rank}</span>
                    <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                      <img src={row.avatarUrl || '/icons/Standard_avatar.png'} alt="" width={40} height={40}
                        style={{ borderRadius: '50%', objectFit: 'cover', width: 40, height: 40 }}
                        onError={e => { e.currentTarget.src = '/icons/Standard_avatar.png'; }} />
                      {row.activeFrame?.image_url && (
                        <img src={row.activeFrame.image_url} alt="" style={{
                          position: 'absolute', top: '50%', left: '50%',
                          transform: 'translate(-50%,-50%)', width: 56, height: 56,
                          objectFit: 'contain', pointerEvents: 'none', zIndex: 1,
                        }} />
                      )}
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
                      {row.activePrefix?.title && (
                        <span className="qf-prefix-chip" style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {row.activePrefix.title}
                        </span>
                      )}
                      <span style={{
                        fontSize: 16, fontWeight: 700, fontFamily: 'var(--qf-font)',
                        color: row.activeColor?.hex_code || 'var(--qf-text-body)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{row.name}</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', whiteSpace: 'nowrap' }}>
                      {row.testsCompleted} тест.
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#338ff9', fontFamily: 'var(--qf-font)', whiteSpace: 'nowrap' }}>
                      {row.totalScore} очков
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherApp({ session }) {
  const [tab, setTab] = useState('home');
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const refreshAvatar = useCallback(() => setAvatarRefreshKey(k => k + 1), []);

  return (
    <TeacherLayout session={session} activeTab={tab} onTabChange={setTab} avatarRefreshKey={avatarRefreshKey}>
      {tab === 'home' && <TeacherHomePage session={session} onTabChange={setTab} />}
      {tab === 'tests' && <TeacherControlPanel session={session} />}
      {tab === 'profile' && <Profile key={session.user.id} session={session} onAvatarUpdated={refreshAvatar} />}
      {tab === 'leaderboard' && <TeacherLeaderboardPane session={session} />}
      {tab === 'settings' && <TeacherSettingsPane />}
      {tab === 'help' && <TeacherHelpPane />}
    </TeacherLayout>
  );
}

function TeacherSettingsToggle({ label, on, onToggle, isSwitch }) {
  if (isSwitch) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 28, padding: '26px 32px',
        borderBottom: '1px solid var(--qf-border-subtle)',
      }}>
        <div style={{
          fontWeight: 'var(--qf-fw-medium)', fontSize: 20,
          fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)',
        }}>{label}</div>
        <button type="button" onClick={onToggle} style={{
          position: 'relative', width: 54, height: 30, padding: 0,
          border: 'none', borderRadius: 999, cursor: 'pointer',
          background: on ? 'linear-gradient(135deg, #338ff9 0%, #127ab6 100%)' : '#94a3b8',
          transition: 'background 0.22s ease', flexShrink: 0,
        }}>
          <span style={{
            position: 'absolute', top: 3, left: 3, width: 24, height: 24,
            borderRadius: '50%', background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
            transform: on ? 'translateX(24px)' : 'translateX(0)',
          }} />
        </button>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 28, padding: '26px 32px',
      borderBottom: '1px solid var(--qf-border-subtle)',
    }}>
      <div style={{
        fontWeight: 'var(--qf-fw-medium)', fontSize: 20,
        fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)',
      }}>{label}</div>
      <button type="button" onClick={onToggle} style={{
        minWidth: 88, padding: '14px 20px', border: 'none', borderRadius: 12,
        background: on ? '#338ff9' : '#94a3b8', color: '#fff',
        fontFamily: 'var(--qf-font)', fontWeight: 700, fontSize: 20, cursor: 'pointer',
        transition: 'filter 0.2s ease',
      }}>
        {on ? 'ВКЛ' : 'ВЫКЛ'}
      </button>
    </div>
  );
}

function TeacherSettingsPane() {
  const [themeOn, setThemeOn] = useState(() => {
    try { return localStorage.getItem('qf_setting_theme') === '1'; } catch { return false; }
  });
  const [a11y, setA11y] = useState(() => {
    try { return localStorage.getItem('qf_setting_a11y') === '1'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('qf-theme-alt', themeOn);
    try { localStorage.setItem('qf_setting_theme', themeOn ? '1' : '0'); } catch { /* ignore */ }
  }, [themeOn]);

  useEffect(() => {
    document.documentElement.classList.toggle('qf-a11y', a11y);
    try { localStorage.setItem('qf_setting_a11y', a11y ? '1' : '0'); } catch { /* ignore */ }
  }, [a11y]);

  return (
    <div style={{ padding: '28px 32px 40px', flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div className="student-page student-page--wide" style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 className="student-page-title" style={{ color: 'var(--qf-bright-blue)' }}>НАСТРОЙКИ</h1>
        <div className="student-card" style={{ padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
          <TeacherSettingsToggle label="Сменить тему" on={themeOn} onToggle={() => setThemeOn(v => !v)} isSwitch />
          <TeacherSettingsToggle label="Версия для слабовидящих" on={a11y} onToggle={() => setA11y(v => !v)} />
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
