import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Белый список разрешенных источников
const ALLOWED_ORIGINS = [
    window.location.origin,
    'http://localhost:3000',
    'http://localhost:5173'
];

// Rate limiting
const signupAttempts = new Map();
const MAX_ATTEMPTS = 5;
const TIME_WINDOW = 15 * 60 * 1000; // 15 минут

export default function AuthWithHTML() {
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(true);
    const [isTeacherSignUp, setIsTeacherSignUp] = useState(false);
    const iframeRef = useRef(null);

    useEffect(() => {
        const handleMessage = async (event) => {
            // ВАЖНО: Проверяем источник сообщения
            if (!ALLOWED_ORIGINS.includes(event.origin)) {
                console.warn('Message from untrusted origin:', event.origin);
                return;
            }

            const { type, data } = event.data;

            // Логируем только тип, без чувствительных данных
            console.log('Received message from iframe:', type);

            switch (type) {
                case 'SIGNUP_FORM_SUBMIT':
                    await handleStudentSignUp(data);
                    break;

                case 'TEACHER_SIGNUP_FORM_SUBMIT':
                    await handleTeacherSignUp(data);
                    break;

                case 'LOGIN_FORM_SUBMIT':
                    await handleSignIn(data);
                    break;

                case 'VALIDATE_INVITE_CODE':
                    await handleValidateInviteCode(data.code);
                    break;

                case 'SWITCH_TO_LOGIN':
                    setIsSignUp(false);
                    setIsTeacherSignUp(false);
                    break;

                case 'SWITCH_TO_SIGNUP':
                    setIsSignUp(true);
                    setIsTeacherSignUp(false);
                    break;

                case 'SWITCH_TO_TEACHER_SIGNUP':
                    setIsTeacherSignUp(true);
                    setIsSignUp(false);
                    break;

                case 'LOAD_BUILDINGS_REQUEST':
                    await handleLoadBuildingsRequest();
                    break;

                case 'BUILDING_SELECTED':
                    await handleBuildingSelected(data);
                    break;

                case 'COURSE_SELECTED':
                    await handleCourseSelected(data);
                    break;

                case 'GROUP_SELECTED':
                    handleGroupSelected(data);
                    break;

                default:
                    console.log('Unknown message type:', type);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        if (iframeRef.current) {
            let src = '';
            if (isTeacherSignUp) {
                src = '/signup-teacher.html';
            } else if (isSignUp) {
                src = '/signup.html';
            } else {
                src = '/login.html';
            }
            iframeRef.current.src = src;
        }
    }, [isSignUp, isTeacherSignUp]);

    // Функции безопасности
    const sanitizeInput = (str) => {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>"'&]/g, '');
    };

    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const checkRateLimit = (email) => {
        const now = Date.now();
        const attempts = signupAttempts.get(email) || [];
        const recentAttempts = attempts.filter(time => now - time < TIME_WINDOW);

        if (recentAttempts.length >= MAX_ATTEMPTS) {
            throw new Error('Слишком много попыток регистрации. Попробуйте позже.');
        }

        recentAttempts.push(now);
        signupAttempts.set(email, recentAttempts);
    };

    const handleValidateInviteCode = async (code) => {
        try {
            const cleanCode = sanitizeInput(code);

            if (!cleanCode || cleanCode.length < 3) {
                sendMessageToIframe({
                    type: 'INVITE_CODE_VALIDATION_RESULT',
                    data: {
                        valid: false,
                        message: 'Код слишком короткий'
                    }
                });
                return;
            }

            // Проверяем код в базе данных
            const { data: codeData, error } = await supabase
                .from('invite_codes')
                .select('*')
                .eq('code', cleanCode.toUpperCase())
                .eq('is_used', false)
                .gte('expires_at', new Date().toISOString())
                .single();

            if (error || !codeData) {
                sendMessageToIframe({
                    type: 'INVITE_CODE_VALIDATION_RESULT',
                    data: {
                        valid: false,
                        message: 'Неверный, просроченный или уже использованный код'
                    }
                });
                return;
            }

            sendMessageToIframe({
                type: 'INVITE_CODE_VALIDATION_RESULT',
                data: {
                    valid: true,
                    message: '✅ Код действителен и доступен'
                }
            });

        } catch (error) {
            console.error('Error validating invite code:', error);
            sendMessageToIframe({
                type: 'INVITE_CODE_VALIDATION_RESULT',
                data: {
                    valid: false,
                    message: 'Ошибка проверки кода'
                }
            });
        }
    };

    const handleStudentSignUp = async (formData) => {
        setLoading(true);

        try {
            // Проверка rate limit
            checkRateLimit(formData.email);

            // Валидация и санитизация данных
            const errors = validateStudentSignUpForm(formData);
            if (Object.keys(errors).length > 0) {
                sendMessageToIframe({
                    type: 'VALIDATION_ERRORS',
                    data: { errors }
                });
                return;
            }

            // Очистка данных
            const cleanData = {
                email: sanitizeInput(formData.email).toLowerCase(),
                password: formData.password,
                firstName: sanitizeInput(formData.firstName),
                lastName: sanitizeInput(formData.lastName),
                groupId: parseInt(formData.selectedGroupId) || null
            };

            // Дополнительная валидация
            if (!isValidEmail(cleanData.email)) {
                throw new Error('Некорректный формат email');
            }

            if (cleanData.password.length < 6) {
                throw new Error('Пароль должен быть не менее 6 символов');
            }

            // 1. Сначала регистрация в Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: cleanData.email,
                password: cleanData.password,
                options: {
                    data: {
                        first_name: cleanData.firstName,
                        last_name: cleanData.lastName,
                        group_id: cleanData.groupId,
                        role: 'student'
                    }
                }
            });

            if (authError) {
                // Унифицированные сообщения об ошибках
                if (authError.message.includes('already registered')) {
                    throw new Error('Пользователь с таким email уже зарегистрирован');
                }
                if (authError.message.includes('password')) {
                    throw new Error('Ненадежный пароль');
                }
                throw new Error('Ошибка регистрации');
            }

            if (!authData.user) {
                throw new Error('Не удалось создать пользователя');
            }

            console.log('✅ User created in Auth');

            // 2. Безопасное создание профиля
            await createStudentProfileSafely(authData.user.id, cleanData);

            sendMessageToIframe({
                type: 'AUTH_SUCCESS',
                data: {
                    message: 'Регистрация успешна! Проверьте вашу электронную почту для подтверждения.'
                }
            });
            // Добавляем автоматический переход через 3 секунды
            setTimeout(() => {
                setIsSignUp(false);
                setIsTeacherSignUp(false);
            }, 3000);

        } catch (error) {
            console.error('Sign up error:', error);
            sendMessageToIframe({
                type: 'AUTH_ERROR',
                data: {
                    message: error.message || 'Произошла ошибка при регистрации'
                }
            });
        } finally {
            setLoading(false);
        }
    };

    const createStudentProfileSafely = async (userId, cleanData) => {
        try {
            // Пытаемся создать профиль через обычный клиент
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    email: cleanData.email,
                    first_name: cleanData.firstName,
                    last_name: cleanData.lastName,
                    group_id: cleanData.groupId,
                    role: 'student',
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                console.log('Profile creation failed, will create on first login');
                // Не бросаем ошибку - профиль создадим при входе
                return;
            }

            console.log('✅ Student profile created successfully');

        } catch (error) {
            console.error('Profile creation failed:', error);
            // Не прерываем процесс регистрации
        }
    };

    const handleTeacherSignUp = async (formData) => {
        setLoading(true);

        try {
            // Проверка rate limit
            checkRateLimit(formData.email);

            // Валидация и санитизация
            const errors = validateTeacherSignUpForm(formData);
            if (Object.keys(errors).length > 0) {
                sendMessageToIframe({
                    type: 'VALIDATION_ERRORS',
                    data: { errors }
                });
                return;
            }

            const cleanData = {
                email: sanitizeInput(formData.email).toLowerCase(),
                password: formData.password,
                firstName: sanitizeInput(formData.firstName),
                lastName: sanitizeInput(formData.lastName),
                inviteCode: sanitizeInput(formData.inviteCode),
                buildingId: parseInt(formData.buildingId) || null
            };

            // Дополнительная валидация
            if (!isValidEmail(cleanData.email)) {
                throw new Error('Некорректный формат email');
            }

            // Проверяем, не зарегистрирован ли уже пользователь с таким email
            const { data: existingTeacher, error: checkError } = await supabase
                .from('teachers')
                .select('id')
                .eq('email', cleanData.email)
                .single();

            if (!checkError && existingTeacher) {
                throw new Error('Пользователь с таким email уже зарегистрирован');
            }

            // ПРОВЕРЯЕМ КОД
            const { data: codeData, error: codeError } = await supabase
                .from('invite_codes')
                .select('*')
                .eq('code', cleanData.inviteCode.toUpperCase())
                .eq('is_used', false)
                .gte('expires_at', new Date().toISOString())
                .single();

            if (codeError || !codeData) {
                throw new Error('Неверный, просроченный или уже использованный пригласительный код');
            }

            // Создаем пользователя в auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: cleanData.email,
                password: cleanData.password,
                options: {
                    data: {
                        first_name: cleanData.firstName,
                        last_name: cleanData.lastName,
                        role: 'teacher',
                        invite_code: cleanData.inviteCode.toUpperCase()
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('Пользователь с таким email уже зарегистрирован в системе');
                }
                throw authError;
            }

            if (!authData.user) {
                throw new Error('Не удалось создать пользователя');
            }

            const userId = authData.user.id;

            // ОБНОВЛЯЕМ КОД
            const { error: updateCodeError } = await supabase
                .from('invite_codes')
                .update({
                    is_used: true,
                    used_by: userId,
                    used_at: new Date().toISOString()
                })
                .eq('id', codeData.id)
                .eq('is_used', false);

            if (updateCodeError) {
                throw new Error('Не удалось зарегистрировать пригласительный код');
            }

            // СОЗДАЕМ ЗАПИСЬ В TEACHERS
            const { error: teacherError } = await supabase
                .from('teachers')
                .insert({
                    id: userId,
                    building_id: cleanData.buildingId,
                    first_name: cleanData.firstName,
                    last_name: cleanData.lastName,
                    email: cleanData.email,
                    role: 'teacher',
                    avatar_url: null,
                    invite_code_id: codeData.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (teacherError) {
                throw new Error('Не удалось создать запись преподавателя');
            }

            sendMessageToIframe({
                type: 'AUTH_SUCCESS',
                data: {
                    message: 'Регистрация преподавателя успешна! Проверьте вашу электронную почту для подтверждения.'
                }
            });
            // Добавляем автоматический переход через 3 секунды
            setTimeout(() => {
                setIsSignUp(false);
                setIsTeacherSignUp(false);
            }, 3000);

        } catch (error) {
            console.error('Teacher sign up error:', error);
            sendMessageToIframe({
                type: 'AUTH_ERROR',
                data: {
                    message: error.message || 'Произошла ошибка при регистрации'
                }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSignIn = async (formData) => {
        setLoading(true);

        try {
            // Валидация и санитизация
            const errors = validateLoginForm(formData);
            if (Object.keys(errors).length > 0) {
                sendMessageToIframe({
                    type: 'VALIDATION_ERRORS',
                    data: { errors }
                });
                return;
            }

            const cleanData = {
                email: sanitizeInput(formData.email).toLowerCase(),
                password: formData.password
            };

            const { data, error } = await supabase.auth.signInWithPassword({
                email: cleanData.email,
                password: cleanData.password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Неверный email или пароль');
                }
                if (error.message.includes('Email not confirmed')) {
                    throw new Error('Email не подтвержден. Проверьте вашу почту.');
                }
                throw new Error('Ошибка входа');
            }

            // После успешного входа создаем профиль если его нет
            if (data.user) {
                const userRole = data.user.user_metadata?.role;

                if (userRole === 'teacher') {
                    // Для преподавателей
                    const { data: teacherData, error: teacherError } = await supabase
                        .from('teachers')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();

                    if (teacherError && teacherError.code === 'PGRST116') {
                        // Создаем запись преподавателя если ее нет
                        const { error: createError } = await supabase
                            .from('teachers')
                            .insert({
                                id: data.user.id,
                                email: data.user.email,
                                first_name: data.user.user_metadata?.first_name || 'Преподаватель',
                                last_name: data.user.user_metadata?.last_name || '',
                                role: 'teacher',
                                avatar_url: null,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            });

                        if (createError) {
                            console.error('Error creating teacher record:', createError);
                        }
                    }

                } else {
                    // Для студентов - создаем профиль если его нет
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();

                    if (profileError && profileError.code === 'PGRST116') {
                        const { error: createError } = await supabase
                            .from('profiles')
                            .insert({
                                id: data.user.id,
                                email: data.user.email,
                                first_name: data.user.user_metadata?.first_name || 'Студент',
                                last_name: data.user.user_metadata?.last_name || '',
                                role: 'student',
                                group_id: data.user.user_metadata?.group_id || null,
                                updated_at: new Date().toISOString()
                            });

                        if (createError) {
                            console.error('Error creating student profile:', createError);
                        }
                    }
                }
            }

            sendMessageToIframe({
                type: 'AUTH_SUCCESS',
                data: { message: 'Вход выполнен успешно!' }
            });

        } catch (error) {
            console.error('Sign in error:', error);
            sendMessageToIframe({
                type: 'AUTH_ERROR',
                data: {
                    message: error.message || 'Произошла ошибка при входе'
                }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLoadBuildingsRequest = async () => {
        try {
            sendMessageToIframe({
                type: 'LOADING_STATE',
                data: {
                    resource: 'buildings',
                    loading: true
                }
            });

            const { data, error } = await supabase
                .from('buildings')
                .select('*')
                .order('name');

            if (error) {
                throw error;
            }

            sendMessageToIframe({
                type: 'BUILDINGS_LOADED',
                data: { buildings: data || [] }
            });

        } catch (error) {
            console.error('Error loading buildings:', error);
            sendMessageToIframe({
                type: 'LOAD_ERROR',
                data: {
                    resource: 'buildings',
                    message: 'Ошибка загрузки данных'
                }
            });
        }
    };

    const handleBuildingSelected = async (buildingId) => {
        try {
            sendMessageToIframe({
                type: 'LOADING_STATE',
                data: {
                    resource: 'courses',
                    loading: true
                }
            });

            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .eq('building_id', parseInt(buildingId))
                .order('course_number');

            if (error) throw error;

            sendMessageToIframe({
                type: 'COURSES_LOADED',
                data: { courses: data || [] }
            });
        } catch (error) {
            sendMessageToIframe({
                type: 'LOAD_ERROR',
                data: {
                    resource: 'courses',
                    message: 'Ошибка загрузки данных'
                }
            });
        }
    };

    const handleCourseSelected = async (courseId) => {
        try {
            sendMessageToIframe({
                type: 'LOADING_STATE',
                data: {
                    resource: 'groups',
                    loading: true
                }
            });

            const { data, error } = await supabase
                .from('student_groups')
                .select('*')
                .eq('course_id', parseInt(courseId))
                .order('group_number');

            if (error) throw error;

            sendMessageToIframe({
                type: 'GROUPS_LOADED',
                data: { groups: data || [] }
            });
        } catch (error) {
            sendMessageToIframe({
                type: 'LOAD_ERROR',
                data: {
                    resource: 'groups',
                    message: 'Ошибка загрузки данных'
                }
            });
        }
    };

    const handleGroupSelected = (groupId) => {
        // Логика выбора группы
    };

    const validateStudentSignUpForm = (formData) => {
        const errors = {};

        if (!formData.email) {
            errors.email = 'Email обязателен';
        } else if (!isValidEmail(formData.email)) {
            errors.email = 'Некорректный формат email';
        }

        if (!formData.password) {
            errors.password = 'Пароль обязателен';
        } else if (formData.password.length < 6) {
            errors.password = 'Пароль должен быть не менее 6 символов';
        }

        if (!formData.firstName) errors.firstName = 'Имя обязательно';
        if (!formData.lastName) errors.lastName = 'Фамилия обязательна';
        if (!formData.selectedGroupId) errors.group = 'Выберите учебную группу';

        return errors;
    };

    const validateTeacherSignUpForm = (formData) => {
        const errors = {};

        if (!formData.email) {
            errors.email = 'Email обязателен';
        } else if (!isValidEmail(formData.email)) {
            errors.email = 'Некорректный формат email';
        }

        if (!formData.password) {
            errors.password = 'Пароль обязателен';
        } else if (formData.password.length < 6) {
            errors.password = 'Пароль должен быть не менее 6 символов';
        }

        if (!formData.firstName) errors.firstName = 'Имя обязательно';
        if (!formData.lastName) errors.lastName = 'Фамилия обязательна';
        if (!formData.inviteCode) errors.inviteCode = 'Пригласительный код обязателен';

        return errors;
    };

    const validateLoginForm = (formData) => {
        const errors = {};

        if (!formData.email) {
            errors.email = 'Email обязателен';
        } else if (!isValidEmail(formData.email)) {
            errors.email = 'Некорректный формат email';
        }

        if (!formData.password) {
            errors.password = 'Пароль обязателен';
        }

        return errors;
    };

    const sendMessageToIframe = (message) => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            // Отправляем только на конкретный origin
            const targetOrigin = new URL(iframeRef.current.src).origin;
            iframeRef.current.contentWindow.postMessage(message, targetOrigin);
        }
    };

    return (
        <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
            <iframe
                ref={iframeRef}
                src={isTeacherSignUp ? "/signup-teacher.html" : (isSignUp ? "/signup.html" : "/login.html")}
                width="100%"
                height="100%"
                frameBorder="0"
                title="Auth Form"
                style={{ display: 'block' }}
                onLoad={() => console.log('Iframe loaded')}
            />

            {loading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '18px',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        color: 'black',
                        padding: '20px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <div style={{
                            width: '20px',
                            height: '20px',
                            border: '2px solid transparent',
                            borderTop: '2px solid #2563eb',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        Обработка...
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}