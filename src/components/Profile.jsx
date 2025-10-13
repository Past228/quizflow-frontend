import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testsLoading, setTestsLoading] = useState(false);

  useEffect(() => {
    getProfile();
  }, [session]);

  useEffect(() => {
    if (profile && profile.group_id) {
      getAvailableTests();
    }
  }, [profile]);

  async function getProfile() {
    try {
      setLoading(true);
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
        throw error;
      }
      setProfile(data);
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
    } finally {
      setLoading(false);
    }
  }

  async function getAvailableTests() {
    try {
      setTestsLoading(true);
      const { data, error } = await supabase
        .from('group_tests')
        .select(`
          test:tests (
            id,
            title,
            description,
            created_at
          )
        `)
        .eq('group_id', profile.group_id);

      if (error) {
        throw error;
      }

      // Преобразуем данные
      const tests = data
        .filter(item => item.test) // Фильтруем null значения
        .map(item => item.test);
      
      setAvailableTests(tests || []);
    } catch (error) {
      console.error('Ошибка загрузки тестов:', error);
      setAvailableTests([]);
    } finally {
      setTestsLoading(false);
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
      
      {/* Информация о пользователе */}
      <div className="space-y-4 mb-6">
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

      {/* Доступные тесты */}
      <div className="border-t pt-6">
        <h3 className="text-xl font-bold mb-4">Доступные тесты</h3>
        
        {testsLoading ? (
          <div className="text-center py-4">
            <div className="text-lg">Загрузка тестов...</div>
          </div>
        ) : availableTests.length > 0 ? (
          <div className="space-y-3">
            {availableTests.map((test) => (
              <div key={test.id} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition duration-200">
                <h4 className="font-semibold text-lg mb-2">{test.title}</h4>
                <p className="text-gray-600 mb-3">{test.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {new Date(test.created_at).toLocaleDateString('ru-RU')}
                  </span>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition duration-200">
                    Начать тест
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border rounded-lg bg-gray-50">
            <div className="text-lg text-gray-500 mb-2">Нет доступных тестов</div>
            <p className="text-gray-400 text-sm">
              Ожидайте назначения тестов от преподавателя
            </p>
          </div>
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