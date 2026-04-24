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

function parseDurationSeconds(startedAt, completedAt) {
    if (!startedAt || !completedAt) return null;
    const started = new Date(startedAt).getTime();
    const completed = new Date(completedAt).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null;
    return Math.round((completed - started) / 1000);
}

function normalizeCourseNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.trunc(n);
    if (rounded < 1 || rounded > 4) return null;
    return rounded;
}

export default function Profile({ session, embedded = false, onAvatarUpdated, onStartTest }) {
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
                case 'LOAD_STUDENT_RESULTS_REQUEST':
                    await handleLoadStudentResults(data.profileId, data.groupId);
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

                case 'EDIT_TEST_REQUEST':
                    handleOpenTeacherTests('edit', data.testId);
                    break;

                case 'ASSIGN_GROUPS_REQUEST':
                    handleOpenTeacherTests('assign', data.testId);
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
                    .select('id, title, description, time_limit_minutes, questions_count, attempts_allowed')
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
                    attempts_allowed: Number(testData.maxAttempts) || 1,
                    time_limit_minutes: Number(testData.timeLimitMinutes ?? testData.timeLimit) || null,
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
            const { error: rpcError } = await supabase.rpc('qf_teacher_delete_test', {
                p_test_id: Number(testId),
            });
            if (rpcError) {
                const msg = String(rpcError.message || '');
                const rpcMissing =
                    msg.includes('qf_teacher_delete_test') ||
                    msg.includes('function') ||
                    msg.includes('does not exist') ||
                    rpcError.code === 'PGRST202';
                if (!rpcMissing) throw rpcError;
                const { error } = await supabase
                    .from('tests')
                    .delete()
                    .eq('id', testId)
                    .eq('teacher_id', session.user.id);
                if (error) throw error;
            }

            sendMessageToIframe({
                type: 'TEST_DELETED',
                data: { testId }
            });

            await handleLoadTeacherData(session.user.id);

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

    const handleLoadStudentResults = async (profileId, groupId) => {
        try {
            const { data: authData } = await supabase.auth.getUser();
            const studentId = authData?.user?.id;
            if (!studentId) {
                sendMessageToIframe({ type: 'STUDENT_RESULTS_LOADED', data: { rows: [] } });
                return;
            }
            const prof = profileId != null ? String(profileId).toLowerCase() : '';
            if (prof && prof !== String(studentId).toLowerCase()) {
                sendMessageToIframe({ type: 'STUDENT_RESULTS_LOADED', data: { rows: [] } });
                return;
            }

            const testIdKey = (tid) => (tid == null || tid === '' ? null : String(tid));

            let assignedTestIds = [];
            if (groupId) {
                const { data: assignments, error: assErr } = await supabase
                    .from('group_tests')
                    .select('test_id')
                    .eq('group_id', groupId);
                if (assErr) throw assErr;
                assignedTestIds = [
                    ...new Set((assignments || []).map((a) => testIdKey(a.test_id)).filter(Boolean)),
                ];
            }

            let resultRows = [];
            const rpcRes = await supabase.rpc('qf_student_my_test_results');
            if (!rpcRes.error && Array.isArray(rpcRes.data)) {
                resultRows = rpcRes.data.filter(
                    (r) => r.status == null || r.status === 'completed'
                );
            } else {
                const resErr = rpcRes.error;
                const msg = resErr ? String(resErr.message || '') : '';
                const rpcMissing =
                    msg.includes('qf_student_my_test_results') ||
                    msg.includes('function') ||
                    msg.includes('does not exist') ||
                    resErr?.code === 'PGRST202';
                if (resErr && !rpcMissing) throw resErr;

                const { data: results, error: directErr } = await supabase
                    .from('test_results')
                    .select('test_id, percentage, score, status, started_at, completed_at')
                    .eq('student_id', studentId);
                if (directErr) throw directErr;
                resultRows = (results || []).filter(
                    (r) => r.status == null || r.status === 'completed'
                );
            }

            const resultTestIds = [
                ...new Set(resultRows.map((r) => testIdKey(r.test_id)).filter(Boolean)),
            ];
            const testIdsForList = [...new Set([...assignedTestIds, ...resultTestIds])];

            let tests = [];
            if (testIdsForList.length > 0) {
                const { data: testsData, error: testsErr } = await supabase
                    .from('tests')
                    .select('id, title')
                    .in('id', testIdsForList);
                if (testsErr) throw testsErr;
                tests = testsData || [];
            }

            const byTest = {};
            resultRows.forEach((r) => {
                const tid = testIdKey(r.test_id);
                if (!tid) return;
                if (!byTest[tid]) byTest[tid] = [];
                byTest[tid].push(r);
            });
            const testsMap = Object.fromEntries((tests || []).map((t) => [String(t.id), t]));
            const rows = testIdsForList.map((testId) => {
                const tKey = testIdKey(testId);
                const attempts = tKey ? byTest[tKey] || [] : [];
                let best = null;
                attempts.forEach((r) => {
                    const score = r.percentage != null ? Number(r.percentage) || 0 : Number(r.score) || 0;
                    const bestScore =
                        best == null
                            ? -1
                            : best.percentage != null
                                ? Number(best.percentage) || 0
                                : Number(best.score) || 0;
                    if (best == null || score > bestScore) best = r;
                });
                const started = best?.started_at ? new Date(best.started_at).getTime() : null;
                const completed = best?.completed_at ? new Date(best.completed_at).getTime() : null;
                const durationSec =
                    started && completed && completed >= started ? Math.round((completed - started) / 1000) : null;
                const titleFromRpc =
                    best && typeof best.test_title === 'string' && best.test_title
                        ? best.test_title
                        : null;
                return {
                    testId,
                    testTitle:
                        titleFromRpc ||
                        testsMap[String(testId)]?.title ||
                        `Тест #${testId}`,
                    attemptsUsed: attempts.length,
                    passed: !!best,
                    bestResult:
                        best?.percentage != null
                            ? Number(best.percentage) || 0
                            : best?.score != null
                                ? Number(best.score) || 0
                                : null,
                    durationSec,
                };
            }).sort((a, b) => Number(b.bestResult ?? -1) - Number(a.bestResult ?? -1));

            sendMessageToIframe({ type: 'STUDENT_RESULTS_LOADED', data: { rows } });
        } catch (err) {
            console.error('Student results loading error:', err);
            sendMessageToIframe({ type: 'STUDENT_RESULTS_LOADED', data: { rows: [] } });
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

            let profilesData = [];
            if (groupIds.length > 0) {
                const studentsById = {};
                for (const gid of groupIds) {
                    const n = Number(gid);
                    if (!Number.isFinite(n)) continue;
                    const rpcStudents = await supabase.rpc('qf_students_in_group', { p_group_id: n });
                    if (rpcStudents.error) continue;
                    (rpcStudents.data || []).forEach((student) => {
                        studentsById[String(student.id)] = { ...student, group_id: gid };
                    });
                }
                profilesData = Object.values(studentsById);
                if (profilesData.length === 0) {
                    const pr = await supabase
                        .from('profiles')
                        .select('id, first_name, last_name, email, group_id')
                        .in('group_id', groupIds);
                    if (pr.error) throw pr.error;
                    profilesData = pr.data || [];
                }
            }
            const studentIds = profilesData.map((p) => p.id);

            let attemptsData = [];
            if (studentIds.length > 0) {
                const attRes = await supabase.rpc('qf_teacher_test_results', {
                    p_test_id: Number(testId),
                });
                if (attRes.error) {
                    const msg = String(attRes.error.message || '');
                    const rpcMissing =
                        msg.includes('qf_teacher_test_results') ||
                        msg.includes('function') ||
                        msg.includes('does not exist') ||
                        attRes.error.code === 'PGRST202';
                    if (!rpcMissing) throw attRes.error;
                    const fallback = await supabase
                        .from('test_results')
                        .select('student_id, percentage, score, status, started_at, completed_at')
                        .eq('test_id', testId)
                        .in('student_id', studentIds);
                    if (fallback.error) throw fallback.error;
                    attemptsData = fallback.data || [];
                } else {
                    attemptsData = (attRes.data || []).filter((row) => studentIds.includes(row.student_id));
                }
            }

            const bestAttemptByStudent = {};
            attemptsData.forEach((attempt) => {
                const sid = attempt.student_id;
                if (!sid) return;
                const pct =
                    attempt.percentage != null
                        ? Number(attempt.percentage) || 0
                        : Number(attempt.score) || 0;
                const prev = bestAttemptByStudent[sid];
                const prevPct =
                    prev?.percentage != null ? Number(prev.percentage) || 0 : Number(prev?.score) || 0;
                if (!prev || pct > prevPct) {
                    bestAttemptByStudent[sid] = attempt;
                }
            });

            const studentRows = profilesData
                .map((student) => {
                    const best = bestAttemptByStudent[student.id] || null;
                    const durationSec = parseDurationSeconds(best?.started_at, best?.completed_at);
                    const score =
                        best?.percentage != null
                            ? Number(best.percentage) || 0
                            : best?.score != null
                                ? Number(best.score) || 0
                                : null;
                    return {
                        studentId: student.id,
                        studentName: displayNameFromProfile(student),
                        groupTitle: groupTitle(metaMap[student.group_id]),
                        passed: !!best,
                        score,
                        duration: formatDurationSec(durationSec),
                    };
                })
                .sort((a, b) => Number(b.score ?? -1) - Number(a.score ?? -1));

            const groupRows = groupIds.map((gid) => {
                const rows = studentRows.filter((row) => String(profilesData.find((p) => p.id === row.studentId)?.group_id) === String(gid));
                const passed = rows.filter((r) => r.passed && r.score != null);
                const avgScore = passed.length > 0 ? passed.reduce((s, r) => s + Number(r.score || 0), 0) / passed.length : null;
                return {
                    groupTitle: groupTitle(metaMap[gid]),
                    assignedStudents: rows.length,
                    peoplePassed: passed.length,
                    avgScore,
                };
            });

            const passedRows = studentRows.filter((r) => r.passed && r.score != null);
            const summary = {
                assignedStudents: studentRows.length,
                passedStudents: passedRows.length,
                avgScore: passedRows.length > 0 ? passedRows.reduce((s, r) => s + Number(r.score || 0), 0) / passedRows.length : null,
            };

            sendMessageToIframe({
                type: 'STATS_BY_TEST_LOADED',
                data: { stats: { testTitle: testRow.title, summary, groupRows, studentRows } },
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
                options = (data || [])
                    .map((c) => {
                        const courseNumber = normalizeCourseNumber(c.course_number);
                        if (courseNumber == null) return null;
                        return {
                            id: c.id,
                            courseNumber,
                            name: `${courseNumber} курс` + (c.buildings ? ` — ${c.buildings.name}` : ''),
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.courseNumber - b.courseNumber || String(a.name).localeCompare(String(b.name)))
                    .map(({ id, name }) => ({ id, name }));
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
            const options = (data || [])
                .map((c) => {
                    const courseNumber = normalizeCourseNumber(c.course_number);
                    if (courseNumber == null) return null;
                    return {
                        id: c.id,
                        courseNumber,
                        name: `${courseNumber} курс` + (c.buildings ? ` — ${c.buildings.name}` : ''),
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.courseNumber - b.courseNumber || String(a.name).localeCompare(String(b.name)))
                .map(({ id, name }) => ({ id, name }));
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
                const assignedTestIds = [...new Set((gtRows || []).map((r) => r.test_id).filter(Boolean))];

                let attemptsData = [];
                {
                    const rpcAttempts = await supabase.rpc('qf_teacher_test_results_enriched', { p_test_id: null });
                    if (!rpcAttempts.error && Array.isArray(rpcAttempts.data)) {
                        attemptsData = (rpcAttempts.data || []).filter(
                            (row) => String(row.student_id) === String(profileId)
                        );
                    } else {
                        const { data, error: attemptsErr } = await supabase
                            .from('test_results')
                            .select('test_id, percentage, score, status, started_at, completed_at')
                            .eq('student_id', profileId);
                        if (attemptsErr) throw attemptsErr;
                        attemptsData = data || [];
                    }
                }
                const attemptedTestIds = [...new Set((attemptsData || []).map((r) => r.test_id).filter(Boolean))];
                const testIds = [...new Set([...assignedTestIds, ...attemptedTestIds])];

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

                const byTest = {};
                attemptsData.forEach((a) => {
                    if (!byTest[a.test_id]) byTest[a.test_id] = [];
                    byTest[a.test_id].push(a);
                });

                const rows = testIds.map((tid) => {
                    const arr = byTest[tid] || [];
                    const completed = arr.filter((a) => a.status === 'completed');
                    const anyWithScore = arr.filter((a) => a.percentage != null || a.score != null);
                    if (completed.length === 0 && anyWithScore.length === 0) {
                        return {
                            testTitle: titleByTest[tid] || 'Без названия',
                            passed: false,
                            errors: null,
                            timeDisplay: '—',
                            correctnessPct: null,
                        };
                    }
                    const pickHigher = (a, b) => {
                        const ap = a.percentage != null ? Number(a.percentage) : Number(a.score);
                        const bp = b.percentage != null ? Number(b.percentage) : Number(b.score);
                        return (ap ?? -1) >= (bp ?? -1) ? a : b;
                    };
                    const bestCompleted =
                        completed.length > 0 ? completed.reduce((a, b) => pickHigher(a, b)) : null;
                    const bestAny =
                        anyWithScore.length > 0 ? anyWithScore.reduce((a, b) => pickHigher(a, b)) : null;
                    const best = bestCompleted || bestAny;
                    const qn = qByTest[tid] || 0;
                    const rawPct =
                        best?.percentage != null
                            ? Number(best.percentage)
                            : best?.score != null
                                ? Number(best.score)
                                : null;
                    const correctnessPct =
                        rawPct != null && Number.isFinite(rawPct)
                            ? Math.round(rawPct * 10) / 10
                            : null;
                    const errN = correctnessPct == null ? null : estimateWrongAnswers(qn, correctnessPct);
                    return {
                        testTitle: titleByTest[tid] || 'Без названия',
                        passed: completed.length > 0,
                        errors: errN,
                        timeDisplay: formatDurationSec(parseDurationSeconds(best?.started_at, best?.completed_at)),
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

            const studentsById = {};
            for (const gid of groupIds) {
                const n = Number(gid);
                if (!Number.isFinite(n)) continue;
                const rpcStudents = await supabase.rpc('qf_students_in_group', { p_group_id: n });
                if (rpcStudents.error) continue;
                (rpcStudents.data || []).forEach((student) => {
                    studentsById[String(student.id)] = student;
                });
            }
            let profilesData = Object.values(studentsById);
            if (profilesData.length === 0) {
                const { data: profFallback } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email')
                    .in('group_id', groupIds);
                profilesData = profFallback || [];
            }
            const profileIds = profilesData.map((p) => p.id);

            let attemptsData = [];
            if (profileIds.length > 0) {
                const enriched = await supabase.rpc('qf_teacher_test_results_enriched', { p_test_id: null });
                if (!enriched.error && Array.isArray(enriched.data)) {
                    const testIdSet = new Set(testIds.map((id) => String(id)));
                    const profileIdSet = new Set(profileIds.map((id) => String(id)));
                    attemptsData = enriched.data.filter(
                        (row) =>
                            testIdSet.has(String(row.test_id)) &&
                            profileIdSet.has(String(row.student_id))
                    );
                } else {
                    const ar = await supabase
                        .from('test_results')
                        .select('student_id, test_id, percentage, status, started_at, completed_at')
                        .in('test_id', testIds)
                        .in('student_id', profileIds);
                    if (ar.error) throw ar.error;
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
                const scores = arr
                    .filter((a) => a.status === 'completed' && a.percentage != null)
                    .map((a) => Number(a.percentage));
                const userIds = new Set(arr.map((a) => a.student_id).filter(Boolean));
                const userIdsCompleted = new Set(
                    arr.filter((a) => a.status === 'completed').map((a) => a.student_id).filter(Boolean)
                );
                return {
                    testTitle: testMap[tid] || 'Без названия',
                    attempts: arr.length,
                    uniqueParticipants: userIds.size,
                    peopleCompleted: userIdsCompleted.size,
                    avgScore:
                        scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
                    completed: arr.filter((a) => a.status === 'completed').length,
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
                            (a) => a.student_id === s.id && a.test_id === tid && a.status === 'completed'
                        )
                    );
                    if (allDone) finishedAllCount++;
                }

                const pctFinishedAll = (100 * finishedAllCount) / nStudents;

                const withAnyCompleted = students.filter((s) =>
                    attemptsData.some((a) => a.student_id === s.id && a.status === 'completed')
                );

                for (const s of withAnyCompleted) {
                    for (const tid of testIds) {
                        const attempts = attemptsData.filter(
                            (a) => a.student_id === s.id && a.test_id === tid && a.status === 'completed'
                        );
                        if (attempts.length === 0) continue;
                        const best = attempts.reduce((a, b) =>
                            (a.percentage ?? -1) >= (b.percentage ?? -1) ? a : b
                        );
                        const qn = qMap[tid] || 0;
                        let w = estimateWrongAnswers(qn, best.percentage);
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

                summary = {
                    totalStudents: nStudents,
                    assignedTests: nTests,
                    finishedAllCount,
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
                    fastest: null,
                };
                const withTotalDuration = withAnyCompleted
                    .map((student) => {
                        let totalDuration = 0;
                        let valid = false;
                        for (const tid of testIds) {
                            const completedAttempts = attemptsData.filter(
                                (a) =>
                                    a.student_id === student.id &&
                                    a.test_id === tid &&
                                    a.status === 'completed'
                            );
                            if (completedAttempts.length === 0) continue;
                            const best = completedAttempts.reduce((a, b) =>
                                (a.percentage ?? -1) >= (b.percentage ?? -1) ? a : b
                            );
                            const dur = parseDurationSeconds(best.started_at, best.completed_at);
                            if (dur != null) {
                                totalDuration += dur;
                                valid = true;
                            }
                        }
                        return valid ? { student, totalDuration } : null;
                    })
                    .filter(Boolean);
                if (withTotalDuration.length > 0) {
                    withTotalDuration.sort((a, b) => a.totalDuration - b.totalDuration);
                    const fastest = withTotalDuration[0];
                    summary.fastest = {
                        name: displayNameFromProfile(fastest.student),
                        totalTime: formatDurationSec(fastest.totalDuration),
                    };
                }
            } else {
                summary = {
                    totalStudents: nStudents,
                    assignedTests: nTests,
                    finishedAllCount: 0,
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
        if (onStartTest) {
            onStartTest(testId);
            return;
        }
        window.location.assign(`/test/${testId}`);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleOpenTeacherTests = (action, testId) => {
        const payload = {
            action: action === 'assign' ? 'assign' : 'edit',
            testId: testId == null ? '' : String(testId),
        };
        try {
            sessionStorage.setItem('qf_teacher_active_tab', 'tests');
            sessionStorage.setItem('qf_teacher_tests_intent', JSON.stringify(payload));
        } catch {
            /* ignore */
        }
        window.dispatchEvent(new CustomEvent('qf-teacher-open-tests', { detail: payload }));
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