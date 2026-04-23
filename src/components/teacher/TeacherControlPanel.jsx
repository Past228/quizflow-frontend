import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

const QUESTION_TYPES = {
  single: 'single',
  multiple: 'multiple',
  matching: 'matching',
};

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createChoiceOption() {
  return { id: makeId('opt'), text: '', isCorrect: false };
}

function createMatchingPair() {
  return { id: makeId('pair'), left: '', right: '' };
}

function createQuestionDraft() {
  return {
    id: makeId('q'),
    type: QUESTION_TYPES.single,
    text: '',
    difficulty: 0,
    estimatedTimeSeconds: 60,
    options: [createChoiceOption(), createChoiceOption()],
    pairs: [createMatchingPair()],
  };
}

function createTestDraft() {
  return {
    title: '',
    description: '',
    attemptsAllowed: 1,
    timeLimitMinutes: 20,
    questions: [createQuestionDraft()],
  };
}

function formatDuration(seconds) {
  const safe = Number(seconds);
  if (!Number.isFinite(safe) || safe < 0) return '—';
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function TeacherControlPanel({ session }) {
  const [tests, setTests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [assignedGroupIds, setAssignedGroupIds] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [resultRows, setResultRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState(null);
  const [testDraft, setTestDraft] = useState(createTestDraft);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('id, title, description, is_active, questions_count, attempts_allowed, created_at')
        .eq('teacher_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const testsList = data || [];
      const testIds = testsList.map((t) => t.id);
      if (testIds.length > 0) {
        const { data: questionRows, error: qErr } = await supabase
          .from('test_questions')
          .select('test_id')
          .in('test_id', testIds);
        if (qErr) throw qErr;
        const actualCountMap = {};
        (questionRows || []).forEach((row) => {
          actualCountMap[row.test_id] = (actualCountMap[row.test_id] || 0) + 1;
        });
        setTests(
          testsList.map((test) => ({
            ...test,
            questions_count: actualCountMap[test.id] ?? 0,
          }))
        );
      } else {
        setTests(testsList);
      }
    } catch (err) {
      console.error('Failed to load tests:', err);
      setNotice({ type: 'error', text: 'Не удалось загрузить тесты.' });
    } finally {
      setLoading(false);
    }
  }, [session]);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_groups')
        .select('id, group_number, courses(course_number, buildings(name))')
        .order('group_number', { ascending: true });
      if (error) throw error;
      setGroups(data || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
      setNotice({ type: 'error', text: 'Не удалось загрузить группы.' });
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadAssignedGroups = useCallback(async (testId) => {
    if (!testId) {
      setAssignedGroupIds([]);
      setSelectedGroupIds([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('group_tests')
        .select('group_id')
        .eq('test_id', testId);
      if (error) throw error;
      const ids = [...new Set((data || []).map((row) => String(row.group_id)))];
      setAssignedGroupIds(ids);
      setSelectedGroupIds(ids);
    } catch (err) {
      console.error('Failed to load assigned groups:', err);
      setNotice({ type: 'error', text: 'Не удалось загрузить назначения теста.' });
      setAssignedGroupIds([]);
      setSelectedGroupIds([]);
    }
  }, []);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const { data: latestTests, error: latestTestsError } = await supabase
        .from('tests')
        .select('id, title')
        .eq('teacher_id', session.user.id);
      if (latestTestsError) throw latestTestsError;

      const testsForResults = latestTests || [];
      const testIds = testsForResults.map((t) => t.id);
      if (testIds.length === 0) {
        setResultRows([]);
        return;
      }

      const [assignmentsRes, attemptsRes] = await Promise.all([
        supabase.from('group_tests').select('test_id, group_id').in('test_id', testIds),
        supabase.rpc('qf_teacher_test_results', { p_test_id: null }),
      ]);

      if (assignmentsRes.error) throw assignmentsRes.error;
      let attempts = [];
      if (attemptsRes.error) {
        const msg = String(attemptsRes.error.message || '');
        const rpcMissing =
          msg.includes('qf_teacher_test_results') ||
          msg.includes('function') ||
          msg.includes('does not exist') ||
          attemptsRes.error.code === 'PGRST202';
        if (!rpcMissing) throw attemptsRes.error;
        const fallback = await supabase
          .from('test_results')
          .select('test_id, student_id, percentage, score, status, started_at, completed_at')
          .in('test_id', testIds);
        if (fallback.error) throw fallback.error;
        attempts = fallback.data || [];
      } else {
        attempts = attemptsRes.data || [];
      }

      const assignments = assignmentsRes.data || [];
      attempts = attempts.filter((row) => testIds.includes(row.test_id));

      const allGroupIds = [...new Set(assignments.map((a) => a.group_id).filter(Boolean))];
      const [groupsRes, studentsRes] = await Promise.all([
        allGroupIds.length > 0
          ? supabase
              .from('student_groups')
              .select('id, group_number, courses(course_number, buildings(name))')
              .in('id', allGroupIds)
          : Promise.resolve({ data: [] }),
        allGroupIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, first_name, last_name, email, group_id')
              .in('group_id', allGroupIds)
          : Promise.resolve({ data: [] }),
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (studentsRes.error) throw studentsRes.error;

      const groupsMap = Object.fromEntries((groupsRes.data || []).map((g) => [String(g.id), g]));
      const students = [...(studentsRes.data || [])];
      const knownStudentIdSet = new Set(students.map((s) => String(s.id)));
      const attemptStudentIds = [...new Set(attempts.map((a) => String(a.student_id || '')).filter(Boolean))];
      const missingStudentIds = attemptStudentIds.filter((id) => !knownStudentIdSet.has(id));
      if (missingStudentIds.length > 0) {
        const missingProfilesRes = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, group_id')
          .in('id', missingStudentIds);
        if (missingProfilesRes.error) throw missingProfilesRes.error;
        students.push(...(missingProfilesRes.data || []));
      }
      const studentsById = Object.fromEntries(students.map((s) => [String(s.id), s]));

      const rows = testsForResults.map((test) => {
        const testAssignments = assignments.filter((a) => String(a.test_id) === String(test.id));
        const assignedGroupIdsForTest = [...new Set(testAssignments.map((a) => String(a.group_id)).filter(Boolean))];
        const assignedStudents = students.filter((s) => assignedGroupIdsForTest.includes(String(s.group_id)));
        const assignedStudentIds = new Set(assignedStudents.map((s) => String(s.id)));
        let testAttempts = attempts.filter((a) => String(a.test_id) === String(test.id));
        if (assignedStudentIds.size > 0) {
          testAttempts = testAttempts.filter((a) => assignedStudentIds.has(String(a.student_id)));
        }
        const completedAttempts = testAttempts.filter(
          (a) => a.status === 'completed' || !!a.completed_at
        );
        const attemptStudents = [
          ...new Set(
            completedAttempts
              .map((a) => studentsById[String(a.student_id)])
              .filter(Boolean)
          ),
        ];
        const baseStudents = assignedStudents.length > 0 ? assignedStudents : attemptStudents;

        const bestAttemptByStudent = {};
        completedAttempts.forEach((attempt) => {
          const key = String(attempt.student_id || '');
          if (!key) return;
          const pct =
            attempt.percentage != null
              ? Number(attempt.percentage) || 0
              : Number(attempt.score) || 0;
          const prev = bestAttemptByStudent[key];
          const prevPct =
            prev?.percentage != null ? Number(prev.percentage) || 0 : Number(prev?.score) || 0;
          if (!prev || pct > prevPct) {
            bestAttemptByStudent[key] = attempt;
          }
        });

        const studentRows = baseStudents
          .map((student) => {
            const best = bestAttemptByStudent[String(student.id)] || null;
            const started = best?.started_at ? new Date(best.started_at).getTime() : null;
            const completed = best?.completed_at ? new Date(best.completed_at).getTime() : null;
            const durationSeconds =
              started && completed && completed >= started ? Math.round((completed - started) / 1000) : null;
            const groupMeta = groupsMap[String(student.group_id)];
            const groupTitle = groupMeta
              ? `Группа ${groupMeta.group_number}${
                  groupMeta.courses
                    ? ` (${groupMeta.courses.course_number} курс${
                        groupMeta.courses.buildings?.name ? `, ${groupMeta.courses.buildings.name}` : ''
                      })`
                    : ''
                }`
              : 'Группа не указана';
            return {
              studentId: student.id,
              studentName:
                [student.last_name, student.first_name].filter(Boolean).join(' ').trim() ||
                student.email ||
                'Студент',
              groupTitle,
              passed: !!best,
              percentage:
                best?.percentage != null
                  ? Number(best.percentage) || 0
                  : best?.score != null
                    ? Number(best.score) || 0
                    : null,
              durationSeconds,
            };
          })
          .sort((a, b) => Number(b.percentage || -1) - Number(a.percentage || -1));

        const passedRows = studentRows.filter((row) => row.passed && row.percentage != null);
        const avgScore =
          passedRows.length > 0
            ? passedRows.reduce((sum, row) => sum + Number(row.percentage || 0), 0) / passedRows.length
            : null;

        return {
          testId: test.id,
          testTitle: test.title || 'Без названия',
          assignedGroups: assignedGroupIdsForTest.length,
          assignedStudentsTotal: baseStudents.length,
          passedStudentsTotal: studentRows.filter((row) => row.passed).length,
          avgScore,
          studentRows,
        };
      });

      setResultRows(rows);
    } catch (err) {
      console.error('Failed to load results:', err);
      setNotice({ type: 'error', text: 'Не удалось загрузить результаты.' });
      setResultRows([]);
    } finally {
      setResultsLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    loadTests();
    loadGroups();
  }, [loadTests, loadGroups]);

  const resetCreateDraft = () => {
    setTestDraft(createTestDraft());
  };

  const openCreateModal = () => {
    resetCreateDraft();
    setShowCreateModal(true);
  };

  const updateDraftField = (field, value) => {
    setTestDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateQuestionField = (questionId, field, value) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId ? { ...question, [field]: value } : question
      ),
    }));
  };

  const changeQuestionType = (questionId, nextType) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) return question;
        return {
          ...question,
          type: nextType,
          options:
            nextType === QUESTION_TYPES.matching
              ? question.options
              : question.options.length >= 2
                ? question.options
                : [createChoiceOption(), createChoiceOption()],
          pairs:
            nextType === QUESTION_TYPES.matching
              ? question.pairs.length > 0
                ? question.pairs
                : [createMatchingPair()]
              : question.pairs,
        };
      }),
    }));
  };

  const addQuestion = () => {
    setTestDraft((prev) => ({ ...prev, questions: [...prev.questions, createQuestionDraft()] }));
  };

  const removeQuestion = (questionId) => {
    setTestDraft((prev) => {
      if (prev.questions.length <= 1) return prev;
      return { ...prev, questions: prev.questions.filter((question) => question.id !== questionId) };
    });
  };

  const addOption = (questionId) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId
          ? { ...question, options: [...question.options, createChoiceOption()] }
          : question
      ),
    }));
  };

  const removeOption = (questionId, optionId) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) return question;
        if (question.options.length <= 2) return question;
        return { ...question, options: question.options.filter((option) => option.id !== optionId) };
      }),
    }));
  };

  const updateOptionField = (questionId, optionId, field, value) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) return question;
        if (field === 'isCorrect' && question.type === QUESTION_TYPES.single && value) {
          return {
            ...question,
            options: question.options.map((option) =>
              option.id === optionId
                ? { ...option, isCorrect: true }
                : { ...option, isCorrect: false }
            ),
          };
        }
        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId ? { ...option, [field]: value } : option
          ),
        };
      }),
    }));
  };

  const addPair = (questionId) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId ? { ...question, pairs: [...question.pairs, createMatchingPair()] } : question
      ),
    }));
  };

  const removePair = (questionId, pairId) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) return question;
        if (question.pairs.length <= 1) return question;
        return { ...question, pairs: question.pairs.filter((pair) => pair.id !== pairId) };
      }),
    }));
  };

  const updatePairField = (questionId, pairId, field, value) => {
    setTestDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              pairs: question.pairs.map((pair) =>
                pair.id === pairId ? { ...pair, [field]: value } : pair
              ),
            }
          : question
      ),
    }));
  };

  const validateDraft = () => {
    if (!testDraft.title.trim()) return 'Введите название теста.';
    if (!testDraft.questions.length) return 'Добавьте хотя бы один вопрос.';
    for (let index = 0; index < testDraft.questions.length; index += 1) {
      const question = testDraft.questions[index];
      if (!question.text.trim()) return `Вопрос ${index + 1}: заполните текст вопроса.`;
      if (question.type === QUESTION_TYPES.matching) {
        const filledPairs = question.pairs.filter((pair) => pair.left.trim() && pair.right.trim());
        if (filledPairs.length < 1) return `Вопрос ${index + 1}: добавьте хотя бы одну пару соответствий.`;
      } else {
        const filledOptions = question.options.filter((option) => option.text.trim());
        if (filledOptions.length < 2) return `Вопрос ${index + 1}: нужно минимум 2 варианта ответа.`;
        const correctCount = filledOptions.filter((option) => option.isCorrect).length;
        if (question.type === QUESTION_TYPES.single && correctCount !== 1) {
          return `Вопрос ${index + 1}: для одиночного выбора должен быть ровно 1 правильный ответ.`;
        }
        if (question.type === QUESTION_TYPES.multiple && correctCount < 1) {
          return `Вопрос ${index + 1}: для множественного выбора отметьте хотя бы 1 правильный ответ.`;
        }
      }
    }
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const validationError = validateDraft();
    if (validationError) {
      setNotice({ type: 'error', text: validationError });
      return;
    }

    setCreating(true);
    try {
      const { data: createdTest, error: testError } = await supabase
        .from('tests')
        .insert({
          title: testDraft.title.trim(),
          description: testDraft.description.trim() || null,
          attempts_allowed: Number(testDraft.attemptsAllowed) || 1,
          time_limit_minutes: Number(testDraft.timeLimitMinutes) || null,
          questions_count: testDraft.questions.length,
          teacher_id: session.user.id,
          is_active: true,
        })
        .select('id')
        .single();
      if (testError) throw testError;

      for (const question of testDraft.questions) {
        const { data: createdQuestion, error: questionError } = await supabase
          .from('test_questions')
          .insert({
            test_id: createdTest.id,
            question_text: question.text.trim(),
            difficulty: Number(question.difficulty) || 0,
            estimated_time_seconds: Number(question.estimatedTimeSeconds) || 60,
            is_active: true,
          })
          .select('id')
          .single();
        if (questionError) throw questionError;

        const optionPayload =
          question.type === QUESTION_TYPES.matching
            ? question.pairs
                .filter((pair) => pair.left.trim() && pair.right.trim())
                .map((pair, idx) => ({
                  question_id: createdQuestion.id,
                  option_text: pair.left.trim(),
                  explanation: pair.right.trim(),
                  is_correct: true,
                  position: idx,
                }))
            : question.options
                .filter((option) => option.text.trim())
                .map((option, idx) => ({
                  question_id: createdQuestion.id,
                  option_text: option.text.trim(),
                  is_correct: !!option.isCorrect,
                  position: idx,
                }));

        if (optionPayload.length > 0) {
          const { error: optionsError } = await supabase.from('test_question_options').insert(optionPayload);
          if (optionsError) throw optionsError;
        }
      }

      setShowCreateModal(false);
      setNotice({ type: 'success', text: 'Тест и вопросы успешно сохранены в базу.' });
      await loadTests();
    } catch (err) {
      setNotice({ type: 'error', text: 'Ошибка создания теста: ' + err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить этот тест?')) return;
    try {
      const { error: rpcError } = await supabase.rpc('qf_teacher_delete_test', {
        p_test_id: Number(id),
      });
      if (rpcError) {
        const msg = String(rpcError.message || '');
        const rpcMissing =
          msg.includes('qf_teacher_delete_test') ||
          msg.includes('function') ||
          msg.includes('does not exist') ||
          rpcError.code === 'PGRST202';
        if (!rpcMissing) throw rpcError;
        const { error } = await supabase.from('tests').delete().eq('id', id).eq('teacher_id', session.user.id);
        if (error) throw error;
      }
      if (selectedTestId === String(id)) {
        setSelectedTestId('');
        setAssignedGroupIds([]);
        setSelectedGroupIds([]);
      }
      setNotice({ type: 'success', text: 'Тест удален.' });
      await loadTests();
      if (view === 'results') await loadResults();
    } catch (err) {
      setNotice({ type: 'error', text: 'Ошибка удаления теста: ' + err.message });
    }
  };

  const handleToggleActive = async (id, currentlyActive) => {
    try {
      const { error } = await supabase
        .from('tests')
        .update({ is_active: !currentlyActive })
        .eq('id', id)
        .eq('teacher_id', session.user.id);
      if (error) throw error;
      setNotice({
        type: 'success',
        text: currentlyActive ? 'Тест деактивирован.' : 'Тест активирован.',
      });
      loadTests();
    } catch (err) {
      setNotice({ type: 'error', text: 'Ошибка изменения статуса: ' + err.message });
    }
  };

  const [view, setView] = useState('actions');
  const selectedTest = useMemo(
    () => tests.find((test) => String(test.id) === String(selectedTestId)) || null,
    [tests, selectedTestId]
  );

  useEffect(() => {
    if (view === 'results') {
      loadResults();
    }
  }, [view, loadResults]);

  useEffect(() => {
    if (view === 'groups' && selectedTestId) {
      loadAssignedGroups(selectedTestId);
    }
  }, [view, selectedTestId, loadAssignedGroups]);

  const toggleGroupSelection = (groupId) => {
    const id = String(groupId);
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveAssignments = async () => {
    if (!selectedTestId) {
      setNotice({ type: 'error', text: 'Сначала выберите тест.' });
      return;
    }

    setAssigning(true);
    try {
      const selectedSet = new Set(selectedGroupIds.map((id) => String(id)));
      const assignedSet = new Set(assignedGroupIds.map((id) => String(id)));

      const toInsert = [...selectedSet]
        .filter((groupId) => !assignedSet.has(groupId))
        .map((groupId) => ({ test_id: selectedTestId, group_id: Number(groupId) }));

      const toDelete = [...assignedSet].filter((groupId) => !selectedSet.has(groupId));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('group_tests').insert(toInsert);
        if (insertError) throw insertError;
      }

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('group_tests')
          .delete()
          .eq('test_id', selectedTestId)
          .in('group_id', toDelete.map((id) => Number(id)));
        if (deleteError) throw deleteError;
      }

      await loadAssignedGroups(selectedTestId);
      setNotice({ type: 'success', text: 'Назначения сохранены.' });
    } catch (err) {
      console.error('Failed to save assignments:', err);
      setNotice({ type: 'error', text: 'Ошибка сохранения назначений: ' + err.message });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      style={{
        padding: '28px 32px 40px',
        flex: '0 0 auto',
        alignSelf: 'stretch',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div className="student-page student-page--wide" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 className="student-page-title" style={{ color: 'var(--qf-bright-blue)' }}>ПАНЕЛЬ УПРАВЛЕНИЯ</h1>
        {notice && (
          <div
            style={{
              marginBottom: 18,
              borderRadius: 12,
              padding: '12px 16px',
              fontFamily: 'var(--qf-font)',
              fontWeight: 600,
              background: notice.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: notice.type === 'error' ? '#991b1b' : '#166534',
            }}
          >
            {notice.text}
          </div>
        )}

        <div className="student-card" style={{ padding: '24px 28px', marginBottom: 28 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
            }}
          >
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                background: 'var(--qf-card)',
                border: '2px solid var(--qf-accent-border-soft, #e5e7eb)',
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>📝</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Создать тест
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('tests')}
              style={{
                background: view === 'tests' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
                border: '2px solid ' + (view === 'tests' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                if (view !== 'tests') e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>📋</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Мои тесты
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('groups')}
              style={{
                background: view === 'groups' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
                border: '2px solid ' + (view === 'groups' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                if (view !== 'groups') e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>👥</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Назначить группам
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('results')}
              style={{
                background: view === 'results' ? 'rgba(59,130,246,0.08)' : 'var(--qf-card)',
                border: '2px solid ' + (view === 'results' ? '#3b82f6' : 'var(--qf-accent-border-soft, #e5e7eb)'),
                borderRadius: 'var(--qf-radius-md, 12px)',
                padding: '22px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                if (view !== 'results') e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <span style={{ fontSize: 28 }}>📊</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Результаты
              </span>
            </button>
          </div>
        </div>

        {view === 'groups' && (
          <div className="student-card" style={{ padding: '28px 32px' }}>
            <h3 style={{ marginTop: 0, fontSize: 22, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
              Назначение теста группам
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 16 }}>
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                style={{
                  padding: '12px 14px',
                  border: '2px solid var(--qf-accent-border-soft)',
                  borderRadius: 'var(--qf-radius-md, 12px)',
                  fontSize: 15,
                  fontFamily: 'var(--qf-font)',
                  background: 'var(--qf-card)',
                  color: 'var(--qf-text-body)',
                }}
              >
                <option value="">Выберите тест</option>
                {tests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="qf-btn-primary"
                onClick={handleSaveAssignments}
                disabled={!selectedTestId || assigning}
              >
                {assigning ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>

            {!selectedTest && (
              <p style={{ fontSize: 15, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', marginBottom: 0 }}>
                Выберите тест, чтобы назначить его учебным группам.
              </p>
            )}

            {selectedTest && (
              <div>
                <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)' }}>
                  Тест: <strong>{selectedTest.title}</strong>
                </p>
                {groupsLoading ? (
                  <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Загрузка групп…</p>
                ) : groups.length === 0 ? (
                  <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Нет доступных групп.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {groups.map((group) => {
                      const id = String(group.id);
                      const checked = selectedGroupIds.includes(id);
                      const subtitle = group.courses
                        ? `${group.courses.course_number} курс${group.courses.buildings?.name ? `, ${group.courses.buildings.name}` : ''}`
                        : 'Без курса';
                      return (
                        <label
                          key={group.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: '2px solid var(--qf-accent-border-soft)',
                            borderRadius: 12,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: checked ? 'rgba(51, 143, 249, 0.1)' : 'var(--qf-card)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroupSelection(group.id)}
                          />
                          <span style={{ fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                            Группа {group.group_number}
                            <span style={{ marginLeft: 8, color: 'var(--qf-text-muted)', fontSize: 13 }}>{subtitle}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'results' && (
          <div className="student-card" style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 22, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                Результаты по тестам
              </h3>
              <button type="button" className="qf-btn-primary" onClick={loadResults} disabled={resultsLoading}>
                {resultsLoading ? 'Обновление…' : 'Обновить'}
              </button>
            </div>
            {resultsLoading ? (
              <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Загрузка результатов…</p>
            ) : resultRows.length === 0 ? (
              <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Пока нет данных о прохождениях.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {resultRows.map((row) => (
                  <div
                    key={row.testId}
                    style={{
                      border: '2px solid var(--qf-accent-border-soft)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      background: 'var(--qf-card)',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                      {row.testTitle}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
                      Групп назначено: {row.assignedGroups}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
                      Студентов назначено: {row.assignedStudentsTotal} • Прошли тест: {row.passedStudentsTotal}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
                      Средний балл: {row.avgScore == null ? '—' : `${Math.round(row.avgScore * 10) / 10}%`}
                    </div>
                    <div style={{ overflowX: 'auto', marginTop: 6 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--qf-accent-border-soft)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>Студент</th>
                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>Группа</th>
                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>Статус</th>
                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>Результат</th>
                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>Время</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.studentRows.map((student) => (
                            <tr key={student.studentId} style={{ borderBottom: '1px solid rgba(229,231,235,0.6)' }}>
                              <td style={{ padding: '6px 4px' }}>{student.studentName}</td>
                              <td style={{ padding: '6px 4px', color: 'var(--qf-text-muted)' }}>{student.groupTitle}</td>
                              <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                                {student.passed ? 'Пройден' : 'Не пройден'}
                              </td>
                              <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                                {student.percentage == null ? '—' : `${Math.round(student.percentage * 10) / 10}%`}
                              </td>
                              <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                                {formatDuration(student.durationSeconds)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(view === 'actions' || view === 'tests') &&
          (loading ? (
            <p style={{ color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Загрузка…</p>
          ) : tests.length === 0 ? (
            <div className="student-card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 18, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>
                У вас пока нет тестов. Создайте первый тест!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {tests.map((t) => (
                <div key={t.id} className="student-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)', margin: 0 }}>
                      {t.title}
                    </h3>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: 999,
                        flexShrink: 0,
                        background: t.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                        color: t.is_active ? '#059669' : 'var(--qf-text-muted)',
                      }}
                    >
                      {t.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', margin: 0 }}>
                    {t.description || 'Описание отсутствует'}
                  </p>
                  <div style={{ fontSize: 13, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)', display: 'flex', gap: 16 }}>
                    <span>Вопросов: {t.questions_count || 0}</span>
                    <span>Попыток: {t.attempts_allowed || 1}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <button
                      type="button"
                      className="qf-btn-primary"
                      style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                      onClick={() => handleToggleActive(t.id, t.is_active)}
                    >
                      {t.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        fontSize: 13,
                        padding: '8px 12px',
                        border: '2px solid #ef4444',
                        borderRadius: 'var(--qf-radius-md, 12px)',
                        background: 'transparent',
                        color: '#ef4444',
                        fontWeight: 700,
                        fontFamily: 'var(--qf-font)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleDelete(t.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="student-card"
              style={{ maxWidth: 860, width: '95%', padding: '28px 32px', maxHeight: '85vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)', marginBottom: 20 }}>
                Создать новый тест
              </h2>
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 4,
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--qf-text-body)',
                        fontFamily: 'var(--qf-font)',
                      }}
                    >
                      Название теста
                    </label>
                    <input
                      name="title"
                      required
                      value={testDraft.title}
                      onChange={(e) => updateDraftField('title', e.target.value)}
                      placeholder="Введите название"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        border: '2px solid var(--qf-accent-border-soft)',
                        borderRadius: 'var(--qf-radius-md, 12px)',
                        fontSize: 15,
                        fontFamily: 'var(--qf-font)',
                        background: 'var(--qf-card)',
                        color: 'var(--qf-text-body)',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 4,
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--qf-text-body)',
                        fontFamily: 'var(--qf-font)',
                      }}
                    >
                      Лимит времени (мин)
                    </label>
                    <input
                      name="timeLimitMinutes"
                      type="number"
                      min={1}
                      value={testDraft.timeLimitMinutes}
                      onChange={(e) => updateDraftField('timeLimitMinutes', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        border: '2px solid var(--qf-accent-border-soft)',
                        borderRadius: 'var(--qf-radius-md, 12px)',
                        fontSize: 15,
                        fontFamily: 'var(--qf-font)',
                        background: 'var(--qf-card)',
                        color: 'var(--qf-text-body)',
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--qf-text-body)',
                      fontFamily: 'var(--qf-font)',
                    }}
                  >
                    Описание
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={testDraft.description}
                    onChange={(e) => updateDraftField('description', e.target.value)}
                    placeholder="Описание теста"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--qf-accent-border-soft)',
                      borderRadius: 'var(--qf-radius-md, 12px)',
                      fontSize: 15,
                      fontFamily: 'var(--qf-font)',
                      background: 'var(--qf-card)',
                      color: 'var(--qf-text-body)',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--qf-text-body)',
                      fontFamily: 'var(--qf-font)',
                    }}
                  >
                    Макс. попыток
                  </label>
                  <input
                    name="attemptsAllowed"
                    type="number"
                    min={1}
                    value={testDraft.attemptsAllowed}
                    onChange={(e) => updateDraftField('attemptsAllowed', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--qf-accent-border-soft)',
                      borderRadius: 'var(--qf-radius-md, 12px)',
                      fontSize: 15,
                      fontFamily: 'var(--qf-font)',
                      background: 'var(--qf-card)',
                      color: 'var(--qf-text-body)',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                      gap: 12,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                      Вопросы ({testDraft.questions.length})
                    </h3>
                    <button type="button" className="qf-btn-primary" onClick={addQuestion}>
                      + Добавить вопрос
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 14 }}>
                    {testDraft.questions.map((question, questionIndex) => (
                      <div
                        key={question.id}
                        style={{
                          border: '2px solid var(--qf-accent-border-soft)',
                          borderRadius: 12,
                          padding: 14,
                          background: 'var(--qf-card)',
                          display: 'grid',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <strong style={{ fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                            Вопрос {questionIndex + 1}
                          </strong>
                          <button
                            type="button"
                            onClick={() => removeQuestion(question.id)}
                            disabled={testDraft.questions.length <= 1}
                            style={{
                              border: '1px solid #ef4444',
                              color: '#ef4444',
                              background: 'transparent',
                              borderRadius: 8,
                              padding: '4px 10px',
                              cursor: testDraft.questions.length <= 1 ? 'not-allowed' : 'pointer',
                              opacity: testDraft.questions.length <= 1 ? 0.5 : 1,
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) => updateQuestionField(question.id, 'text', e.target.value)}
                          placeholder="Текст вопроса"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '2px solid var(--qf-accent-border-soft)',
                            borderRadius: 10,
                            fontSize: 14,
                            fontFamily: 'var(--qf-font)',
                            background: 'var(--qf-card)',
                            color: 'var(--qf-text-body)',
                          }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                          <select
                            value={question.type}
                            onChange={(e) => changeQuestionType(question.id, e.target.value)}
                            style={{
                              padding: '10px 12px',
                              border: '2px solid var(--qf-accent-border-soft)',
                              borderRadius: 10,
                              fontSize: 14,
                              fontFamily: 'var(--qf-font)',
                              background: 'var(--qf-card)',
                              color: 'var(--qf-text-body)',
                            }}
                          >
                            <option value={QUESTION_TYPES.single}>Одиночный выбор</option>
                            <option value={QUESTION_TYPES.multiple}>Множественный выбор</option>
                            <option value={QUESTION_TYPES.matching}>Соответствия</option>
                          </select>
                          <input
                            type="number"
                            min={-3}
                            max={3}
                            step={0.1}
                            value={question.difficulty}
                            onChange={(e) => updateQuestionField(question.id, 'difficulty', e.target.value)}
                            placeholder="Сложность"
                            style={{
                              padding: '10px 12px',
                              border: '2px solid var(--qf-accent-border-soft)',
                              borderRadius: 10,
                              fontSize: 14,
                              fontFamily: 'var(--qf-font)',
                              background: 'var(--qf-card)',
                              color: 'var(--qf-text-body)',
                            }}
                          />
                          <input
                            type="number"
                            min={5}
                            value={question.estimatedTimeSeconds}
                            onChange={(e) => updateQuestionField(question.id, 'estimatedTimeSeconds', e.target.value)}
                            placeholder="Время (сек)"
                            style={{
                              padding: '10px 12px',
                              border: '2px solid var(--qf-accent-border-soft)',
                              borderRadius: 10,
                              fontSize: 14,
                              fontFamily: 'var(--qf-font)',
                              background: 'var(--qf-card)',
                              color: 'var(--qf-text-body)',
                            }}
                          />
                        </div>
                        {question.type !== QUESTION_TYPES.matching && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {question.options.map((option, optionIndex) => (
                              <div key={option.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
                                <input
                                  type={question.type === QUESTION_TYPES.single ? 'radio' : 'checkbox'}
                                  name={`correct_${question.id}`}
                                  checked={option.isCorrect}
                                  onChange={(e) => updateOptionField(question.id, option.id, 'isCorrect', e.target.checked)}
                                />
                                <input
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => updateOptionField(question.id, option.id, 'text', e.target.value)}
                                  placeholder={`Вариант ${optionIndex + 1}`}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    border: '2px solid var(--qf-accent-border-soft)',
                                    borderRadius: 10,
                                    fontSize: 14,
                                    fontFamily: 'var(--qf-font)',
                                    background: 'var(--qf-card)',
                                    color: 'var(--qf-text-body)',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(question.id, option.id)}
                                  disabled={question.options.length <= 2}
                                  style={{
                                    border: '1px solid #ef4444',
                                    color: '#ef4444',
                                    background: 'transparent',
                                    borderRadius: 8,
                                    padding: '4px 8px',
                                    cursor: question.options.length <= 2 ? 'not-allowed' : 'pointer',
                                    opacity: question.options.length <= 2 ? 0.5 : 1,
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addOption(question.id)} className="qf-btn-primary" style={{ justifySelf: 'start' }}>
                              + Вариант ответа
                            </button>
                          </div>
                        )}
                        {question.type === QUESTION_TYPES.matching && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {question.pairs.map((pair, pairIndex) => (
                              <div key={pair.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={pair.left}
                                  onChange={(e) => updatePairField(question.id, pair.id, 'left', e.target.value)}
                                  placeholder={`Левая часть ${pairIndex + 1}`}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    border: '2px solid var(--qf-accent-border-soft)',
                                    borderRadius: 10,
                                    fontSize: 14,
                                    fontFamily: 'var(--qf-font)',
                                    background: 'var(--qf-card)',
                                    color: 'var(--qf-text-body)',
                                  }}
                                />
                                <input
                                  type="text"
                                  value={pair.right}
                                  onChange={(e) => updatePairField(question.id, pair.id, 'right', e.target.value)}
                                  placeholder={`Правая часть ${pairIndex + 1}`}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    border: '2px solid var(--qf-accent-border-soft)',
                                    borderRadius: 10,
                                    fontSize: 14,
                                    fontFamily: 'var(--qf-font)',
                                    background: 'var(--qf-card)',
                                    color: 'var(--qf-text-body)',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removePair(question.id, pair.id)}
                                  disabled={question.pairs.length <= 1}
                                  style={{
                                    border: '1px solid #ef4444',
                                    color: '#ef4444',
                                    background: 'transparent',
                                    borderRadius: 8,
                                    padding: '4px 8px',
                                    cursor: question.pairs.length <= 1 ? 'not-allowed' : 'pointer',
                                    opacity: question.pairs.length <= 1 ? 0.5 : 1,
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addPair(question.id)} className="qf-btn-primary" style={{ justifySelf: 'start' }}>
                              + Пара соответствия
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 'var(--qf-radius-md, 12px)',
                      border: '2px solid var(--qf-accent-border-soft)',
                      background: 'transparent',
                      fontWeight: 700,
                      fontFamily: 'var(--qf-font)',
                      cursor: 'pointer',
                      color: 'var(--qf-text-body)',
                      fontSize: 15,
                    }}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="qf-btn-primary" disabled={creating} style={{ padding: '10px 22px', fontSize: 15 }}>
                    {creating ? 'Создание…' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
