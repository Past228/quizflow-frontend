import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { profileIsStudentForRanking } from '../lib/profileRole';

/**
 * Students ranked by total score, limited to groups whose courses belong to the teacher's building.
 */
export function useTeacherBuildingLeaderboard(userId) {
  const [rows, setRows] = useState([]);
  const [buildingName, setBuildingName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!userId) {
        setRows([]);
        setBuildingName('');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: teacher, error: tErr } = await supabase
          .from('teachers')
          .select('building_id, buildings(name)')
          .eq('id', userId)
          .maybeSingle();

        if (tErr) throw tErr;
        if (cancelled) return;

        const buildingId = teacher?.building_id;
        setBuildingName(teacher?.buildings?.name || '');

        if (!buildingId) {
          setRows([]);
          setLoading(false);
          return;
        }

        /** Группы корпуса: join courses↔building надёжнее, чем два запроса (и совпадает с фильтрами PostgREST). */
        const { data: groupsJoined, error: gjErr } = await supabase
          .from('student_groups')
          .select('id, courses!inner ( building_id )')
          .eq('courses.building_id', buildingId);
        if (gjErr) throw gjErr;

        let groupIds = [...new Set((groupsJoined || []).map((g) => g.id).filter(Boolean))];

        /** Запасной путь: курсы по building_id → группы (если join не вернул строк из‑за особенностей схемы). */
        if (groupIds.length === 0) {
          const { data: courses, error: cErr } = await supabase
            .from('courses')
            .select('id')
            .eq('building_id', buildingId);
          if (cErr) throw cErr;
          const courseIds = (courses || []).map((c) => c.id);
          if (courseIds.length > 0) {
            const { data: groups, error: gErr } = await supabase
              .from('student_groups')
              .select('id')
              .in('course_id', courseIds);
            if (gErr) throw gErr;
            groupIds = [...new Set((groups || []).map((g) => g.id).filter(Boolean))];
          }
        }

        const { data: results, error: rErr } = await supabase
          .from('test_results')
          .select('student_id, score')
          .eq('status', 'completed');
        if (rErr) throw rErr;

        let profiles;
        if (groupIds.length > 0) {
          const { data: pRows, error: pErr } = await supabase
            .from('profiles')
            .select(
              'id, first_name, last_name, avatar_url, group_id, active_frame_id, active_color_id, active_prefix_id, incognito_mode, role'
            )
            .in('group_id', groupIds);
          if (pErr) throw pErr;
          profiles = (pRows || []).filter(profileIsStudentForRanking);
        } else {
          /** Нет groupIds (курсы не привязаны к корпусу в БД): всё равно показываем студентов корпуса через вложенный фильтр. */
          const { data: pNested, error: pnErr } = await supabase
            .from('profiles')
            .select(
              'id, first_name, last_name, avatar_url, group_id, active_frame_id, active_color_id, active_prefix_id, incognito_mode, role, student_groups!inner ( courses!inner ( building_id ) )'
            )
            .eq('student_groups.courses.building_id', buildingId);
          if (pnErr) throw pnErr;
          profiles = (pNested || []).filter(profileIsStudentForRanking);
        }

        const scoreMap = {};
        const testsMap = {};
        (results || []).forEach((r) => {
          scoreMap[r.student_id] = (scoreMap[r.student_id] || 0) + (r.score || 0);
          testsMap[r.student_id] = (testsMap[r.student_id] || 0) + 1;
        });

        const unique = (arr) => [...new Set(arr.filter(Boolean))];
        const frameIds = unique((profiles || []).map((p) => p.active_frame_id));
        const colorIds = unique((profiles || []).map((p) => p.active_color_id));
        const prefixIds = unique((profiles || []).map((p) => p.active_prefix_id));

        const [framesRes, colorsRes, prefixesRes] = await Promise.all([
          frameIds.length
            ? supabase.from('items_frames').select('id, image_url').in('id', frameIds)
            : { data: [] },
          colorIds.length
            ? supabase.from('items_name_colors').select('id, hex_code').in('id', colorIds)
            : { data: [] },
          prefixIds.length
            ? supabase.from('items_prefixes').select('id, title').in('id', prefixIds)
            : { data: [] },
        ]);

        const frameMap = Object.fromEntries((framesRes.data || []).map((f) => [f.id, f]));
        const colorMap = Object.fromEntries((colorsRes.data || []).map((c) => [c.id, c]));
        const prefixMap = Object.fromEntries((prefixesRes.data || []).map((p) => [p.id, p]));

        const ranked = (profiles || [])
          .map((p) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(' '),
            avatarUrl: p.avatar_url || null,
            groupId: p.group_id,
            totalScore: scoreMap[p.id] || 0,
            testsCompleted: testsMap[p.id] || 0,
            activeFrame: p.active_frame_id ? frameMap[p.active_frame_id] ?? null : null,
            activeColor: p.active_color_id ? colorMap[p.active_color_id] ?? null : null,
            activePrefix: p.active_prefix_id ? prefixMap[p.active_prefix_id] ?? null : null,
          }))
          .sort((a, b) => b.totalScore - a.totalScore || b.testsCompleted - a.testsCompleted);

        ranked.forEach((r, i) => {
          r.rank = i + 1;
        });

        if (!cancelled) setRows(ranked);
      } catch (err) {
        console.error('useTeacherBuildingLeaderboard error:', err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { rows, buildingName, loading };
}
