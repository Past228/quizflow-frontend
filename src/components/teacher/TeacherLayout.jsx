import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { hydrateStudentSettings } from '../../lib/studentSettings';

const NAV = [
  { id: 'home',     icon: 'Home_icon.png',     iconActive: 'Home_icon_active.png',     label: 'Личный кабинет' },
  { id: 'tests',    icon: 'Test_icon.png',      iconActive: 'Test_icon_active.png',      label: 'Панель управления' },
  { id: 'settings', icon: 'Settings_icon.png', iconActive: 'Settings_icon_active.png', label: 'Настройки' },
  { id: 'help',     icon: 'Help_icon.png',     iconActive: 'Help_icon_active.png',     label: 'Помощь' },
];

function TeacherSidebarAvatar({ session, onTabChange }) {
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('teachers')
      .select('avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [session]);

  const src = avatarUrl || '/icons/Standard_avatar.png';

  return (
    <button
      type="button"
      className="student-sidebar__avatar-btn"
      onClick={() => onTabChange('profile')}
      title="Личный кабинет"
    >
      <img
        src={src}
        alt="Аватар"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          borderRadius: '50%',
        }}
      />
    </button>
  );
}

export default function TeacherLayout({ session, activeTab, onTabChange, children }) {
  useEffect(() => {
    hydrateStudentSettings();
  }, []);

  return (
    <div className="student-layout-root">
      <div className="student-app">
        <aside className="student-sidebar" aria-label="Навигация преподавателя">
          <div className="student-sidebar__logo" title="СТУДТЕСТ">
            <img className="student-sidebar__logo-mark" src="/icons/Logo.png" alt="" />
            <span className="student-sidebar__brand">СТУДТЕСТ</span>
          </div>

          <nav className="student-sidebar__nav">
            {NAV.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    'student-sidebar__link' +
                    (isActive ? ' student-sidebar__link--active' : '')
                  }
                  title={item.label}
                  onClick={() => onTabChange(item.id)}
                >
                  <img
                    src={isActive ? `/icons/${item.iconActive}` : `/icons/${item.icon}`}
                    alt=""
                    width={55}
                    height={55}
                    decoding="async"
                  />
                </button>
              );
            })}
          </nav>

          <div className="student-sidebar__avatar">
            <TeacherSidebarAvatar session={session} onTabChange={onTabChange} />
          </div>
        </aside>

        <main className="student-main">
          {children}
        </main>
      </div>
    </div>
  );
}
