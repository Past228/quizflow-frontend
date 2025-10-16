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
        if (!selectedGroupId) {
          setMessage('❌ Выберите учебную группу');
          setLoading(false);
          return;
        }

        console.log('🚀 РЕГИСТРАЦИЯ:', { email, firstName, lastName, selectedGroupId });

        // 1. РЕГИСТРАЦИЯ С META DATA
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              group_id: selectedGroupId // ДОБАВЛЯЕМ ГРУППУ СРАЗУ В META DATA
            }
          }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Пользователь не создан');

        console.log('✅ ПОЛЬЗОВАТЕЛЬ СОЗДАН:', authData.user.id);

        // 2. ПРОВЕРЯЕМ ТРИГГЕР - если профиль создается автоматически
        let profile = null;
        let retries = 5;
        
        while (retries > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from('profilex') // ИСПРАВЛЕНО: profilex вместо profiles
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (profileData && !profileError) {
            profile = profileData;
            console.log('✅ ПРОФИЛЬ НАЙДЕН:', profile);
            break;
          }
          
          console.log('⏳ Ожидание создания профиля... попытка', 6 - retries);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries--;
        }

        // 3. ЕСЛИ ПРОФИЛЬ НЕ СОЗДАЛСЯ АВТОМАТИЧЕСКИ - СОЗДАЕМ ВРУЧНУЮ
        if (!profile) {
          console.log('🛠 Создаем профиль вручную...');
          const { data: newProfile, error: createError } = await supabase
            .from('profilex')
            .insert({
              id: authData.user.id,
              first_name: firstName,
              last_name: lastName,
              email: email,
              group_id: selectedGroupId,
              role: 'student',
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) {
            console.error('❌ Ошибка создания профиля:', createError);
            throw new Error('Не удалось создать профиль: ' + createError.message);
          }
          
          profile = newProfile;
          console.log('✅ ПРОФИЛЬ СОЗДАН ВРУЧНУЮ:', profile);
        } else {
          // 4. ОБНОВЛЯЕМ ГРУППУ ЕСЛИ ПРОФИЛЬ УЖЕ БЫЛ
          const { error: updateError } = await supabase
            .from('profilex') // ИСПРАВЛЕНО: profilex вместо profiles
            .update({ 
              group_id: selectedGroupId,
              first_name: firstName,
              last_name: lastName,
              updated_at: new Date().toISOString()
            })
            .eq('id', authData.user.id);

          if (updateError) {
            console.error('❌ Ошибка обновления профиля:', updateError);
            throw new Error('Данные не сохранены: ' + updateError.message);
          }
          console.log('✅ ПРОФИЛЬ ОБНОВЛЕН С ГРУППОЙ');
        }

        console.log('✅ РЕГИСТРАЦИЯ ЗАВЕРШЕНА');
        setMessage('✅ Регистрация успешна! Проверьте email для подтверждения.');
        resetForm();

      } else {
        // ВХОД
        console.log('🔑 ВХОД:', email);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('✅ Вход выполнен!');
      }
    } catch (error) {
      console.error('💥 ОШИБКА:', error);
      setMessage('❌ ' + error.message);
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
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg shadow-lg bg-white">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        {isSignUp ? 'Регистрация' : 'Вход'}
      </h2>
      
      {message && (
        <div className={`p-3 rounded mb-4 ${
          message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded-lg"
            required
            minLength="6"
          />
        </div>

        {isSignUp && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Фамилия</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Выбор группы</h3>
              <GroupSelector onGroupSelect={setSelectedGroupId} />
              
              {selectedGroupId && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <span className="text-green-700">✅ Группа выбрана</span>
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading || (isSignUp && !selectedGroupId)}
          className="w-full bg-blue-600 text-white p-3 rounded-lg disabled:bg-gray-400"
        >
          {loading ? '⏳' : (isSignUp ? 'Зарегистрироваться' : 'Войти')}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setMessage('');
            resetForm();
          }}
          className="text-blue-600 underline"
        >
          {isSignUp ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}