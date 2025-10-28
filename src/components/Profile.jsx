import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testsLoading, setTestsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profileNotFound, setProfileNotFound] = useState(false);

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
      setError(null);
      setProfileNotFound(false);
      
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
        console.error('Supabase error:', error);
        
        if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
          setProfileNotFound(true);
          setError('Профиль не найден в базе данных');
          return;
        }
        
        setError('Ошибка загрузки профиля: ' + error.message);
        return;
      }

      console.log('Полный профиль:', data);
      console.log('Group ID:', data.group_id);
      console.log('Student groups data:', data.student_groups);
      
      setProfile(data);
      
    } catch (error) {
      console.error('Unexpected error:', error);
      setError('Неожиданная ошибка: ' + error.message);
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
            created_at,
            time_limit,
            questions_count
          )
        `)
        .eq('group_id', profile.group_id);

      if (error) {
        throw error;
      }

      const tests = data
        .filter(item => item.test)
        .map(item => item.test);
      
      setAvailableTests(tests || []);
    } catch (error) {
      console.error('Ошибка загрузки тестов:', error);
      setAvailableTests([]);
    } finally {
      setTestsLoading(false);
    }
  }

  const handleRecreateProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: session.user.id,
          email: session.user.email,
          first_name: 'Новый',
          last_name: 'Пользователь',
          role: 'student',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      await getProfile();
      
    } catch (error) {
      console.error('Ошибка создания профиля:', error);
      setError('Не удалось создать профиль: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Случай когда профиль не найден в базе
  if (profileNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Профиль не найден</h2>
            <p className="text-gray-600 mb-6">
              Ваш аккаунт есть в системе, но профиль не был создан или был удален.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleRecreateProfile}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Создание...
                  </div>
                ) : (
                  'Создать новый профиль'
                )}
              </button>
              
              <button
                onClick={handleSignOut}
                className="w-full bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Выйти и зарегистрироваться заново
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <div className="text-xl font-semibold text-gray-700">Загрузка профиля...</div>
      </div>
    </div>
  );

  if (error && !profileNotFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white border border-red-200 rounded-lg shadow-lg">
        <div className="text-red-600 text-center">
          <h2 className="text-xl font-bold mb-4">Ошибка загрузки профиля</h2>
          <p className="mb-4">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={getProfile}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition duration-200"
            >
              Повторить попытку
            </button>
            <button 
              onClick={handleSignOut}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition duration-200"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-red-600 text-center">
        <h2 className="text-xl font-bold mb-4">Профиль не найден</h2>
        <p>Попробуйте перезагрузить страницу</p>
      </div>
    </div>
  );

  // Проверяем наличие данных о группе
  const hasGroupInfo = profile.student_groups && 
                      profile.student_groups.courses && 
                      profile.student_groups.courses.buildings;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Хедер */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">QuizFlow</h1>
            <p className="text-gray-600">Личный кабинет</p>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition duration-200 font-medium flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Выйти
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Левая колонка - Информация о пользователе */}
          <div className="lg:col-span-1 space-y-6">
            {/* Карточка пользователя */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {profile.first_name?.[0]}{profile.last_name?.[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {profile.first_name} {profile.last_name}
                  </h2>
                  <p className="text-gray-600 text-sm">{session.user.email}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Фамилия:</span>
                  <span className="font-medium text-gray-800">{profile.last_name || 'Не указано'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Имя:</span>
                  <span className="font-medium text-gray-800">{profile.first_name || 'Не указано'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Почта:</span>
                  <span className="font-medium text-gray-800">{session.user.email}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Роль:</span>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium capitalize">
                    {profile.role === 'student' ? 'Студент' : 'Преподаватель'}
                  </span>
                </div>
              </div>
            </div>

            {/* Учебная информация */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Учебная информация</h3>
              {hasGroupInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700">Корпус:</span>
                    <span className="font-semibold text-blue-700">{profile.student_groups.courses.buildings.name}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-gray-700">Курс:</span>
                    <span className="font-semibold text-green-700">{profile.student_groups.courses.course_number} курс</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-gray-700">Группа:</span>
                    <span className="font-semibold text-purple-700">{profile.student_groups.group_number}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-yellow-500 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-yellow-600 font-medium">
                    {profile.group_id ? 'Данные группы загружаются...' : 'Учебная группа не назначена'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Правая колонка - Доступные тесты */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Доступные тесты</h3>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                  {availableTests.length} тестов
                </span>
              </div>
              
              {testsLoading ? (
                <div className="text-center py-12">
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-lg text-gray-600">Загрузка тестов...</span>
                  </div>
                </div>
              ) : availableTests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTests.map((test) => (
                    <div key={test.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-200">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg font-bold text-gray-800">{test.title}</h4>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                          Доступен
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4 text-sm leading-relaxed">{test.description}</p>
                      <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                        <span>Вопросов: {test.questions_count || 'Не указано'}</span>
                        {test.time_limit && (
                          <span>Лимит: {test.time_limit} мин</span>
                        )}
                      </div>
                      <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition duration-200 font-medium flex items-center justify-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Начать тест
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-semibold text-gray-500 mb-2">Нет доступных тестов</h4>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Ожидайте назначения тестов от преподавателя. Как только тесты будут назначены вашей группе, они появятся здесь.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}