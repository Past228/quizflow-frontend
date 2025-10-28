import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthWithHTML() {
    const [loading, setLoading] = useState(false);
    const iframeRef = useRef(null);

    useEffect(() => {
        const handleMessage = async (event) => {
            const { type, data } = event.data;

            console.log('Received message from iframe:', type, data);

            switch (type) {
                case 'AUTH_FORM_SUBMIT':
                    await handleAuthSubmit(data);
                    break;
                    
                case 'TOGGLE_AUTH':
                    handleToggleAuth(data);
                    break;
                    
                case 'LOGIN_BUTTON_CLICK':
                    handleLoginButtonClick();
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

    const handleAuthSubmit = async (formData) => {
        setLoading(true);

        try {
            // Валидация
            const errors = validateForm(formData);
            if (Object.keys(errors).length > 0) {
                sendMessageToIframe({
                    type: 'VALIDATION_ERRORS',
                    data: { errors } // ИСПРАВЛЕНО: добавил data
                });
                return;
            }

            if (formData.isSignUp) {
                await handleSignUp(formData);
            } else {
                await handleSignIn(formData);
            }
        } catch (error) {
            console.error('Auth error:', error);
            sendMessageToIframe({
                type: 'AUTH_ERROR',
                data: { message: error.message } // ИСПРАВЛЕНО: добавил data
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (formData) => {
        console.log('Sign up with:', formData);

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

        // Ждем создания профиля
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Проверяем создание профиля
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !profile) {
            throw new Error('Профиль не создан. Обратитесь к администратору.');
        }

        sendMessageToIframe({
            type: 'AUTH_SUCCESS',
            data: { message: 'Регистрация успешна! Проверьте email для подтверждения.' } // ИСПРАВЛЕНО: добавил data
        });
    };

    const handleSignIn = async (formData) => {
        console.log('Sign in with:', formData);

        const { error } = await supabase.auth.signInWithPassword({ 
            email: formData.email, 
            password: formData.password 
        });
        
        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Неверный email или пароль');
            } else if (error.message.includes('Email not confirmed')) {
                throw new Error('Email не подтвержден. Проверьте вашу почту');
            }
            throw error;
        }
        
        sendMessageToIframe({
            type: 'AUTH_SUCCESS',
            data: { message: 'Вход выполнен!' } // ИСПРАВЛЕНО: добавил data
        });
    };

    const handleToggleAuth = (data) => {
        sendMessageToIframe({
            type: 'SET_AUTH_MODE',
            data: { isSignUp: data.isSignUp } // ИСПРАВЛЕНО: добавил data
        });
    };

    const handleLoginButtonClick = () => {
        sendMessageToIframe({
            type: 'SET_AUTH_MODE',
            data: { isSignUp: false } // ИСПРАВЛЕНО: добавил data
        });
    };

    const handleLoadBuildingsRequest = async () => {
        try {
            sendMessageToIframe({
                type: 'LOADING_STATE',
                data: { // ИСПРАВЛЕНО: добавил data
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
                data: { buildings: data || [] } // ИСПРАВЛЕНО: добавил data
            });
        } catch (error) {
            sendMessageToIframe({
                type: 'LOAD_ERROR',
                data: { // ИСПРАВЛЕНО: добавил data
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
                data: { // ИСПРАВЛЕНО: добавил data
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
                data: { courses: data || [] } // ИСПРАВЛЕНО: добавил data
            });
        } catch (error) {
            sendMessageToIframe({
                type: 'LOAD_ERROR',
                data: { // ИСПРАВЛЕНО: добавил data
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
                data: { // ИСПРАВЛЕНО: добавил data
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
                data: { groups: data || [] } // ИСПРАВЛЕНО: добавил data
            });
        } catch (error) {
            sendMessageToIframe({
                type: 'LOAD_ERROR',
                data: { // ИСПРАВЛЕНО: добавил data
                    resource: 'groups',
                    message: error.message
                }
            });
        }
    };

    const handleGroupSelected = (groupId) => {
        console.log('Group selected:', groupId);
    };

    const validateForm = (formData) => {
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

        if (formData.isSignUp) {
            if (!formData.firstName) errors.firstName = 'Имя обязательно';
            if (!formData.lastName) errors.lastName = 'Фамилия обязательна';
            if (!formData.selectedGroupId) errors.group = 'Выберите учебную группу';
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
                src="/auth.html"
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