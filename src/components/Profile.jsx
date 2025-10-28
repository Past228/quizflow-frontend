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
                    
                case 'LOGOUT_REQUEST':
                    await handleSignOut();
                    break;
                    
                case 'RECREATE_PROFILE_REQUEST':
                    await handleRecreateProfile();
                    break;
                    
                case 'START_TEST_REQUEST':
                    await handleStartTest(data.testId);
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
                if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
                    sendMessageToIframe({
                        type: 'PROFILE_NOT_FOUND',
                        data: { error: 'Профиль не найден в базе данных' }
                    });
                    return;
                }
                throw error;
            }

            sendMessageToIframe({
                type: 'PROFILE_LOADED',
                data: { profile: data }
            });

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

    const handleStartTest = async (testId) => {
        // Здесь будет логика начала теста
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