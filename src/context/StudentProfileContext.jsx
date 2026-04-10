import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const StudentProfileContext = createContext(null);

export function StudentProfileProvider({ session, children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const role = session.user.user_metadata?.role;
      if (role === 'teacher') {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data, error: qErr } = await supabase
        .from('profiles')
        .select(
          `
          *,
          student_groups (
            id,
            group_number,
            courses (
              course_number,
              buildings ( name )
            )
          )
        `
        )
        .eq('id', session.user.id)
        .single();

      if (qErr) throw qErr;
      setProfile(data);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Ошибка загрузки профиля');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const value = {
    profile,
    loading,
    error,
    refreshProfile: load,
    groupId: profile?.group_id ?? null,
  };

  return (
    <StudentProfileContext.Provider value={value}>{children}</StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  const ctx = useContext(StudentProfileContext);
  if (!ctx) {
    throw new Error('useStudentProfile must be used within StudentProfileProvider');
  }
  return ctx;
}
