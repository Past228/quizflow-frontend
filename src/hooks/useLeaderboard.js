import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Fetches the global leaderboard (all students ranked by total score from
 * completed test_results) and a group-scoped sub-ranking.
 *
 * @param {string|null} currentGroupId  – group_id of the currently logged-in student
 */
export function useLeaderboard(currentGroupId) {
  const [all, setAll] = useState([]);
  const [groupRanking, setGroupRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          if (!cancelled) {
            setAll([]);
            setGroupRanking([]);
          }
          return;
        }

        // Step 1 — aggregate scores from completed test sessions
        const { data: results, error: resultsErr } = await supabase
          .from('test_results')
          .select('student_id, score')
          .eq('status', 'completed');

        if (resultsErr) throw resultsErr;

        const scoreMap = {};
        const testsMap = {};
        (results || []).forEach((r) => {
          scoreMap[r.student_id] = (scoreMap[r.student_id] || 0) + (r.score || 0);
          testsMap[r.student_id] = (testsMap[r.student_id] || 0) + 1;
        });

        // Step 2 — all student profiles; incognito filtered in JS (PostgREST .eq + .or is easy to misread)
        const { data: profilesRaw, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, group_id, active_frame_id, active_color_id, active_prefix_id, incognito_mode')
          .eq('role', 'student');

        if (profilesErr) throw profilesErr;

        const profiles = (profilesRaw || []).filter((p) => p.incognito_mode !== true);

        // Step 3 — batch-load all referenced cosmetic items in parallel
        const unique = (arr) => [...new Set(arr.filter(Boolean))];
        const frameIds  = unique((profiles || []).map((p) => p.active_frame_id));
        const colorIds  = unique((profiles || []).map((p) => p.active_color_id));
        const prefixIds = unique((profiles || []).map((p) => p.active_prefix_id));

        const [framesRes, colorsRes, prefixesRes] = await Promise.all([
          frameIds.length  ? supabase.from('items_frames').select('id, image_url').in('id', frameIds)            : { data: [] },
          colorIds.length  ? supabase.from('items_name_colors').select('id, hex_code').in('id', colorIds)        : { data: [] },
          prefixIds.length ? supabase.from('items_prefixes').select('id, title').in('id', prefixIds)             : { data: [] },
        ]);

        const frameMap  = Object.fromEntries((framesRes.data  || []).map((f) => [f.id, f]));
        const colorMap  = Object.fromEntries((colorsRes.data  || []).map((c) => [c.id, c]));
        const prefixMap = Object.fromEntries((prefixesRes.data|| []).map((p) => [p.id, p]));

        // Step 4 — combine, sort, assign ranks
        const ranked = (profiles || [])
          .map((p) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(' '),
            avatarUrl: p.avatar_url || null,
            groupId: p.group_id,
            totalScore: scoreMap[p.id] || 0,
            testsCompleted: testsMap[p.id] || 0,
            activeFrame:  p.active_frame_id  ? (frameMap[p.active_frame_id]   ?? null) : null,
            activeColor:  p.active_color_id  ? (colorMap[p.active_color_id]   ?? null) : null,
            activePrefix: p.active_prefix_id ? (prefixMap[p.active_prefix_id] ?? null) : null,
          }))
          // Primary sort: total score. Tie-break: tests completed.
          .sort((a, b) => b.totalScore - a.totalScore || b.testsCompleted - a.testsCompleted);

        ranked.forEach((r, i) => {
          r.rank = i + 1;
        });

        if (!cancelled) {
          setAll(ranked);
          setGroupRanking(
            currentGroupId
              ? ranked.filter(
                  (r) => String(r.groupId ?? '') === String(currentGroupId ?? '')
                )
              : []
          );
        }
      } catch (err) {
        console.error('useLeaderboard error:', err);
        if (!cancelled) {
          setAll([]);
          setGroupRanking([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) load();
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [currentGroupId]);

  return { all, groupRanking, loading };
}
