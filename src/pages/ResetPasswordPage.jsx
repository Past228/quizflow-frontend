import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getSignupPasswordPolicyError } from '../lib/passwordPolicy';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [ready, setReady] = useState(false);
    const [timedOut, setTimedOut] = useState(false);
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;
            if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
                setReady(true);
                setTimedOut(false);
            }
        });

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (cancelled) return;
            if (session) {
                setReady(true);
                setTimedOut(false);
            }
        });

        const t1 = setTimeout(() => {
            if (cancelled) return;
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (cancelled) return;
                if (session) {
                    setReady(true);
                    setTimedOut(false);
                }
            });
        }, 600);

        const t2 = setTimeout(() => {
            if (cancelled) return;
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (cancelled) return;
                if (!session) {
                    setTimedOut(true);
                }
            });
        }, 4000);

        return () => {
            cancelled = true;
            clearTimeout(t1);
            clearTimeout(t2);
            subscription.unsubscribe();
        };
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError('');
        const err = getSignupPasswordPolicyError(password);
        if (err) {
            setFormError(err);
            return;
        }
        if (password !== password2) {
            setFormError('Пароли не совпадают');
            return;
        }
        setBusy(true);
        const { error } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (error) {
            setFormError(error.message || 'Не удалось обновить пароль');
            return;
        }
        setDone(true);
        setTimeout(() => {
            navigate('/', { replace: true });
        }, 1200);
    }

    const cardStyle = {
        maxWidth: 420,
        width: '100%',
        margin: '0 auto',
        padding: '36px 32px 32px',
        background: 'var(--qf-white, #fff)',
        borderRadius: 18,
        boxShadow: '0 8px 24px rgba(18, 122, 182, 0.08)',
    };

    if (timedOut && !ready) {
        return (
            <div
                className="app-root__fill"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    fontFamily: 'var(--qf-font), "Gothic A1", sans-serif',
                }}
            >
                <div style={cardStyle}>
                    <h1
                        style={{
                            fontSize: 22,
                            fontWeight: 900,
                            color: 'var(--qf-dark-blue, #127ab6)',
                            marginBottom: 16,
                            textAlign: 'center',
                        }}
                    >
                        Ссылка недействительна
                    </h1>
                    <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
                        Запросите новую ссылку на странице входа («Забыли пароль?») или откройте письмо ещё раз.
                    </p>
                    <a
                        href="/"
                        style={{
                            display: 'block',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: 'var(--qf-turquoise, #20aeb9)',
                        }}
                    >
                        На страницу входа
                    </a>
                </div>
            </div>
        );
    }

    if (!ready) {
        return (
            <div
                className="app-root__fill"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    fontFamily: 'var(--qf-font), "Gothic A1", sans-serif',
                    color: '#127ab6',
                    fontWeight: 700,
                }}
            >
                Проверка ссылки…
            </div>
        );
    }

    if (done) {
        return (
            <div
                className="app-root__fill"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    fontFamily: 'var(--qf-font), "Gothic A1", sans-serif',
                }}
            >
                <div style={cardStyle}>
                    <p
                        style={{
                            textAlign: 'center',
                            color: '#0f7b4b',
                            fontWeight: 700,
                            fontSize: 17,
                        }}
                    >
                        Пароль обновлён. Переходим в приложение…
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="app-root__fill"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                fontFamily: 'var(--qf-font), "Gothic A1", sans-serif',
                background: 'var(--qf-bg, #eaf4fc)',
            }}
        >
            <div style={cardStyle}>
                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: 'var(--qf-dark-blue, #127ab6)',
                        marginBottom: 8,
                        textAlign: 'center',
                    }}
                >
                    Новый пароль
                </h1>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 22, textAlign: 'center', lineHeight: 1.5 }}>
                    8–64 символа: латиница a–z и A–Z, цифра и спецсимвол.
                </p>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label htmlFor="newPassword" style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                            Пароль
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            maxLength={64}
                            style={{
                                width: '100%',
                                padding: '13px 16px',
                                border: '2px solid rgba(51, 143, 249, 0.2)',
                                borderRadius: 12,
                                fontSize: 15,
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label htmlFor="newPassword2" style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                            Пароль ещё раз
                        </label>
                        <input
                            id="newPassword2"
                            type="password"
                            autoComplete="new-password"
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            required
                            maxLength={64}
                            style={{
                                width: '100%',
                                padding: '13px 16px',
                                border: '2px solid rgba(51, 143, 249, 0.2)',
                                borderRadius: 12,
                                fontSize: 15,
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    {formError ? (
                        <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{formError}</p>
                    ) : null}
                    <button
                        type="submit"
                        disabled={busy}
                        style={{
                            width: '100%',
                            padding: 14,
                            border: 'none',
                            borderRadius: 12,
                            background: busy ? '#b0c4d8' : 'var(--qf-bright-blue, #338ff9)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 16,
                            cursor: busy ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                        }}
                    >
                        {busy ? 'Сохранение…' : 'Сохранить пароль'}
                    </button>
                </form>
            </div>
        </div>
    );
}
