import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile({ session }) {
    const iframeRef = useRef(null);

    useEffect(() => {
        const handleMessage = async (event) => {
            const { type, data } = event.data;

            console.log('Received message from iframe:', type, data);

            switch (type) {
                case 'LOAD_PROFILE_REQUEST':
                    await handleLoadProfile();
                    break;

                case 'LOAD_TESTS_REQUEST':
                    await handleLoadTests(data.groupId);
                    break;

                case 'LOAD_TEACHER_DATA_REQUEST':
                    await handleLoadTeacherData(data.teacherId);
                    break;

                case 'CREATE_TEST_REQUEST':
                    await handleCreateTest(data.testData);
                    break;

                case 'LOGOUT_REQUEST':
                    await handleSignOut();
                    break;

                case 'RECREATE_PROFILE_REQUEST':
                    await handleRecreateProfile();
                    break;

                case 'START_TEST_REQUEST':
                    await handleStartTest(data.testId);
                    break;

                case 'UPDATE_AVATAR_REQUEST':
                    await handleUpdateAvatar(data.avatarUrl);
                    break;

                default:
                    console.log('Unknown message type:', type);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [session]);

    const handleLoadProfile = async () => {
        sendMessageToIframe({
            type: 'LOADING_STATE',
            data: { loading: true, resource: 'profile' }
        });

        try {
            // Сначала проверяем роль пользователя из metadata
            const userRole = session.user.user_metadata?.role;
            console.log('User role:', userRole);

            if (userRole === 'teacher') {
                // ДЛЯ ПРЕПОДАВАТЕЛЕЙ - загружаем данные ИЗ TEACHERS
                const { data, error } = await supabase
                    .from('teachers')
                    .select(`
                    *,
                    buildings (
                        name
                    )
                `)
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        sendMessageToIframe({
                            type: 'PROFILE_NOT_FOUND',
                            data: { error: 'Профиль преподавателя не найден' }
                        });
                        return;
                    }
                    throw error;
                }

                // Формируем объект профиля для преподавателя
                const teacherProfile = {
                    id: data.id,
                    email: data.email,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    role: data.role || 'teacher',
                    avatar_url: data.avatar_url,
                    teachers: [{
                        id: data.id,
                        building_id: data.building_id,
                        buildings: data.buildings
                    }]
                };

                sendMessageToIframe({
                    type: 'PROFILE_LOADED',
                    data: {
                        profile: teacherProfile,
                        role: 'teacher'
                    }
                });

            } else {
                // ДЛЯ СТУДЕНТОВ - загружаем данные из profiles
                const { data, error } = await supabase
                    .from('profiles')
                    .select(`
                    *,
                    student_groups (
                        id,
                        group_number,
                        courses (
                            course_number,
                            buildings (
                                name
                            )
                        )
                    )
                `)
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        sendMessageToIframe({
                            type: 'PROFILE_NOT_FOUND',
                            data: { error: 'Профиль студента не найден' }
                        });
                        return;
                    }
                    throw error;
                }

                sendMessageToIframe({
                    type: 'PROFILE_LOADED',
                    data: {
                        profile: data,
                        role: data.role || 'student'
                    }
                });
            }

        } catch (error) {
            console.error('Profile loading error:', error);
            sendMessageToIframe({
                type: 'ERROR_STATE',
                data: { error: error.message }
            });
        }
    };

    const handleLoadTests = async (groupId) => {
        sendMessageToIframe({
            type: 'LOADING_STATE',
            data: { loading: true, resource: 'tests' }
        });

        try {
            const { data, error } = await supabase
                .from('group_tests')
                .select(`
                    test:tests (
                        id,
                        title,
                        description,
                        created_at,
                        time_limit,
                        questions_count
                    )
                `)
                .eq('group_id', groupId);

            if (error) throw error;

            const tests = data
                .filter(item => item.test)
                .map(item => item.test);

            sendMessageToIframe({
                type: 'TESTS_LOADED',
                data: { tests: tests || [] }
            });

        } catch (error) {
            console.error('Tests loading error:', error);
            sendMessageToIframe({
                type: 'TESTS_LOADED',
                data: { tests: [] }
            });
        }
    };

    const handleLoadTeacherData = async (teacherId) => {
        try {
            // Загружаем тесты преподавателя
            const { data: testsData, error: testsError } = await supabase
                .from('tests')
                .select('*')
                .eq('created_by', session.user.id)
                .order('created_at', { ascending: false });

            if (testsError) throw testsError;

            sendMessageToIframe({
                type: 'TEACHER_DATA_LOADED',
                data: {
                    tests: testsData || [],
                    stats: {
                        totalTests: testsData?.length || 0,
                        activeTests: testsData?.filter(test => test.is_active).length || 0
                    }
                }
            });

        } catch (error) {
            console.error('Teacher data loading error:', error);
            sendMessageToIframe({
                type: 'TEACHER_DATA_LOADED',
                data: {
                    tests: [],
                    stats: { totalTests: 0, activeTests: 0 }
                }
            });
        }
    };

    const handleCreateTest = async (testData) => {
        try {
            const { data, error } = await supabase
                .from('tests')
                .insert({
                    title: testData.title,
                    description: testData.description,
                    time_limit: testData.timeLimit,
                    max_attempts: testData.maxAttempts,
                    questions_count: 0,
                    created_by: session.user.id,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            sendMessageToIframe({
                type: 'TEST_CREATED',
                data: { test: data }
            });

        } catch (error) {
            console.error('Test creation error:', error);
            sendMessageToIframe({
                type: 'ERROR_STATE',
                data: { error: 'Не удалось создать тест: ' + error.message }
            });
        }
    };

    const handleRecreateProfile = async () => {
        sendMessageToIframe({
            type: 'LOADING_STATE',
            data: { loading: true, resource: 'profile' }
        });

        try {
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: session.user.id,
                    email: session.user.email,
                    first_name: 'Новый',
                    last_name: 'Пользователь',
                    role: 'student',
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) throw insertError;

            sendMessageToIframe({
                type: 'PROFILE_RECREATED'
            });

        } catch (error) {
            console.error('Profile recreation error:', error);
            sendMessageToIframe({
                type: 'ERROR_STATE',
                data: { error: 'Не удалось создать профиль: ' + error.message }
            });
        }
    };

    const handleUpdateAvatar = async (avatarUrl) => {
        try {
            const userRole = session.user.user_metadata?.role;

            if (userRole === 'teacher') {
                // Для преподавателей обновляем в таблице teachers
                const { error: updateError } = await supabase
                    .from('teachers')
                    .update({
                        avatar_url: avatarUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', session.user.id);

                if (updateError) throw updateError;
            } else {
                // Для студентов обновляем в таблице profiles
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        avatar_url: avatarUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', session.user.id);

                if (updateError) throw updateError;
            }

            sendMessageToIframe({
                type: 'AVATAR_UPDATED',
                data: { avatarUrl: avatarUrl }
            });

        } catch (error) {
            console.error('Avatar update error:', error);
            sendMessageToIframe({
                type: 'ERROR_STATE',
                data: { error: 'Не удалось обновить аватар: ' + error.message }
            });
        }
    };

    const handleStartTest = async (testId) => {
        console.log('Starting test:', testId);
        alert(`Начинаем тест с ID: ${testId}`);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
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
                src="/profile.html"
                width="100%"
                height="100%"
                frameBorder="0"
                title="Profile"
                style={{ display: 'block' }}
                onLoad={() => console.log('Profile iframe loaded')}
            />
        </div>
    );
}