import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthWithHTML() {
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(true);
    const [isTeacherSignUp, setIsTeacherSignUp] = useState(false);
    const iframeRef = useRef(null);

    useEffect(() => {
        const handleMessage = async (event) => {
            const { type, data } = event.data;

            console.log('Received message from iframe:', type, data);

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

    const handleValidateInviteCode = async (code) => {
        try {
            const { data: codeData, error } = await supabase
                .from('invite_codes')
                .select('id, code, is_used')
                .eq('code', code.toUpperCase())
                .single();

            if (error || !codeData) {
                return sendMessageToIframe({
                    type: 'INVITE_CODE_VALIDATION_RESULT',
                    data: { valid: false, message: 'Код не найден' }
                });
            }

            if (codeData.is_used) {
                return sendMessageToIframe({
                    type: 'INVITE_CODE_VALIDATION_RESULT',
                    data: { valid: false, message: 'Код уже использован' }
                });
            }

            sendMessageToIframe({
                type: 'INVITE_CODE_VALIDATION_RESULT',
                data: { valid: true, message: '✅ Код действителен' }
            });

        } catch (error) {
            console.error('Validation error:', error);
            sendMessageToIframe({
                type: 'INVITE_CODE_VALIDATION_RESULT',
                data: { valid: false, message: 'Ошибка проверки' }
            });
        }
    };

    const handleStudentSignUp = async (formData) => {
        setLoading(true);

        try {
            const errors = validateStudentSignUpForm(formData);
            if (Object.keys(errors).length > 0) {
                sendMessageToIframe({
                    type: 'VALIDATION_ERRORS',
                    data: { errors }
                });
                return;
            }

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        group_id: formData.selectedGroupId,
                        role: 'student'
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('Пользователь с таким email уже зарегистрирован');
                }
                throw authError;
            }

            if (!authData.user) {
                throw new Error('Не удалось создать пользователя');
            }

            // Создаем профиль студента
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    email: formData.email,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    group_id: formData.selectedGroupId,
                    role: 'student',
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                console.error('Student profile creation error:', profileError);
                throw new Error('Не удалось создать профиль студента: ' + profileError.message);
            }

            sendMessageToIframe({
                type: 'AUTH_SUCCESS',
                data: {
                    message: 'Регистрация успешна! Пожалуйста, проверьте вашу электронную почту для подтверждения учетной записи перед входом.'
                }
            });

        } catch (error) {
            console.error('Sign up error:', error);
            sendMessageToIframe({
                type: 'AUTH_ERROR',
                data: { message: error.message }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTeacherSignUp = async (formData) => {
        setLoading(true);
        const startTime = Date.now();

        try {
            console.log('🚀 Starting teacher registration...');

            // 1. СОЗДАЕМ ПОЛЬЗОВАТЕЛЯ
            console.log('📧 Step 1: Creating auth user...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        role: 'teacher'
                    }
                }
            });

            if (authError) throw new Error(authError.message);
            if (!authData.user) throw new Error('Не удалось создать пользователя');

            const userId = authData.user.id;
            console.log('✅ User created:', userId);

            // 2. ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КОД
            console.log('🔑 Step 2: Validating and updating invite code...');

            // Сначала проверяем код
            const { data: codeData, error: codeError } = await supabase
                .from('invite_codes')
                .select('id')
                .eq('code', formData.inviteCode.toUpperCase())
                .eq('is_used', false)
                .single();

            if (codeError || !codeData) {
                throw new Error('Неверный или уже использованный код');
            }

            // Затем обновляем код
            const { error: updateError } = await supabase
                .from('invite_codes')
                .update({
                    is_used: true,
                    used_by: userId,
                    used_at: new Date().toISOString()
                })
                .eq('id', codeData.id);

            if (updateError) {
                console.error('❌ Code update failed:', updateError);
                throw new Error('Ошибка обновления кода: ' + updateError.message);
            }

            console.log('✅ Code updated successfully');

            // 3. СОЗДАЕМ ПРЕПОДАВАТЕЛЯ
            console.log('👨‍🏫 Step 3: Creating teacher record...');

            const { error: teacherError } = await supabase
                .from('teachers')
                .insert({
                    id: userId,
                    building_id: formData.buildingId || null,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    email: formData.email,
                    role: 'teacher',
                    invite_code_id: codeData.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (teacherError) {
                console.error('❌ Teacher creation failed:', teacherError);
                throw new Error('Ошибка создания преподавателя: ' + teacherError.message);
            }

            console.log('✅ Teacher record created');
            console.log('🎉 REGISTRATION COMPLETE! Time:', Date.now() - startTime + 'ms');

            sendMessageToIframe({
                type: 'AUTH_SUCCESS',
                data: { message: 'Регистрация успешна! Проверьте email для подтверждения.' }
            });

        } catch (error) {
            console.error('💥 REGISTRATION FAILED:', error);
            console.log('⏱️ Failed after:', Date.now() - startTime + 'ms');

            sendMessageToIframe({
                type: 'AUTH_ERROR',
                data: { message: error.message }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSignIn = async (formData) => {
        setLoading(true);

        try {
            const errors = validateLoginForm(formData);
            if (Object.keys(errors).length > 0) {
                sendMessageToIframe({
                    type: 'VALIDATION_ERRORS',
                    data: { errors }
                });
                return;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Неверный email или пароль');
                }
                throw error;
            }

            // После успешного входа проверяем роль пользователя
            if (data.user) {
                const userRole = data.user.user_metadata?.role;
                console.log('User role from metadata:', userRole);

                if (userRole === 'teacher') {
                    // ДЛЯ ПРЕПОДАВАТЕЛЕЙ - проверяем ТОЛЬКО teachers таблицу
                    const { data: teacherData, error: teacherError } = await supabase
                        .from('teachers')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();

                    if (teacherError && teacherError.code === 'PGRST116') {
                        // Если записи преподавателя нет, создаем ее в teachers
                        console.log('Creating teacher record on login...');
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
                            console.error('Error creating teacher record on login:', createError);
                        }
                    }

                    // ВАЖНО: ПРЕПОДАВАТЕЛЯМ НЕ СОЗДАЕМ ПРОФИЛЬ В PROFILES!
                    // Удаляем запись в profiles если она случайно создалась
                    const { error: deleteProfileError } = await supabase
                        .from('profiles')
                        .delete()
                        .eq('id', data.user.id);

                    if (deleteProfileError && deleteProfileError.code !== 'PGRST116') {
                        console.error('Error deleting teacher profile:', deleteProfileError);
                    }

                    console.log('Teacher login successful - profile removed if existed');

                } else {
                    // ДЛЯ СТУДЕНТОВ - создаем запись в profiles если ее нет
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();

                    if (profileError && profileError.code === 'PGRST116') {
                        // Создаем профиль студента если его нет
                        console.log('Creating student profile on login...');
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
                            console.error('Error creating student profile on login:', createError);
                        }
                    } else if (profile && !profile.role) {
                        // Если профиль есть но нет роли, обновляем его
                        await supabase
                            .from('profiles')
                            .update({
                                role: 'student',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', data.user.id);
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
                data: { message: error.message }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLoadBuildingsRequest = async () => {
        try {
            console.log('Loading buildings request received');

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
                console.error('Error loading buildings:', error);
                throw error;
            }

            console.log(`Loaded ${data?.length || 0} buildings:`, data);

            sendMessageToIframe({
                type: 'BUILDINGS_LOADED',
                data: { buildings: data || [] }
            });

        } catch (error) {
            console.error('Error in handleLoadBuildingsRequest:', error);
            sendMessageToIframe({
                type: 'LOAD_ERROR',
                data: {
                    resource: 'buildings',
                    message: error.message
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
                .eq('building_id', buildingId)
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
                    message: error.message
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
                .eq('course_id', courseId)
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
                    message: error.message
                }
            });
        }
    };

    const handleGroupSelected = (groupId) => {
        console.log('Group selected:', groupId);
    };

    const validateStudentSignUpForm = (formData) => {
        const errors = {};

        if (!formData.email) {
            errors.email = 'Email обязателен';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
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
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            errors.email = 'Некорректный формат email';
        } else if (formData.email.length > 255) {
            errors.email = 'Email слишком длинный';
        }

        if (!formData.password) {
            errors.password = 'Пароль обязателен';
        } else if (formData.password.length < 6) {
            errors.password = 'Пароль должен быть не менее 6 символов';
        } else if (formData.password.length > 100) {
            errors.password = 'Пароль слишком длинный';
        }

        if (!formData.firstName) {
            errors.firstName = 'Имя обязательно';
        } else if (formData.firstName.length > 100) {
            errors.firstName = 'Имя слишком длинное';
        }

        if (!formData.lastName) {
            errors.lastName = 'Фамилия обязательна';
        } else if (formData.lastName.length > 100) {
            errors.lastName = 'Фамилия слишком длинная';
        }

        if (!formData.inviteCode) {
            errors.inviteCode = 'Пригласительный код обязателен';
        } else if (formData.inviteCode.length > 50) {
            errors.inviteCode = 'Код слишком длинный';
        }

        return errors;
    };

    const validateLoginForm = (formData) => {
        const errors = {};

        if (!formData.email) {
            errors.email = 'Email обязателен';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            errors.email = 'Некорректный формат email';
        }

        if (!formData.password) {
            errors.password = 'Пароль обязателен';
        }

        return errors;
    };

    const sendMessageToIframe = (message) => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            console.log('Sending message to iframe:', message);
            iframeRef.current.contentWindow.postMessage(message, '*');
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