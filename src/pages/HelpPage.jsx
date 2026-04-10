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
        </section>
      </div>
    </div>
  );
}
