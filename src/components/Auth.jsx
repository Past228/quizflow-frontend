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
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!email) {
      newErrors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Некорректный формат email';
    }

    if (!password) {
      newErrors.password = 'Пароль обязателен';
    } else if (password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов';
    }

    if (isSignUp) {
      if (!firstName) newErrors.firstName = 'Имя обязательно';
      if (!lastName) newErrors.lastName = 'Фамилия обязательна';
      if (!selectedGroupId) newErrors.group = 'Выберите учебную группу';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        console.log('🚀 РЕГИСТРАЦИЯ:', { 
          email, 
          firstName, 
          lastName, 
          selectedGroupId 
        });

        // 1. РЕГИСТРАЦИЯ
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              group_id: selectedGroupId
            }
          }
        });

        if (authError) {
          console.error('❌ Ошибка аутентификации:', authError);
          if (authError.message.includes('already registered')) {
            throw new Error('Пользователь с таким email уже зарегистрирован');
          }
          throw authError;
        }

        if (!authData.user) {
          throw new Error('Не удалось создать пользователя');
        }

        console.log('✅ ПОЛЬЗОВАТЕЛЬ СОЗДАН:', authData.user.id);

        // 2. ЖДЕМ и ПРОВЕРЯЕМ создание профиля
        console.log('⏳ Ожидаем создания профиля...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. ПРОВЕРЯЕМ СОЗДАЛСЯ ЛИ ПРОФИЛЬ
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError || !profile) {
          console.log('❌ Профиль не создан автоматически');
          throw new Error('Профиль не создан. Обратитесь к администратору.');
        }

        console.log('✅ ПРОФИЛЬ СОЗДАН:', profile);

        // 4. ПРОВЕРЯЕМ СОХРАНИЛАСЬ ЛИ ГРУППА
        if (profile.group_id !== parseInt(selectedGroupId)) {
          console.log('🔄 Группа не сохранилась, обновляем...');
          
          // Пробуем обновить группу
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              group_id: selectedGroupId,
              first_name: firstName,
              last_name: lastName 
            })
            .eq('id', authData.user.id);

          if (updateError) {
            console.error('❌ Ошибка обновления профиля:', updateError);
            throw new Error('Данные группы не сохранились: ' + updateError.message);
          }
          
          console.log('✅ ГРУППА ОБНОВЛЕНА');
        }

        console.log('✅ РЕГИСТРАЦИЯ ЗАВЕРШЕНА');
        setMessage('✅ Регистрация успешна! Проверьте email для подтверждения.');
        resetForm();

      } else {
        // ВХОД
        console.log('🔑 ВХОД:', email);
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Неверный email или пароль');
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Email не подтвержден. Проверьте вашу почту');
          }
          throw error;
        }
        
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
    setErrors({});
    setMessage('');
  };

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    if (errors[e.target.name]) {
      setErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg shadow-lg bg-white">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        {isSignUp ? 'Регистрация' : 'Вход'}
      </h2>
      
      {message && (
        <div className={`p-3 rounded mb-4 ${
          message.includes('✅') ? 'bg-green-100 text-green-800 border border-green-200' : 
          'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={email}
            onChange={handleInputChange(setEmail)}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
              errors.email ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
            }`}
            required
          />
          {errors.email && (
            <div className="text-red-500 text-sm mt-1 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.email}
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Пароль</label>
          <input
            type="password"
            name="password"
            value={password}
            onChange={handleInputChange(setPassword)}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
              errors.password ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
            }`}
            required
            minLength="6"
          />
          {errors.password && (
            <div className="text-red-500 text-sm mt-1 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.password}
            </div>
          )}
        </div>

        {isSignUp && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Фамилия</label>
              <input
                type="text"
                name="lastName"
                value={lastName}
                onChange={handleInputChange(setLastName)}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.lastName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
                }`}
                required
              />
              {errors.lastName && (
                <div className="text-red-500 text-sm mt-1 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.lastName}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <input
                type="text"
                name="firstName"
                value={firstName}
                onChange={handleInputChange(setFirstName)}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.firstName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
                }`}
                required
              />
              {errors.firstName && (
                <div className="text-red-500 text-sm mt-1 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.firstName}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Выбор группы</h3>
              <GroupSelector onGroupSelect={setSelectedGroupId} />
              
              {errors.group && (
                <div className="text-red-500 text-sm mt-2 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.group}
                </div>
              )}
              
              {selectedGroupId ? (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-green-700 flex items-center">
                    <span className="mr-2">✅</span>
                    Группа выбрана (ID: {selectedGroupId})
                  </span>
                </div>
              ) : (
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <span className="text-yellow-700 flex items-center">
                    <span className="mr-2">⚠️</span>
                    Выберите группу для регистрации
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded-lg disabled:bg-gray-400 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Обработка...
            </div>
          ) : (
            isSignUp ? 'Зарегистрироваться' : 'Войти'
          )}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            resetForm();
          }}
          className="text-blue-600 underline hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded"
        >
          {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}