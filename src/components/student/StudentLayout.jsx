import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { StudentProfileProvider, useStudentProfile } from '../../context/StudentProfileContext';
import { hydrateStudentSettings } from '../../lib/studentSettings';

const NAV = [
  { to: '/', end: true, icon: 'Home_icon.png', iconActive: 'Home_icon_active.png', label: 'Главная' },
  { to: '/catalog', icon: 'Test_icon.png', iconActive: 'Test_icon_active.png', label: 'Каталог тестов' },
  { to: '/shop', icon: 'Shop_icon.png', iconActive: 'Shop_icon_active.png', label: 'Магазин' },
  { to: '/leaderboard', icon: 'Top_icon.png', iconActive: 'Top_icon_active.png', label: 'Лидеры' },
  { to: '/settings', icon: 'Settings_icon.png', iconActive: 'Settings_icon_active.png', label: 'Настройки' },
  { to: '/help', icon: 'Help_icon.png', iconActive: 'Help_icon_active.png', label: 'Помощь' },
];

// Rendered inside StudentProfileProvider so it can read live avatar + active cosmetics
function SidebarAvatar() {
  const navigate = useNavigate();
  const { profile } = useStudentProfile();
  const src = profile?.avatar_url || '/icons/Standard_avatar.png';
  const frameUrl = profile?.active_frame?.image_url ?? null;

  return (
    <button
      type="button"
      className="student-sidebar__avatar-btn"
      onClick={() => navigate('/profile')}
      title="Профиль"
    >
      {/* Avatar photo — clipped to circle on the img itself since the button overflow is visible */}
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
      {frameUrl && (
        <img
          src={frameUrl}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100% + 20px)',
            height: 'calc(100% + 20px)',
            objectFit: 'contain',
            pointerEvents: 'none',
            display: 'block',
          }}
        />
      )}
    </button>
  );
}

function AnimatedOutlet({ context }) {
  const location = useLocation();
  return (
    <div key={location.pathname} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Outlet context={context} />
    </div>
  );
}

export default function StudentLayout({ session }) {
  useEffect(() => {
    hydrateStudentSettings();
  }, []);

  return (
    <StudentProfileProvider session={session}>
      <div className="student-layout-root">
        <div className="student-app">
          <aside className="student-sidebar" aria-label="Основная навигация">
            <NavLink to="/" className="student-sidebar__logo" end title="СТУДТЕСТ">
              <img className="student-sidebar__logo-mark" src="/icons/Logo.png" alt="" />
              <span className="student-sidebar__brand">СТУДТЕСТ</span>
            </NavLink>

            <nav className="student-sidebar__nav">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    'student-sidebar__link' + (isActive ? ' student-sidebar__link--active' : '')
                  }
                  title={item.label}
                >
                  {({ isActive }) => (
                    <img
                      src={isActive ? `/icons/${item.iconActive}` : `/icons/${item.icon}`}
                      alt=""
                      width={55}
                      height={55}
                      decoding="async"
                    />
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="student-sidebar__avatar">
              <SidebarAvatar />
            </div>
          </aside>

          <main className="student-main">
            <AnimatedOutlet context={{ session }} />
          </main>
        </div>
      </div>
    </StudentProfileProvider>
  );
}
