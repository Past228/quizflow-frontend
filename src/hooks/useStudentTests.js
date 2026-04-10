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
      const { data, error } = await supabase
        .from('group_tests')
        .select(
          `
          test:tests (
            id,
            title,
            description,
            time_limit,
            questions_count
          )
        `
        )
        .eq('group_id', groupId);

      if (cancelled) return;
      if (error) {
        console.error(error);
        setTests([]);
      } else {
        const list = (data || []).filter((x) => x.test).map((x) => x.test);
        setTests(list);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return { tests, loading };
}
