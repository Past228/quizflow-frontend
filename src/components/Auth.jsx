import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import GroupSelector from './GroupSelector';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        // ВАЖНО: Проверяем, что группа выбрана
        if (!selectedGroupId) {
          setMessage('Ошибка: Выберите учебную группу');
          setLoading(false);
          return;
        }

        console.log('Начало регистрации:', { email, firstName, lastName, selectedGroupId });

        // 1. Регистрация в Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              role: 'student'
            }
          }
        });

        if (error) {
          console.error('Ошибка регистрации:', error);
          setMessage('Ошибка регистрации: ' + error.message);
          return;
        }

        if (data.user) {
          console.log('Пользователь создан, ID:', data.user.id);
          
          // 2. Ждем создания профиля через триггер (2 секунды)
          console.log('Ожидание создания профиля...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 3. Обновляем профиль с выбранной группой
          console.log('Обновление профиля с group_id:', selectedGroupId);
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              group_id: selectedGroupId
            })
            .eq('id', data.user.id);

          if (profileError) {
            console.error('Ошибка обновления профиля:', profileError);
            
            // 4. Если обновление не удалось, пробуем вставить новый профиль
            console.log('Попытка создания профиля вручную...');
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                first_name: firstName,
                last_name: lastName,
                role: 'student',
                group_id: selectedGroupId
              });

            if (insertError) {
              console.error('Ошибка создания профиля:', insertError);
              setMessage('Ошибка при сохранении данных: ' + insertError.message);
            } else {
              console.log('Профиль создан вручную успешно');
              setMessage('Регистрация успешна! Проверьте вашу почту для подтверждения.');
              resetForm();
            }
          } else {
            console.log('Профиль обновлен успешно');
            setMessage('Регистрация успешна! Проверьте вашу почту для подтверждения.');
            resetForm();
          }
        }
      } else {
        // Вход (без изменений)
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (error) {
          setMessage('Ошибка входа: ' + error.message);
        }
      }
    } catch (error) {
      console.error('Общая ошибка:', error);
      setMessage('Произошла ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setSelectedGroupId(null);
    setMessage('');
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg shadow-lg bg-white">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        {isSignUp ? 'Регистрация в QuizFlow' : 'Вход в QuizFlow'}
      </h2>
      
      {message && (
        <div className={`p-3 rounded mb-4 ${
          message.includes('успешна') ? 'bg-green-100 text-green-800 border border-green-200' : 
          'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
          <input
            type="email"
            placeholder="Введите ваш email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Пароль</label>
          <input
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
            required
            minLength="6"
          />
        </div>

        {isSignUp && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Фамилия</label>
              <input
                type="text"
                placeholder="Введите вашу фамилию"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Имя</label>
              <input
                type="text"
                placeholder="Введите ваше имя"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                required
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3 text-gray-800">Выбор учебной группы</h3>
              <GroupSelector onGroupSelect={setSelectedGroupId} />
              
              {/* Индикатор выбранной группы */}
              {selectedGroupId && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Группа выбрана (ID: {selectedGroupId})</span>
                  </div>
                </div>
              )}
              
              {!selectedGroupId && isSignUp && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Выберите учебную группу для завершения регистрации</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading || (isSignUp && !selectedGroupId)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center font-medium"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Регистрация...
            </>
          ) : (
            isSignUp ? 'Зарегистрироваться' : 'Войти'
          )}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            const wasSignUp = isSignUp;
            setIsSignUp(!isSignUp);
            setMessage('');
            if (wasSignUp) {
              resetForm();
            }
          }}
          className="text-blue-600 hover:text-blue-800 underline transition duration-200 font-medium"
        >
          {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}