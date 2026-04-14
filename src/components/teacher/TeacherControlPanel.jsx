import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function TeacherControlPanel({ session }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('id, title, description, is_active, questions_count, created_at')
        .eq('teacher_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTests(data || []);
    } catch (err) {
      console.error('Failed to load tests:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

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
        teacher_id: session.user.id,
        is_active: true,
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
      const { error } = await supabase.from('tests').delete().eq('id', id).eq('teacher_id', session.user.id);
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
    <div
      style={{
        padding: '28px 32px 40px',
        flex: '0 0 auto',
        alignSelf: 'stretch',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div className="student-page student-page--wide" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 className="student-page-title" style={{ color: 'var(--qf-bright-blue)' }}>ПАНЕЛЬ УПРАВЛЕНИЯ</h1>

        <div className="student-card" style={{ padding: '24px 28px', marginBottom: 28 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
            }}
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                background: 'var(--qf-card)',
                border: '2px solid var(--qf-accent-border-soft, #e5e7eb)',
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>📝</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Создать тест
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('tests')}
              style={{
                background: view === 'tests' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
                border: '2px solid ' + (view === 'tests' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                if (view !== 'tests') e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>📋</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Мои тесты
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('groups')}
              style={{
                background: view === 'groups' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
                border: '2px solid ' + (view === 'groups' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                if (view !== 'groups') e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>👥</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Назначить группам
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('results')}
              style={{
                background: view === 'results' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
                border: '2px solid ' + (view === 'results' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                if (view !== 'results') e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>📊</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Результаты
              </span>
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

        {(view === 'actions' || view === 'tests') &&
          (loading ? (
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
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: 999,
                        flexShrink: 0,
                        background: t.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                        color: t.is_active ? '#059669' : 'var(--qf-text-muted)',
                      }}
                    >
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
                    <button
                      type="button"
                      className="qf-btn-primary"
                      style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                      onClick={() => handleToggleActive(t.id, t.is_active)}
                    >
                      {t.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        fontSize: 13,
                        padding: '8px 12px',
                        border: '2px solid #ef4444',
                        borderRadius: 'var(--qf-radius-md, 12px)',
                        background: 'transparent',
                        color: '#ef4444',
                        fontWeight: 700,
                        fontFamily: 'var(--qf-font)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleDelete(t.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="student-card"
              style={{ maxWidth: 480, width: '90%', padding: '28px 32px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)', marginBottom: 20 }}>
                Создать новый тест
              </h2>
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--qf-text-body)',
                      fontFamily: 'var(--qf-font)',
                    }}
                  >
                    Название теста
                  </label>
                  <input
                    name="title"
                    required
                    placeholder="Введите название"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--qf-accent-border-soft)',
                      borderRadius: 'var(--qf-radius-md, 12px)',
                      fontSize: 15,
                      fontFamily: 'var(--qf-font)',
                      background: 'var(--qf-card)',
                      color: 'var(--qf-text-body)',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--qf-text-body)',
                      fontFamily: 'var(--qf-font)',
                    }}
                  >
                    Описание
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Описание теста"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--qf-accent-border-soft)',
                      borderRadius: 'var(--qf-radius-md, 12px)',
                      fontSize: 15,
                      fontFamily: 'var(--qf-font)',
                      background: 'var(--qf-card)',
                      color: 'var(--qf-text-body)',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--qf-text-body)',
                      fontFamily: 'var(--qf-font)',
                    }}
                  >
                    Макс. попыток
                  </label>
                  <input
                    name="maxAttempts"
                    type="number"
                    min={1}
                    defaultValue={1}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--qf-accent-border-soft)',
                      borderRadius: 'var(--qf-radius-md, 12px)',
                      fontSize: 15,
                      fontFamily: 'var(--qf-font)',
                      background: 'var(--qf-card)',
                      color: 'var(--qf-text-body)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 'var(--qf-radius-md, 12px)',
                      border: '2px solid var(--qf-accent-border-soft)',
                      background: 'transparent',
                      fontWeight: 700,
                      fontFamily: 'var(--qf-font)',
                      cursor: 'pointer',
                      color: 'var(--qf-text-body)',
                      fontSize: 15,
                    }}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="qf-btn-primary" disabled={creating} style={{ padding: '10px 22px', fontSize: 15 }}>
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
