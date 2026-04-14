import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { devLog } from '../lib/devLog';
import { profileIsStudentForRanking } from '../lib/profileRole';

function estimateWrongAnswers(questionsCount, scorePercent) {
    if (questionsCount == null || questionsCount <= 0 || scorePercent == null) return null;
    return Math.max(0, Math.round(questionsCount * ((100 - scorePercent) / 100)));
}

function formatDurationSec(sec) {
    if (sec == null || !Number.isFinite(Number(sec))) return null;
    const n = Math.round(Number(sec));
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function displayNameFromProfile(p) {
    const fn = (p.first_name || '').trim();
    const ln = (p.last_name || '').trim();
    const both = `${ln} ${fn}`.trim();
    if (both) return both;
    return (p.email || 'Студент').trim();
}

/** Id групп из БД (number) и из select (string) — единое сопоставление для фильтров. */
function makeGroupIdSet(ids) {
    if (ids == null) return null;
    return new Set((ids || []).map((x) => String(x)));
}

function groupIdMatchesScope(id, allowSet) {
    if (allowSet == null) return true;
    return allowSet.has(String(id));
}

function normalizeGroupIdForProfileQuery(groupId) {
    if (groupId == null || groupId === '') return null;
    const n = Number(groupId);
    return Number.isFinite(n) ? n : groupId;
}

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
                window.location.origin
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
            if (event.origin !== window.location.origin) return;
            if (event.data == null || typeof event.data !== 'object') return;
            const { type, data } = event.data;

            devLog('Received message from iframe:', type);

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

                case 'LOAD_STATS_STUDENT_COURSES_REQUEST':
                    await handleLoadStatsStudentCourses();
                    break;

                case 'LOAD_STATS_STUDENT_GROUPS_REQUEST':
                    await handleLoadStatsStudentGroups(data.courseId);
                    break;

                case 'LOAD_STATS_STUDENT_LIST_REQUEST':
                    await handleLoadStatsStudentList(data.groupId);
                    break;

                default:
                    devLog('Unknown message type:', type);
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
            devLog('User role:', userRole);

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
                    teacher_id: session.user.id,
                    is_active: true,
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
                .eq('teacher_id', session.user.id);

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
                const { error: updateError } = await supabase
                    .from('teachers')
                    .update({
                        avatar_url: avatarUrl,
                        updated_at: new Date().toISOString(),
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
                .eq('teacher_id', session.user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            sendMessageToIframe({ type: 'STATS_TESTS_LIST_LOADED', data: { tests: data || [] } });
        } catch (err) {
            console.error('Stats tests list error:', err);
            sendMessageToIframe({ type: 'STATS_TESTS_LIST_LOADED', data: { tests: [] } });
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

    /** @returns {Promise<string[]|null>} ids групп корпуса преподавателя или null = без ограничения (все группы). */
    const getTeacherScopedGroupIds = async () => {
        const buildingId = await getTeacherBuildingId();
        if (!buildingId) return null;
        const { data: courses } = await supabase.from('courses').select('id').eq('building_id', buildingId);
        const courseIds = (courses || []).map(c => c.id);
        /** Пустой массив раньше обнулял все группы; null = не ограничивать по корпусу (данные курсов/корпуса могут быть неполными). */
        if (courseIds.length === 0) return null;
        const { data: groups } = await supabase.from('student_groups').select('id').in('course_id', courseIds);
        return (groups || []).map(g => g.id);
    };

    const handleLoadStatsByTest = async (testId) => {
        try {
            const { data: testRow, error: testErr } = await supabase
                .from('tests')
                .select('id, title, teacher_id')
                .eq('id', testId)
                .maybeSingle();
            if (testErr) throw testErr;
            if (!testRow || testRow.teacher_id !== session.user.id) {
                sendMessageToIframe({ type: 'STATS_BY_TEST_LOADED', data: { stats: null } });
                return;
            }

            const { data: gt, error: gtErr } = await supabase
                .from('group_tests')
                .select('group_id')
                .eq('test_id', testId);
            if (gtErr) throw gtErr;
            let groupIds = [...new Set((gt || []).map(r => r.group_id).filter(Boolean))];

            const scoped = await getTeacherScopedGroupIds();
            if (scoped !== null && scoped.length > 0) {
                const allow = makeGroupIdSet(scoped);
                groupIds = groupIds.filter((gid) => groupIdMatchesScope(gid, allow));
            }

            let groupsMeta = [];
            if (groupIds.length > 0) {
                const gm = await supabase
                    .from('student_groups')
                    .select('id, group_number, courses(course_number, buildings(name))')
                    .in('id', groupIds);
                if (gm.error) throw gm.error;
                groupsMeta = gm.data || [];
            }

            const metaMap = {};
            groupsMeta.forEach((g) => {
                metaMap[g.id] = g;
            });

            const groupTitle = (g) => {
                if (!g) return '—';
                const gn = g.group_number ?? '?';
                const c = g.courses;
                if (!c) return `Группа ${gn}`;
                const b = c.buildings?.name;
                return `${gn} (${c.course_number} курс${b ? ', ' + b : ''})`;
            };

            let attemptsData = [];
            const attRes = await supabase
                .from('test_attempts')
                .select('user_id, score, completed')
                .eq('test_id', testId);
            if (attRes.error) throw attRes.error;
            attemptsData = attRes.data || [];

            let profilesData = [];
            if (groupIds.length > 0) {
                const pr = await supabase.from('profiles').select('id, group_id').in('group_id', groupIds);
                if (pr.error) throw pr.error;
                profilesData = pr.data || [];
            }

            const groupToUsers = {};
            profilesData.forEach((p) => {
                if (!p.group_id) return;
                if (!groupToUsers[p.group_id]) groupToUsers[p.group_id] = [];
                groupToUsers[p.group_id].push(p.id);
            });

            const rows = groupIds.map((gid) => {
                const uids = groupToUsers[gid] || [];
                const rel = attemptsData.filter((a) => uids.includes(a.user_id));
                const completed = rel.filter((a) => a.completed);
                const peoplePassed = new Set(completed.map((a) => a.user_id)).size;
                const scores = completed.filter((a) => a.score != null).map((a) => a.score);
                const avgScore =
                    scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
                const completedAttempts = completed.length;
                return {
                    groupTitle: groupTitle(metaMap[gid]),
                    peoplePassed,
                    avgScore,
                    completedAttempts,
                };
            });

            sendMessageToIframe({
                type: 'STATS_BY_TEST_LOADED',
                data: { stats: { testTitle: testRow.title, rows } },
            });
        } catch (err) {
            console.error('Stats by test error:', err);
            sendMessageToIframe({ type: 'STATS_BY_TEST_LOADED', data: { stats: null } });
        }
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

    const handleLoadStatsStudentCourses = async () => {
        try {
            const buildingId = await getTeacherBuildingId();
            let query = supabase.from('courses').select('id, course_number, buildings(name)');
            if (buildingId) query = query.eq('building_id', buildingId);
            const { data, error } = await query.order('course_number');
            if (error) throw error;
            const options = (data || []).map((c) => ({
                id: c.id,
                name: `${c.course_number} курс` + (c.buildings ? ` — ${c.buildings.name}` : ''),
            }));
            sendMessageToIframe({ type: 'STATS_STUDENT_COURSES_LOADED', data: { options } });
        } catch (err) {
            console.error('Stats student courses error:', err);
            sendMessageToIframe({ type: 'STATS_STUDENT_COURSES_LOADED', data: { options: [] } });
        }
    };

    const handleLoadStatsStudentGroups = async (courseId) => {
        try {
            const { data, error } = await supabase
                .from('student_groups')
                .select('id, group_number, courses(course_number, buildings(name))')
                .eq('course_id', courseId);
            if (error) throw error;
            const scoped = await getTeacherScopedGroupIds();
            let list = data || [];
            if (scoped !== null && scoped.length > 0) {
                const allow = makeGroupIdSet(scoped);
                list = list.filter((g) => groupIdMatchesScope(g.id, allow));
            }
            const options = list.map((g) => ({
                id: g.id,
                name:
                    `${g.group_number}` +
                    (g.courses
                        ? ` (${g.courses.course_number} курс${g.courses.buildings ? ', ' + g.courses.buildings.name : ''})`
                        : ''),
            }));
            sendMessageToIframe({ type: 'STATS_STUDENT_GROUPS_LOADED', data: { options } });
        } catch (err) {
            console.error('Stats student groups error:', err);
            sendMessageToIframe({ type: 'STATS_STUDENT_GROUPS_LOADED', data: { options: [] } });
        }
    };

    const handleLoadStatsStudentList = async (groupId) => {
        try {
            const gid = normalizeGroupIdForProfileQuery(groupId);
            if (gid == null) {
                sendMessageToIframe({ type: 'STATS_STUDENT_LIST_LOADED', data: { options: [] } });
                return;
            }
            const rpcList = await supabase.rpc('qf_students_in_group', { p_group_id: Number(gid) });
            let rows;
            if (!rpcList.error && rpcList.data != null) {
                rows = rpcList.data;
            } else {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email, role, group_id')
                    .eq('group_id', gid)
                    .order('last_name', { ascending: true });
                if (error) throw error;
                rows = data;
            }
            const options = (rows || [])
                .filter(profileIsStudentForRanking)
                .map((p) => ({
                    id: p.id,
                    name: displayNameFromProfile(p),
                }));
            sendMessageToIframe({ type: 'STATS_STUDENT_LIST_LOADED', data: { options } });
        } catch (err) {
            console.error('Stats student list error:', err);
            sendMessageToIframe({ type: 'STATS_STUDENT_LIST_LOADED', data: { options: [] } });
        }
    };

    const handleLoadStatsByParam = async (paramType, paramValue) => {
        try {
            if (paramType === 'student') {
                const profileId = paramValue;
                const rpcOne = await supabase.rpc('qf_profile_by_id', { p_id: profileId });
                let prof = null;
                if (!rpcOne.error && rpcOne.data != null) {
                    prof = Array.isArray(rpcOne.data) ? rpcOne.data[0] : rpcOne.data;
                }
                if (!prof) {
                    const { data, error: perr } = await supabase
                        .from('profiles')
                        .select(
                            'id, first_name, last_name, email, group_id, student_groups(group_number, courses(course_number, buildings(name)))'
                        )
                        .eq('id', profileId)
                        .maybeSingle();
                    if (perr) throw perr;
                    prof = data;
                } else if (prof.group_id) {
                    const { data: sg } = await supabase
                        .from('student_groups')
                        .select('group_number, courses(course_number, buildings(name))')
                        .eq('id', prof.group_id)
                        .maybeSingle();
                    prof = { ...prof, student_groups: sg || null };
                }
                if (!prof) {
                    sendMessageToIframe({ type: 'STATS_BY_PARAM_LOADED', data: { stats: null } });
                    return;
                }

                const emptyStudent = (name) =>
                    sendMessageToIframe({
                        type: 'STATS_BY_PARAM_LOADED',
                        data: {
                            stats: {
                                mode: 'student',
                                studentName: name,
                                rows: [],
                            },
                        },
                    });

                if (!prof?.group_id) {
                    emptyStudent(displayNameFromProfile(prof || {}));
                    return;
                }

                const { data: gtRows, error: gterr } = await supabase
                    .from('group_tests')
                    .select('test_id')
                    .eq('group_id', prof.group_id);
                if (gterr) throw gterr;
                const testIds = [...new Set((gtRows || []).map((r) => r.test_id).filter(Boolean))];

                if (testIds.length === 0) {
                    emptyStudent(displayNameFromProfile(prof));
                    return;
                }

                const { data: testsData } = await supabase
                    .from('tests')
                    .select('id, title, questions_count')
                    .in('id', testIds);
                const titleByTest = {};
                const qByTest = {};
                (testsData || []).forEach((t) => {
                    titleByTest[t.id] = t.title;
                    qByTest[t.id] = t.questions_count ?? 0;
                });

                let attemptsData = [];
                const ar = await supabase
                    .from('test_attempts')
                    .select('test_id, score, completed, wrong_count, duration_seconds')
                    .eq('user_id', profileId)
                    .in('test_id', testIds);
                if (ar.error) {
                    const ar2 = await supabase
                        .from('test_attempts')
                        .select('test_id, score, completed')
                        .eq('user_id', profileId)
                        .in('test_id', testIds);
                    if (ar2.error) throw ar2.error;
                    attemptsData = ar2.data || [];
                } else {
                    attemptsData = ar.data || [];
                }

                const byTest = {};
                attemptsData.forEach((a) => {
                    if (!byTest[a.test_id]) byTest[a.test_id] = [];
                    byTest[a.test_id].push(a);
                });

                const rows = testIds.map((tid) => {
                    const arr = byTest[tid] || [];
                    const completed = arr.filter((a) => a.completed);
                    if (completed.length === 0) {
                        return {
                            testTitle: titleByTest[tid] || 'Без названия',
                            passed: false,
                            errors: null,
                            timeDisplay: '—',
                            correctnessPct: null,
                        };
                    }
                    const best = completed.reduce((a, b) =>
                        (a.score ?? -1) >= (b.score ?? -1) ? a : b
                    );
                    const qn = qByTest[tid] || 0;
                    let errN =
                        best.wrong_count != null && Number.isFinite(best.wrong_count)
                            ? best.wrong_count
                            : estimateWrongAnswers(qn, best.score);
                    const correctnessPct =
                        best.score != null ? Math.round(best.score * 10) / 10 : null;
                    let timeDisplay = '—';
                    if (best.duration_seconds != null && Number.isFinite(best.duration_seconds)) {
                        timeDisplay = formatDurationSec(best.duration_seconds) || '—';
                    }
                    return {
                        testTitle: titleByTest[tid] || 'Без названия',
                        passed: true,
                        errors: errN,
                        timeDisplay,
                        correctnessPct,
                    };
                });

                sendMessageToIframe({
                    type: 'STATS_BY_PARAM_LOADED',
                    data: {
                        stats: {
                            mode: 'student',
                            studentName: displayNameFromProfile(prof),
                            rows,
                        },
                    },
                });
                return;
            }

            let groupIds = [];
            if (paramType === 'group') {
                groupIds = [paramValue];
            } else if (paramType === 'course') {
                const { data } = await supabase.from('student_groups').select('id').eq('course_id', paramValue);
                groupIds = (data || []).map((g) => g.id);
            }

            if (groupIds.length === 0) {
                sendMessageToIframe({
                    type: 'STATS_BY_PARAM_LOADED',
                    data: { stats: { mode: 'aggregate', rows: [], summary: null } },
                });
                return;
            }

            const { data: gtData } = await supabase.from('group_tests').select('test_id').in('group_id', groupIds);
            const testIds = [...new Set((gtData || []).map((r) => r.test_id))];

            if (testIds.length === 0) {
                sendMessageToIframe({
                    type: 'STATS_BY_PARAM_LOADED',
                    data: { stats: { mode: 'aggregate', rows: [], summary: null } },
                });
                return;
            }

            const { data: testsData } = await supabase.from('tests').select('id, title, questions_count').in('id', testIds);
            const testMap = {};
            const qMap = {};
            (testsData || []).forEach((t) => {
                testMap[t.id] = t.title;
                qMap[t.id] = t.questions_count ?? 0;
            });

            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email')
                .in('group_id', groupIds);
            const profileIds = (profilesData || []).map((p) => p.id);

            let attemptsData = [];
            if (profileIds.length > 0) {
                const ar = await supabase
                    .from('test_attempts')
                    .select('user_id, test_id, score, completed, wrong_count, duration_seconds')
                    .in('test_id', testIds)
                    .in('user_id', profileIds);
                if (ar.error) {
                    const ar2 = await supabase
                        .from('test_attempts')
                        .select('user_id, test_id, score, completed')
                        .in('test_id', testIds)
                        .in('user_id', profileIds);
                    if (ar2.error) throw ar2.error;
                    attemptsData = ar2.data || [];
                } else {
                    attemptsData = ar.data || [];
                }
            }

            const byTest = {};
            attemptsData.forEach((a) => {
                if (!byTest[a.test_id]) byTest[a.test_id] = [];
                byTest[a.test_id].push(a);
            });

            const rows = testIds.map((tid) => {
                const arr = byTest[tid] || [];
                const scores = arr.filter((a) => a.score != null).map((a) => a.score);
                const userIds = new Set(arr.map((a) => a.user_id).filter(Boolean));
                const userIdsCompleted = new Set(
                    arr.filter((a) => a.completed).map((a) => a.user_id).filter(Boolean)
                );
                return {
                    testTitle: testMap[tid] || 'Без названия',
                    attempts: arr.length,
                    uniqueParticipants: userIds.size,
                    peopleCompleted: userIdsCompleted.size,
                    avgScore:
                        scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
                    completed: arr.filter((a) => a.completed).length,
                };
            });

            const students = profilesData || [];
            const nStudents = students.length;
            const nTests = testIds.length;

            let summary;

            if (nStudents > 0 && nTests > 0) {
                const errorSumByUser = {};
                students.forEach((s) => {
                    errorSumByUser[s.id] = 0;
                });

                let finishedAllCount = 0;
                for (const s of students) {
                    const allDone = testIds.every((tid) =>
                        attemptsData.some(
                            (a) => a.user_id === s.id && a.test_id === tid && a.completed
                        )
                    );
                    if (allDone) finishedAllCount++;
                }

                const pctFinishedAll = (100 * finishedAllCount) / nStudents;

                const withAnyCompleted = students.filter((s) =>
                    attemptsData.some((a) => a.user_id === s.id && a.completed)
                );

                for (const s of withAnyCompleted) {
                    for (const tid of testIds) {
                        const attempts = attemptsData.filter(
                            (a) => a.user_id === s.id && a.test_id === tid && a.completed
                        );
                        if (attempts.length === 0) continue;
                        const best = attempts.reduce((a, b) =>
                            (a.score ?? -1) >= (b.score ?? -1) ? a : b
                        );
                        const qn = qMap[tid] || 0;
                        let w =
                            best.wrong_count != null && Number.isFinite(best.wrong_count)
                                ? best.wrong_count
                                : estimateWrongAnswers(qn, best.score);
                        errorSumByUser[s.id] += w ?? 0;
                    }
                }

                let mostErrors = null;
                let fewestErrors = null;
                if (withAnyCompleted.length) {
                    mostErrors = withAnyCompleted.reduce((a, b) =>
                        (errorSumByUser[a.id] ?? 0) >= (errorSumByUser[b.id] ?? 0) ? a : b
                    );
                    fewestErrors = withAnyCompleted.reduce((a, b) =>
                        (errorSumByUser[a.id] ?? Infinity) <= (errorSumByUser[b.id] ?? Infinity)
                            ? a
                            : b
                    );
                }

                const totalDurationForUser = (uid) => {
                    let sum = 0;
                    for (const tid of testIds) {
                        const attempts = attemptsData.filter(
                            (a) => a.user_id === uid && a.test_id === tid && a.completed
                        );
                        if (attempts.length === 0) return null;
                        const best = attempts.reduce((a, b) =>
                            (a.score ?? -1) >= (b.score ?? -1) ? a : b
                        );
                        if (best.duration_seconds == null || !Number.isFinite(best.duration_seconds)) {
                            return null;
                        }
                        sum += best.duration_seconds;
                    }
                    return sum;
                };

                let fastestStudent = null;
                let fastestSec = Infinity;
                for (const s of students) {
                    const allDone = testIds.every((tid) =>
                        attemptsData.some(
                            (a) => a.user_id === s.id && a.test_id === tid && a.completed
                        )
                    );
                    if (!allDone) continue;
                    const ttot = totalDurationForUser(s.id);
                    if (ttot != null && ttot < fastestSec) {
                        fastestSec = ttot;
                        fastestStudent = s;
                    }
                }

                summary = {
                    totalStudents: nStudents,
                    assignedTests: nTests,
                    pctFinishedAll: Math.round(pctFinishedAll * 10) / 10,
                    mostErrors:
                        mostErrors != null
                            ? {
                                  name: displayNameFromProfile(mostErrors),
                                  errors: errorSumByUser[mostErrors.id] ?? 0,
                              }
                            : null,
                    fewestErrors:
                        fewestErrors != null
                            ? {
                                  name: displayNameFromProfile(fewestErrors),
                                  errors: errorSumByUser[fewestErrors.id] ?? 0,
                              }
                            : null,
                    fastest:
                        fastestStudent != null && fastestSec !== Infinity
                            ? {
                                  name: displayNameFromProfile(fastestStudent),
                                  totalTime: formatDurationSec(fastestSec) || String(fastestSec),
                              }
                            : null,
                };
            } else {
                summary = {
                    totalStudents: nStudents,
                    assignedTests: nTests,
                    pctFinishedAll: 0,
                    mostErrors: null,
                    fewestErrors: null,
                    fastest: null,
                };
            }

            sendMessageToIframe({
                type: 'STATS_BY_PARAM_LOADED',
                data: {
                    stats: {
                        mode: 'aggregate',
                        rows,
                        summary,
                    },
                },
            });
        } catch (err) {
            console.error('Stats by param error:', err);
            sendMessageToIframe({
                type: 'STATS_BY_PARAM_LOADED',
                data: { stats: { mode: 'aggregate', rows: [], summary: null } },
            });
        }
    };

    const handleStartTest = async (testId) => {
        devLog('Starting test:', testId);
        alert(`Начинаем тест с ID: ${testId}`);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const sendMessageToIframe = (message) => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            devLog('Sending message to iframe:', message.type);
            iframeRef.current.contentWindow.postMessage(message, window.location.origin);
        }
    };

    return (
        <div
            className="profile-host-root"
            style={{
                width: '100%',
                minHeight: 0,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
            }}
        >
            <iframe
                ref={iframeRef}
                src="/profile.html?v=stats-20260412"
                width="100%"
                height="100%"
                frameBorder="0"
                title="Profile"
                style={{ display: 'block', flex: 1, minHeight: 0, border: 0 }}
                onLoad={() => { devLog('Profile iframe loaded'); syncThemeToIframe(); }}
            />
        </div>
    );
}