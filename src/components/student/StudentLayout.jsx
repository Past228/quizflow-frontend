import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { StudentProfileProvider } from '../../context/StudentProfileContext';
import { hydrateStudentSettings } from '../../lib/studentSettings';

const NAV = [
  { to: '/', end: true, icon: 'Home_icon.png', iconActive: 'Home_icon_active.png', label: 'Главная' },
  { to: '/catalog', icon: 'Test_icon.png', iconActive: 'Test_icon_active.png', label: 'Каталог тестов' },
  { to: '/shop', icon: 'Shop_icon.png', iconActive: 'Shop_icon_active.png', label: 'Магазин' },
  { to: '/leaderboard', icon: 'Top_icon.png', iconActive: 'Top_icon_active.png', label: 'Лидеры' },
  { to: '/settings', icon: 'Settings_icon.png', iconActive: 'Settings_icon_active.png', label: 'Настройки' },
  { to: '/help', icon: 'Help_icon.png', iconActive: 'Help_icon_active.png', label: 'Помощь' },
];

function AnimatedOutlet({ context }) {
  const location = useLocation();
  return (
    <div key={location.pathname} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Outlet context={context} />
    </div>
  );
}

export default function StudentLayout({ session }) {
  const navigate = useNavigate();

  useEffect(() => {
    hydrateStudentSettings();
  }, []);

  return (
    <StudentProfileProvider session={session}>
      <div className="student-app">
        <aside className="student-sidebar" aria-label="Основная навигация">
          <NavLink to="/" className="student-sidebar__logo" end title="СТУДТЕСТ">
            <img src="/icons/Logo.png" alt="" width={56} height={56} />
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
                    width={28}
                    height={28}
                  />
                )}
              </NavLink>
            ))}
          </nav>

          <div className="student-sidebar__avatar">
            <button
              type="button"
              className="student-sidebar__avatar-btn"
              onClick={() => navigate('/profile')}
              title="Профиль"
            >
              <img src="/icons/Standard_avatar.png" alt="Аватар" />
            </button>
          </div>

        </aside>

        <main className="student-main">
          <AnimatedOutlet context={{ session }} />
        </main>
      </div>
    </StudentProfileProvider>
  );
}
