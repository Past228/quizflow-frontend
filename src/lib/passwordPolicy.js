export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

/**
 * Политика пароля при регистрации / смене пароля (совпадает с типичным пресетом Supabase Email).
 */
export function getSignupPasswordPolicyError(password) {
    if (password == null || password === '') return 'Пароль обязателен';
    if (password.length < PASSWORD_MIN_LENGTH) return `Минимум ${PASSWORD_MIN_LENGTH} символов`;
    if (password.length > PASSWORD_MAX_LENGTH) return `Не более ${PASSWORD_MAX_LENGTH} символов`;
    if (!/[a-z]/.test(password)) return 'Нужна строчная латинская буква (a–z)';
    if (!/[A-Z]/.test(password)) return 'Нужна прописная латинская буква (A–Z)';
    if (!/[0-9]/.test(password)) return 'Нужна хотя бы одна цифра';
    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'Нужен спецсимвол (например ! @ # $ % ^ & * . , - _)';
    }
    return null;
}
