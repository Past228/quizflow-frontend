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
                src = '/signup_teacher.html';
            } else if (isSignUp) {
                src = '/signup.html';
            } else {
                src = '/login.html';
            }
            iframeRef.current.src = src;
        }
    }, [isSignUp, isTeacherSignUp]);

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
                        group_id: formData.selectedGroupId
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

            // Используем функцию для создания профиля студента
            const { error: profileError } = await supabase.rpc('create_student_profile', {
                user_id: authData.user.id,
                user_email: formData.email,
                first_name: formData.firstName,
                last_name: formData.lastName,
                group_id: formData.selectedGroupId
            });

            if (profileError) {
                console.error('Profile creation error:', profileError);
                // Если функции нет, создаем стандартным способом
                const { error: fallbackError } = await supabase
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
                
                if (fallbackError) throw fallbackError;
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

        try {
            // Валидация для преподавателя
            const errors = validateTeacherSignUpForm(formData);
            if (Object.keys(errors).length > 0) {
                sendMessageToIframe({
                    type: 'VALIDATION_ERRORS',
                    data: { errors }
                });
                return;
            }

            // Проверяем пригласительный код
            if (!formData.inviteCode || formData.inviteCode.trim() === '') {
                throw new Error('Пригласительный код обязателен для регистрации преподавателя');
            }

            // Проверяем валидность кода
            const { data: validCode, error: codeError } = await supabase
                .from('invite_codes')
                .select('*')
                .eq('code', formData.inviteCode.trim().toUpperCase())
                .eq('is_used', false)
                .single();

            if (codeError || !validCode) {
                throw new Error('Неверный или использованный пригласительный код');
            }

            // Проверяем срок действия кода
            if (validCode.expires_at && new Date(validCode.expires_at) < new Date()) {
                throw new Error('Срок действия пригласительного кода истек');
            }

            // Создаем пользователя в auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password
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

            // Используем функцию для создания профиля преподавателя (обходит RLS)
            const { error: profileError } = await supabase.rpc('create_teacher_profile', {
                user_id: authData.user.id,
                user_email: formData.email,
                first_name: formData.firstName,
                last_name: formData.lastName
            });

            if (profileError) {
                console.error('Teacher profile creation error:', profileError);
                throw new Error('Не удалось создать профиль преподавателя: ' + profileError.message);
            }

            // Используем функцию для создания записи преподавателя
            const { error: teacherError } = await supabase.rpc('create_teacher_record', {
                p_user_id: authData.user.id,
                p_building_id: formData.buildingId || null
            });

            if (teacherError) {
                console.error('Teacher record creation error:', teacherError);
                throw new Error('Не удалось создать запись преподавателя: ' + teacherError.message);
            }

            // Помечаем код как использованный
            const { error: updateCodeError } = await supabase
                .from('invite_codes')
                .update({ 
                    is_used: true,
                    used_by: authData.user.id,
                    used_at: new Date().toISOString()
                })
                .eq('id', validCode.id);

            if (updateCodeError) {
                console.error('Code update error:', updateCodeError);
                throw new Error('Не удалось обновить статус кода: ' + updateCodeError.message);
            }

            sendMessageToIframe({
                type: 'AUTH_SUCCESS',
                data: { 
                    message: 'Регистрация преподавателя успешна! Теперь вы можете войти в систему.' 
                }
            });

        } catch (error) {
            console.error('Teacher sign up error:', error);
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
                } else if (error.message.includes('Email not confirmed')) {
                    throw new Error('Email не подтвержден. Пожалуйста, проверьте вашу почту и подтвердите учетную запись перед входом.');
                } else if (error.message.includes('Email not verified')) {
                    throw new Error('Email не подтвержден. Пожалуйста, проверьте вашу почту и подтвердите учетную запись.');
                }
                throw error;
            }

            if (data.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (profileError && profileError.code === 'PGRST116') {
                    // Если профиля нет, создаем его через функцию
                    const userMetadata = data.user.user_metadata;
                    const { error: createError } = await supabase.rpc('create_student_profile', {
                        user_id: data.user.id,
                        user_email: data.user.email,
                        first_name: userMetadata.first_name || 'Пользователь',
                        last_name: userMetadata.last_name || '',
                        group_id: userMetadata.group_id || null
                    });

                    if (createError) {
                        console.error('Error creating profile after login:', createError);
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

            if (error) throw error;

            sendMessageToIframe({
                type: 'BUILDINGS_LOADED',
                data: { buildings: data || [] }
            });
        } catch (error) {
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
                src={isTeacherSignUp ? "/signup_teacher.html" : (isSignUp ? "/signup.html" : "/login.html")}
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