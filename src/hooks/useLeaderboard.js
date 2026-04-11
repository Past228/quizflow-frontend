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

    (async () => {
      setLoading(true);
      try {
        // Step 1 — aggregate scores from completed test sessions
        const { data: results, error: resultsErr } = await supabase
          .from('test_results')
          .select('student_id, score')
          .eq('status', 'completed');

        if (resultsErr) throw resultsErr;

        const scoreMap = {};
        (results || []).forEach((r) => {
          scoreMap[r.student_id] = (scoreMap[r.student_id] || 0) + (r.score || 0);
        });

        // Step 2 — get all student profiles
        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, group_id, sp_coins')
          .eq('role', 'student');

        if (profilesErr) throw profilesErr;

        // Step 3 — combine, sort, assign ranks
        const ranked = (profiles || [])
          .map((p) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(' '),
            avatarUrl: p.avatar_url || null,
            groupId: p.group_id,
            spCoins: p.sp_coins || 0,
            totalScore: scoreMap[p.id] || 0,
          }))
          // Primary sort: total test score. Tie-break: sp_coins.
          .sort((a, b) => b.totalScore - a.totalScore || b.spCoins - a.spCoins);

        ranked.forEach((r, i) => {
          r.rank = i + 1;
        });

        if (!cancelled) {
          setAll(ranked);
          setGroupRanking(
            currentGroupId
              ? ranked.filter((r) => r.groupId === currentGroupId)
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
    })();

    return () => {
      cancelled = true;
    };
  }, [currentGroupId]);

  return { all, groupRanking, loading };
}
