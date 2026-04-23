import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useStudentProfile } from '../context/StudentProfileContext';

const QUESTION_TYPES = {
  single: 'single',
  multiple: 'multiple',
  matching: 'matching',
};

function detectQuestionType(options) {
  if (!options?.length) return QUESTION_TYPES.single;
  const hasMatchingPayload = options.some((o) => (o.explanation || '').trim());
  if (hasMatchingPayload) return QUESTION_TYPES.matching;
  const correctCount = options.filter((o) => o.is_correct).length;
  return correctCount > 1 ? QUESTION_TYPES.multiple : QUESTION_TYPES.single;
}

function normalizeQuestion(question, options) {
  const sortedOptions = [...(options || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return {
    ...question,
    options: sortedOptions,
    type: detectQuestionType(sortedOptions),
  };
}

function calculateCoins(percentage) {
  const pct = Number(percentage) || 0;
  return Math.max(5, Math.round(pct / 10) * 2);
}

export default function TestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useStudentProfile();
  const [testMeta, setTestMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!testId || !profile?.id || !profile?.group_id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data: testData, error: testError } = await supabase
          .from('tests')
          .select('id, title, description, time_limit_minutes, attempts_allowed, questions_count, is_active')
          .eq('id', testId)
          .single();
        if (testError) throw testError;
        if (!testData?.is_active) {
          throw new Error('Тест недоступен.');
        }

        const { data: assignment, error: assignmentError } = await supabase
          .from('group_tests')
          .select('id')
          .eq('test_id', testId)
          .eq('group_id', profile.group_id)
          .maybeSingle();
        if (assignmentError) throw assignmentError;
        if (!assignment) {
          throw new Error('Этот тест не назначен вашей группе.');
        }

        const { data: completed, error: completedError } = await supabase
          .from('test_results')
          .select('id')
          .eq('test_id', testId)
          .eq('student_id', profile.id)
          .eq('status', 'completed');
        if (completedError) throw completedError;
        const attemptsUsed = completed?.length || 0;
        if (attemptsUsed >= (testData.attempts_allowed || 1)) {
          throw new Error('Вы исчерпали лимит попыток для этого теста.');
        }

        const { data: activeQuestions, error: questionError } = await supabase
          .from('test_questions')
          .select('id, question_text, difficulty, estimated_time_seconds, is_active')
          .eq('test_id', testId)
          .eq('is_active', true);
        if (questionError) throw questionError;
        let questionRows = activeQuestions || [];
        // Fallback for legacy rows where is_active wasn't set explicitly.
        if (!questionRows.length) {
          const { data: anyQuestions, error: anyQuestionError } = await supabase
            .from('test_questions')
            .select('id, question_text, difficulty, estimated_time_seconds, is_active')
            .eq('test_id', testId);
          if (anyQuestionError) throw anyQuestionError;
          questionRows = anyQuestions || [];
        }
        if (!questionRows.length) throw new Error('В этом тесте пока нет вопросов.');

        const questionIds = questionRows.map((q) => q.id);
        const { data: optionRows, error: optionsError } = await supabase
          .from('test_question_options')
          .select('id, question_id, option_text, is_correct, explanation, position')
          .in('question_id', questionIds);
        if (optionsError) throw optionsError;

        const optionsByQuestion = {};
        (optionRows || []).forEach((row) => {
          if (!optionsByQuestion[row.question_id]) optionsByQuestion[row.question_id] = [];
          optionsByQuestion[row.question_id].push(row);
        });

        const normalized = questionRows
          .map((q) => normalizeQuestion(q, optionsByQuestion[q.id] || []))
          .filter((q) => q.options.length > 0)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        if (!normalized.length) {
          throw new Error('Вопросы теста не содержат вариантов ответа.');
        }

        if (!cancelled) {
          setTestMeta(testData);
          setQuestions(normalized);
          setAnswers({});
          setIndex(0);
          setResult(null);
          setTimeLeft((testData.time_limit_minutes || 20) * 60);
          startedAtRef.current = Date.now();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Ошибка загрузки теста.');
          setQuestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId, profile?.id, profile?.group_id]);

  useEffect(() => {
    if (loading || result) return undefined;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [loading, result]);

  useEffect(() => {
    if (timeLeft === 0 && !loading && !result && questions.length > 0) {
      void handleSubmit();
    }
  }, [timeLeft, loading, result, questions.length]);

  const title = testMeta?.title ? `ТЕСТ: ${testMeta.title}` : 'ТЕСТ';
  const currentQuestion = questions[index];
  const progressPct = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;

  const clock = useMemo(() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [timeLeft]);

  const setSingleAnswer = (questionId, optionId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const toggleMultipleAnswer = (questionId, optionId) => {
    setAnswers((prev) => {
      const current = new Set(prev[questionId] || []);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      return { ...prev, [questionId]: [...current] };
    });
  };

  const setMatchingAnswer = (questionId, optionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), [optionId]: value },
    }));
  };

  const evaluateQuestion = (question) => {
    const answer = answers[question.id];
    if (question.type === QUESTION_TYPES.single) {
      const selectedOption = question.options.find((o) => o.id === answer);
      const isCorrect = !!selectedOption?.is_correct;
      return {
        points: isCorrect ? 1 : 0,
        maxPoints: 1,
        responses: [
          {
            question_id: question.id,
            selected_option_id: selectedOption?.id || null,
            is_correct: isCorrect,
          },
        ],
      };
    }

    if (question.type === QUESTION_TYPES.multiple) {
      const selected = new Set(Array.isArray(answer) ? answer : []);
      const correctIds = new Set(question.options.filter((o) => o.is_correct).map((o) => o.id));
      const exactMatch =
        selected.size === correctIds.size &&
        [...selected].every((id) => correctIds.has(id));

      const responses = question.options
        .filter((o) => selected.has(o.id))
        .map((o) => ({
          question_id: question.id,
          selected_option_id: o.id,
          is_correct: !!o.is_correct,
        }));

      return {
        points: exactMatch ? 1 : 0,
        maxPoints: 1,
        responses: responses.length ? responses : [{ question_id: question.id, selected_option_id: null, is_correct: false }],
      };
    }

    const matchInput = answer || {};
    let correctPairs = 0;
    const responses = question.options.map((o) => {
      const expected = (o.explanation || '').trim().toLowerCase();
      const got = String(matchInput[o.id] || '').trim().toLowerCase();
      const ok = expected.length > 0 && got === expected;
      if (ok) correctPairs += 1;
      return {
        question_id: question.id,
        selected_option_id: o.id,
        is_correct: ok,
      };
    });
    const maxPoints = question.options.length || 1;
    return {
      points: correctPairs / maxPoints,
      maxPoints: 1,
      responses,
    };
  };

  const handleSubmit = async () => {
    if (!profile?.id || !testMeta || !questions.length || submitting || result) return;
    setSubmitting(true);
    try {
      const evaluations = questions.map((q) => evaluateQuestion(q));
      const points = evaluations.reduce((s, v) => s + v.points, 0);
      const maxPoints = evaluations.reduce((s, v) => s + v.maxPoints, 0) || 1;
      const percentage = (points / maxPoints) * 100;
      const roundedPercentage = Math.round(percentage * 10) / 10;
      const score = Math.round(roundedPercentage);
      const earnedCoins = calculateCoins(roundedPercentage);

      const startedAtIso = new Date(startedAtRef.current).toISOString();
      const completedAtIso = new Date().toISOString();

      const { data: resultRow, error: resultError } = await supabase
        .from('test_results')
        .insert({
          test_id: testMeta.id,
          student_id: profile.id,
          score,
          max_score: 100,
          percentage: roundedPercentage,
          started_at: startedAtIso,
          completed_at: completedAtIso,
          status: 'completed',
        })
        .select('id')
        .single();
      if (resultError) throw resultError;

      const responseRows = evaluations
        .flatMap((e) => e.responses)
        .map((r) => ({
          test_result_id: resultRow.id,
          question_id: r.question_id,
          selected_option_id: r.selected_option_id,
          is_correct: r.is_correct,
          points_earned: r.is_correct ? 1 : 0,
          question_difficulty:
            questions.find((q) => q.id === r.question_id)?.difficulty ?? 0,
        }));
      if (responseRows.length > 0) {
        const { error: responseError } = await supabase.from('user_question_responses').insert(responseRows);
        if (responseError) throw responseError;
      }

      const currentCoins = profile.sp_coins || 0;
      const { error: coinsError } = await supabase
        .from('profiles')
        .update({ sp_coins: currentCoins + earnedCoins })
        .eq('id', profile.id);
      if (coinsError) throw coinsError;

      await refreshProfile();
      setResult({ score, percentage: roundedPercentage, earnedCoins });
    } catch (err) {
      setError(err.message || 'Не удалось сохранить результат теста.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="student-page-wrap">
        <div className="student-page student-page--wide">
          <div className="student-card" style={{ padding: 24 }}>
            <p style={{ margin: 0, color: 'var(--qf-text-muted)', fontFamily: 'var(--qf-font)' }}>Загрузка теста…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="student-page-wrap">
        <div className="student-page student-page--wide">
          <div className="student-card" style={{ padding: 24 }}>
            <p style={{ margin: 0, color: '#b91c1c', fontFamily: 'var(--qf-font)', fontWeight: 600 }}>{error}</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button type="button" className="qf-btn-primary" onClick={() => navigate('/catalog')}>К каталогу</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide" style={{ maxWidth: 'min(100%, 1200px)' }}>
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <h1 className="student-page-title" style={{ margin: 0, letterSpacing: '0.06em' }}>
            {title}
          </h1>
          <div style={{ color: 'var(--qf-dark-blue)', fontWeight: 700, fontFamily: 'var(--qf-font)' }}>
            Вопросов: {questions.length}
          </div>
        </header>

        <div className="qf-progress" style={{ marginBottom: 22, height: 14 }}>
          <div className="qf-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>

        <section className="student-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="test-timer-strip"
            style={{
              height: 44,
              background: 'rgba(51, 143, 249, 0.12)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.max(20, (timeLeft / ((testMeta?.time_limit_minutes || 20) * 60)) * 100)}%`,
                background: '#338ff9',
                borderRadius: '0 999px 999px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 22,
                letterSpacing: '0.06em',
              }}
            >
              <span className="qf-num">{clock}</span>
            </div>
          </div>

          <div style={{ padding: '28px 28px 32px' }}>
            {result ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>Тест завершен</h2>
                <p style={{ margin: 0, color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)', fontSize: 18 }}>
                  Результат: <strong>{result.percentage}%</strong>
                </p>
                <p style={{ margin: 0, color: 'var(--qf-text-body)', fontFamily: 'var(--qf-font)', fontSize: 18 }}>
                  Начислено монет: <strong>+{result.earnedCoins}</strong>
                </p>
              </div>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 500, color: 'var(--qf-dark-blue)' }}>
                  Вопрос <span className="qf-num">{index + 1}</span> из <span className="qf-num">{questions.length}</span>:
                </p>
                <p
                  style={{
                    margin: '0 0 18px',
                    fontSize: 20,
                    lineHeight: 1.5,
                    color: 'var(--qf-text-body)',
                    fontWeight: 500,
                  }}
                >
                  {currentQuestion?.question_text}
                </p>

                {currentQuestion?.type !== QUESTION_TYPES.matching && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 14,
                    }}
                  >
                    {currentQuestion.options.map((option) => {
                      const selectedSingle = answers[currentQuestion.id] === option.id;
                      const selectedMulti = (answers[currentQuestion.id] || []).includes(option.id);
                      const isSel = currentQuestion.type === QUESTION_TYPES.single ? selectedSingle : selectedMulti;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            if (currentQuestion.type === QUESTION_TYPES.single) {
                              setSingleAnswer(currentQuestion.id, option.id);
                            } else {
                              toggleMultipleAnswer(currentQuestion.id, option.id);
                            }
                          }}
                          style={{
                            padding: '18px 16px',
                            borderRadius: 14,
                            border: isSel ? '2px solid #338ff9' : '2px solid var(--qf-border-control)',
                            background: isSel ? '#338ff9' : 'var(--qf-card)',
                            color: isSel ? '#fff' : 'var(--qf-text-body)',
                            fontWeight: 500,
                            fontSize: 18,
                            fontFamily: 'var(--qf-font)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                          }}
                        >
                          {option.option_text}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion?.type === QUESTION_TYPES.matching && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {currentQuestion.options.map((option, i) => (
                      <div key={option.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontFamily: 'var(--qf-font)', color: 'var(--qf-text-body)' }}>
                          {i + 1}. {option.option_text}
                        </div>
                        <input
                          type="text"
                          value={(answers[currentQuestion.id] || {})[option.id] || ''}
                          onChange={(e) => setMatchingAnswer(currentQuestion.id, option.id, e.target.value)}
                          placeholder="Введите соответствие"
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
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <button type="button" className="qf-btn-primary" onClick={() => navigate('/catalog')}>
                К каталогу
              </button>
              {!result && (
                <>
                  <button
                    type="button"
                    className="qf-btn-primary"
                    onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                    disabled={index === 0}
                  >
                    Назад
                  </button>
                  {index < questions.length - 1 ? (
                    <button
                      type="button"
                      className="qf-btn-primary"
                      style={{ background: '#20aeb9' }}
                      onClick={() => setIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    >
                      Далее
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="qf-btn-primary"
                      style={{ background: '#20aeb9' }}
                      disabled={submitting}
                      onClick={handleSubmit}
                    >
                      {submitting ? 'Сохранение…' : 'Завершить тест'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
