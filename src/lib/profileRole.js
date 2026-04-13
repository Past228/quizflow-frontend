/**
 * Кто попадает в лидерборд и в список «студент» в статистике преподавателя.
 *
 * Раньше здесь был whitelist (только student/пусто) — любое иное значение role в profiles
 * отсекало реального студента → пустой список и disabled у «Студент».
 *
 * Преподаватели (Иван Попов и т.д.) в profiles с role=teacher не попадают в выборку.
 * Остальные профили (в т.ч. role NULL, student, Student, опечатки) считаем студентами,
 * кроме явных staff-ролей ниже.
 */
export function profileIsStudentForRanking(p) {
  if (!p || p.incognito_mode === true) return false;
  const r = (p.role ?? '').toString().trim().toLowerCase();
  if (r === 'teacher' || r === 'admin' || r === 'moderator') return false;
  return true;
}
