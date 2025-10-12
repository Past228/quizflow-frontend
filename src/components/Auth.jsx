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
        // Регистрация
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              firstName: firstName,
              lastName: lastName,
              role: 'student'
            }
          }
        });

        if (error) {
          setMessage('Ошибка регистрации: ' + error.message);
        } else if (data.user) {
          // Обновляем профиль с выбранной группой
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ group_id: selectedGroupId })
            .eq('id', data.user.id);

          if (profileError) {
            setMessage('Ошибка при сохранении группы: ' + profileError.message);
          } else {
            setMessage('Регистрация успешна! Проверьте вашу почту для подтверждения.');
            // Очищаем форму
            setEmail('');
            setPassword('');
            setFirstName('');
            setLastName('');
            setSelectedGroupId(null);
          }
        }
      } else {
        // Вход
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (error) {
          setMessage('Ошибка входа: ' + error.message);
        }
      }
    } catch (error) {
      setMessage('Произошла ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isSignUp ? 'Регистрация в QuizFlow' : 'Вход в QuizFlow'}
      </h2>
      
      {message && (
        <div className={`p-3 rounded mb-4 ${
          message.includes('успешна') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            placeholder="Введите ваш email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Пароль</label>
          <input
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            minLength="6"
          />
        </div>

        {isSignUp && (
          <>
        <div>
          <input
            type="text"
            placeholder="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <input
            type="text" 
            placeholder="Имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Выбор учебной группы</h3>
              <GroupSelector onGroupSelect={setSelectedGroupId} />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading || (isSignUp && !selectedGroupId)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200"
        >
          {loading ? 'Загрузка...' : (isSignUp ? 'Зарегистрироваться' : 'Войти')}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setMessage('');
          }}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}