import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile();
  }, [session]);

  async function getProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          student_groups (
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
        throw error;
      }
      setProfile(data);
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="max-w-md mx-auto mt-8 p-6 text-center">
      <div className="text-lg">Загрузка профиля...</div>
    </div>
  );

  if (!profile) return (
    <div className="max-w-md mx-auto mt-8 p-6 text-center text-red-600">
      Ошибка загрузки профиля
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Ваш профиль</h2>
      
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded">
          <strong>Фамилия:</strong> {profile.last_name || 'Не указано'}
        </div>
        
        <div className="p-3 bg-gray-50 rounded">
          <strong>Имя:</strong> {profile.first_name || 'Не указано'}
        </div>
        
        <div className="p-3 bg-gray-50 rounded">
          <strong>Email:</strong> {session.user.email}
        </div>
        
        <div className="p-3 bg-gray-50 rounded">
          <strong>Роль:</strong> {profile.role === 'student' ? 'Студент' : 'Преподаватель'}
        </div>

        {profile.student_groups && (
          <>
            <div className="p-3 bg-blue-50 rounded">
              <strong>Корпус:</strong> {profile.student_groups.courses.buildings.name}
            </div>
            
            <div className="p-3 bg-blue-50 rounded">
              <strong>Курс:</strong> {profile.student_groups.courses.course_number}
            </div>
            
            <div className="p-3 bg-blue-50 rounded">
              <strong>Группа:</strong> {profile.student_groups.group_number}
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white p-2 rounded transition duration-200"
      >
        Выйти из аккаунта
      </button>
    </div>
  );
}