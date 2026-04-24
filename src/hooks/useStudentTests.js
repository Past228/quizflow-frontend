import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useStudentTests(groupId) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setTests([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Step 1 — get test IDs assigned to this group
        const { data: groupRows, error: groupError } = await supabase
          .from('group_tests')
          .select('test_id')
          .eq('group_id', groupId);

        if (groupError) throw groupError;

        const testIds = (groupRows || []).map((r) => r.test_id).filter(Boolean);

        let list = [];
        if (testIds.length > 0) {
          // Step 2 — fetch only active tests whose IDs match
          const { data: testsData, error: testsError } = await supabase
            .from('tests')
            .select('id, title, description, time_limit_minutes, questions_count, attempts_allowed, created_at')
            .in('id', testIds)
            .eq('is_active', true);

          if (testsError) throw testsError;
          list = testsData || [];
        }

        if (!cancelled) setTests(list);
      } catch (err) {
        console.error('useStudentTests error:', err);
        if (!cancelled) setTests([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return { tests, loading };
}
