export default function HelpPage() {
  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide" style={{ maxWidth: 'min(960px, 100%)', margin: '0 auto' }}>
        <h1 className="student-page-title">ПОМОЩЬ</h1>
        <section className="student-card">
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--qf-text-muted)', fontWeight: 500, fontFamily: 'var(--qf-font)' }}>
            Здесь будет справка по платформе СТУДТЕСТ. Пока используйте разделы «Каталог тестов», «Магазин» и «Доска
            лидеров» в боковом меню. Личный кабинет и данные профиля доступны по аватару внизу панели.
          </p>
          <p style={{
            margin: '18px 0 0',
            lineHeight: 1.6,
            color: 'var(--qf-text-body)',
            fontWeight: 600,
            fontFamily: 'var(--qf-font)',
          }}
          >
            Нужен крупный шрифт и контраст? Откройте «Настройки» (иконка шестерёнки в меню слева) и включите «Версию для
            слабовидящих» — изменения сразу видны на всех страницах.
          </p>
        </section>
      </div>
    </div>
  );
}
