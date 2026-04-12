import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile({ session, embedded = false, onAvatarUpdated }) {
    const iframeRef = useRef(null);

    // Пробрасываем текущую тему в iframe при его загрузке и при смене темы
    function syncThemeToIframe() {
        if (!iframeRef.current?.contentWindow) return;
        try {
            const isDark = localStorage.getItem('qf_setting_theme') === '1';
            const isA11y = localStorage.getItem('qf_setting_a11y') === '1';
            iframeRef.current.contentWindow.postMessage(
                { type: 'THEME_SYNC', data: { isDark, isA11y } },
                '*'
            );
        } catch (e) { /* ignore */ }
    }

    useEffect(() => {
        const observer = new MutationObserver(() => syncThemeToIframe());
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

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

                case 'DELETE_TEST_REQUEST':
                    await handleDeleteTest(data.testId);
                    break;

                case 'UPDATE_AVATAR_REQUEST':
                    await handleUpdateAvatar(data.avatarUrl);
                    break;

                case 'LOAD_INVENTORY_REQUEST':
                    await handleLoadInventory(data.profileId);
                    break;

                case 'APPLY_ITEM_REQUEST':
                    await handleApplyItem(data.itemType, data.itemId);
                    break;

                case 'REMOVE_ITEM_REQUEST':
                    await handleRemoveItem(data.itemType);
                    break;

                case 'LOAD_STATS_TESTS_LIST_REQUEST':
                    await handleLoadStatsTestsList();
                    break;

                case 'LOAD_STATS_BY_TEST_REQUEST':
                    await handleLoadStatsByTest(data.testId);
                    break;

                case 'LOAD_STATS_PARAM_OPTIONS_REQUEST':
                    await handleLoadStatsParamOptions(data.paramType);
                    break;

                case 'LOAD_STATS_BY_PARAM_REQUEST':
                    await handleLoadStatsByParam(data.paramType, data.paramValue);
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
            // Step 1 — find every test_id assigned to this group
            const { data: groupRows, error: groupError } = await supabase
                .from('group_tests')
                .select('test_id')
                .eq('group_id', groupId);

            if (groupError) throw groupError;

            const testIds = (groupRows || []).map(r => r.test_id).filter(Boolean);

            let tests = [];
            if (testIds.length > 0) {
                // Step 2 — fetch only active tests whose ids match
                const { data: testsData, error: testsError } = await supabase
                    .from('tests')
                    .select('id, title, description, time_limit_minutes, questions_count')
                    .in('id', testIds)
                    .eq('is_active', true);

                if (testsError) throw testsError;
                tests = testsData || [];
            }

            sendMessageToIframe({
                type: 'TESTS_LOADED',
                data: { tests }
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
                .eq('teacher_id', session.user.id)
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

    const handleDeleteTest = async (testId) => {
        try {
            const { error } = await supabase
                .from('tests')
                .delete()
                .eq('id', testId)
                .eq('created_by', session.user.id); // Защита от удаления чужих тестов

            if (error) throw error;

            sendMessageToIframe({
                type: 'TEST_DELETED',
                data: { testId }
            });

        } catch (error) {
            console.error('Test deletion error:', error);
            sendMessageToIframe({
                type: 'ERROR_STATE',
                data: { error: 'Не удалось удалить тест: ' + error.message }
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

            // Immediately refresh the StudentProfileContext so the sidebar
            // avatar updates without waiting for a full page reload.
            if (onAvatarUpdated) onAvatarUpdated();

        } catch (error) {
            console.error('Avatar update error:', error);
            sendMessageToIframe({
                type: 'ERROR_STATE',
                data: { error: 'Не удалось обновить аватар: ' + error.message }
            });
        }
    };

    const handleLoadInventory = async (profileId) => {
        try {
            const [invRes, purchasesRes, profileRes] = await Promise.all([
                supabase.from('user_inventory').select('*').eq('profile_id', profileId),
                supabase.from('user_purchases').select('bonus_id, amount').eq('profile_id', profileId),
                supabase.from('profiles').select('active_frame_id, active_color_id, active_prefix_id').eq('id', profileId).single(),
            ]);

            const inv = invRes.data || [];
            const activeIds = profileRes.data || {};

            const frameIds  = inv.filter(i => i.frame_id).map(i => i.frame_id);
            const colorIds  = inv.filter(i => i.name_color_id).map(i => i.name_color_id);
            const prefixIds = inv.filter(i => i.prefix_id).map(i => i.prefix_id);

            const [framesRes, colorsRes, prefixesRes] = await Promise.all([
                frameIds.length  ? supabase.from('items_frames').select('*').in('id', frameIds)        : { data: [] },
                colorIds.length  ? supabase.from('items_name_colors').select('*').in('id', colorIds)   : { data: [] },
                prefixIds.length ? supabase.from('items_prefixes').select('*').in('id', prefixIds)     : { data: [] },
            ]);

            const cosmetics = [];
            (framesRes.data  || []).forEach(f => cosmetics.push({ type: 'frame',      item_id: f.id, name: f.name,    image_url: f.image_url, price: f.price, is_active: activeIds.active_frame_id  === f.id }));
            (colorsRes.data  || []).forEach(c => cosmetics.push({ type: 'name_color', item_id: c.id, name: c.name,    hex_code:  c.hex_code,  price: c.price, is_active: activeIds.active_color_id  === c.id }));
            (prefixesRes.data|| []).forEach(p => cosmetics.push({ type: 'prefix',     item_id: p.id, name: p.title,                           price: p.price, is_active: activeIds.active_prefix_id === p.id }));

            // Group bonuses by type and sum quantity
            const bonusMap = {};
            (purchasesRes.data || []).forEach(p => {
                bonusMap[p.bonus_id] = (bonusMap[p.bonus_id] || 0) + (p.amount ?? 1);
            });
            const bonusIds = Object.keys(bonusMap);
            let bonuses = [];
            if (bonusIds.length) {
                const { data: bonusData } = await supabase.from('shop_bonuses').select('id, name, description').in('id', bonusIds);
                bonuses = (bonusData || []).map(b => ({ bonus_id: b.id, name: b.name, description: b.description, quantity: bonusMap[b.id] }));
            }

            sendMessageToIframe({ type: 'INVENTORY_LOADED', data: { cosmetics, bonuses } });
        } catch (err) {
            console.error('Inventory loading error:', err);
            sendMessageToIframe({ type: 'INVENTORY_LOADED', data: { cosmetics: [], bonuses: [] } });
        }
    };

    const handleApplyItem = async (itemType, itemId) => {
        try {
            const patch = itemType === 'frame' ? { active_frame_id: itemId }
                : itemType === 'name_color'    ? { active_color_id: itemId }
                : itemType === 'prefix'        ? { active_prefix_id: itemId }
                : null;
            if (!patch) return;
            const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
            if (error) throw error;
            if (onAvatarUpdated) onAvatarUpdated();
            sendMessageToIframe({ type: 'ITEM_APPLIED', data: { itemType, itemId } });
        } catch (err) {
            console.error('Apply item error:', err);
        }
    };

    const handleRemoveItem = async (itemType) => {
        try {
            const patch = itemType === 'frame' ? { active_frame_id: null }
                : itemType === 'name_color'    ? { active_color_id: null }
                : itemType === 'prefix'        ? { active_prefix_id: null }
                : null;
            if (!patch) return;
            const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
            if (error) throw error;
            if (onAvatarUpdated) onAvatarUpdated();
            sendMessageToIframe({ type: 'ITEM_REMOVED', data: { itemType } });
        } catch (err) {
            console.error('Remove item error:', err);
        }
    };

    const handleLoadStatsTestsList = async () => {
        try {
            const { data, error } = await supabase
                .from('tests')
                .select('id, title')
                .eq('created_by', session.user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            sendMessageToIframe({ type: 'STATS_TESTS_LIST_LOADED', data: { tests: data || [] } });
        } catch (err) {
            console.error('Stats tests list error:', err);
            sendMessageToIframe({ type: 'STATS_TESTS_LIST_LOADED', data: { tests: [] } });
        }
    };

    const handleLoadStatsByTest = async (testId) => {
        try {
            const { data, error } = await supabase
                .from('test_attempts')
                .select('id, score, completed')
                .eq('test_id', testId);
            if (error) throw error;
            const attempts = (data || []).length;
            const completed = (data || []).filter(a => a.completed).length;
            const scores = (data || []).filter(a => a.score != null).map(a => a.score);
            const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
            const bestScore = scores.length > 0 ? Math.max(...scores) : null;
            sendMessageToIframe({
                type: 'STATS_BY_TEST_LOADED',
                data: { stats: { attempts, completed, avgScore, bestScore } }
            });
        } catch (err) {
            console.error('Stats by test error:', err);
            sendMessageToIframe({ type: 'STATS_BY_TEST_LOADED', data: { stats: null } });
        }
    };

    const getTeacherBuildingId = async () => {
        const { data } = await supabase
            .from('teachers')
            .select('building_id')
            .eq('id', session.user.id)
            .maybeSingle();
        return data?.building_id || null;
    };

    const handleLoadStatsParamOptions = async (paramType) => {
        try {
            const buildingId = await getTeacherBuildingId();
            let options = [];
            if (paramType === 'course') {
                let query = supabase.from('courses').select('id, course_number, buildings(name)');
                if (buildingId) query = query.eq('building_id', buildingId);
                const { data, error } = await query;
                if (error) throw error;
                options = (data || []).map(c => ({
                    id: c.id,
                    name: `${c.course_number} курс` + (c.buildings ? ` — ${c.buildings.name}` : ''),
                }));
            } else if (paramType === 'group') {
                let courseIds = [];
                if (buildingId) {
                    const { data: courses } = await supabase.from('courses').select('id').eq('building_id', buildingId);
                    courseIds = (courses || []).map(c => c.id);
                    if (courseIds.length === 0) {
                        sendMessageToIframe({ type: 'STATS_PARAM_OPTIONS_LOADED', data: { options: [], paramType } });
                        return;
                    }
                }
                let query = supabase.from('student_groups').select('id, group_number, courses(course_number, buildings(name))');
                if (courseIds.length > 0) query = query.in('course_id', courseIds);
                const { data, error } = await query;
                if (error) throw error;
                options = (data || []).map(g => ({
                    id: g.id,
                    name: `${g.group_number}` + (g.courses ? ` (${g.courses.course_number} курс${g.courses.buildings ? ', ' + g.courses.buildings.name : ''})` : ''),
                }));
            }
            sendMessageToIframe({ type: 'STATS_PARAM_OPTIONS_LOADED', data: { options, paramType } });
        } catch (err) {
            console.error('Stats param options error:', err);
            sendMessageToIframe({ type: 'STATS_PARAM_OPTIONS_LOADED', data: { options: [], paramType } });
        }
    };

    const handleLoadStatsByParam = async (paramType, paramValue) => {
        try {
            let groupIds = [];
            if (paramType === 'group') {
                groupIds = [paramValue];
            } else if (paramType === 'course') {
                const { data } = await supabase.from('student_groups').select('id').eq('course_id', paramValue);
                groupIds = (data || []).map(g => g.id);
            }

            if (groupIds.length === 0) {
                sendMessageToIframe({ type: 'STATS_BY_PARAM_LOADED', data: { stats: { rows: [] } } });
                return;
            }

            const { data: gtData } = await supabase.from('group_tests').select('test_id').in('group_id', groupIds);
            const testIds = [...new Set((gtData || []).map(r => r.test_id))];

            if (testIds.length === 0) {
                sendMessageToIframe({ type: 'STATS_BY_PARAM_LOADED', data: { stats: { rows: [] } } });
                return;
            }

            const { data: testsData } = await supabase.from('tests').select('id, title').in('id', testIds);
            const testMap = {};
            (testsData || []).forEach(t => { testMap[t.id] = t.title; });

            const { data: profilesData } = await supabase.from('profiles').select('id').in('group_id', groupIds);
            const profileIds = (profilesData || []).map(p => p.id);

            let rows = [];
            if (profileIds.length > 0) {
                const { data: attemptsData } = await supabase
                    .from('test_attempts')
                    .select('test_id, score, completed')
                    .in('test_id', testIds)
                    .in('user_id', profileIds);

                const byTest = {};
                (attemptsData || []).forEach(a => {
                    if (!byTest[a.test_id]) byTest[a.test_id] = [];
                    byTest[a.test_id].push(a);
                });

                rows = testIds.map(tid => {
                    const arr = byTest[tid] || [];
                    const scores = arr.filter(a => a.score != null).map(a => a.score);
                    return {
                        testTitle: testMap[tid] || 'Без названия',
                        attempts: arr.length,
                        avgScore: scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
                        completed: arr.filter(a => a.completed).length,
                    };
                });
            } else {
                rows = testIds.map(tid => ({
                    testTitle: testMap[tid] || 'Без названия',
                    attempts: 0,
                    avgScore: null,
                    completed: 0,
                }));
            }

            sendMessageToIframe({ type: 'STATS_BY_PARAM_LOADED', data: { stats: { rows } } });
        } catch (err) {
            console.error('Stats by param error:', err);
            sendMessageToIframe({ type: 'STATS_BY_PARAM_LOADED', data: { stats: { rows: [] } } });
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
        <div
            style={{
                width: '100%',
                height: '100%',
                minHeight: 0,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
            }}
        >
            <iframe
                ref={iframeRef}
                src="/profile.html"
                width="100%"
                height="100%"
                frameBorder="0"
                title="Profile"
                style={{ display: 'block', flex: 1, minHeight: 0, border: 0 }}
                onLoad={() => { console.log('Profile iframe loaded'); syncThemeToIframe(); }}
            />
        </div>
    );
}