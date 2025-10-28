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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-gray-900">QuizFlow</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xl font-semibold text-gray-700">Лидерберд</span>
            {!isSignUp && (
              <button 
                onClick={() => setIsSignUp(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Войти
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auth Form */}
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-xl border border-gray-200">
        <h2 className="text-3xl font-bold mb-8 text-center text-gray-900">
          {isSignUp ? 'Регистрация' : 'Вход'}
        </h2>
        
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.includes('✅') ? 'bg-green-100 text-green-800 border border-green-300' : 
            'bg-red-100 text-red-800 border border-red-300'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          {/* Email & Password Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Email:</label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={handleInputChange(setEmail)}
                className={`w-full p-4 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  errors.email ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                }`}
                placeholder="Введите ваш email"
                required
              />
              {errors.email && (
                <div className="text-red-500 text-sm mt-2 flex items-center">
                  <span className="mr-2">⚠️</span>
                  {errors.email}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Пароль:</label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={handleInputChange(setPassword)}
                className={`w-full p-4 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  errors.password ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                }`}
                placeholder="Введите ваш пароль"
                required
                minLength="6"
              />
              {errors.password && (
                <div className="text-red-500 text-sm mt-2 flex items-center">
                  <span className="mr-2">⚠️</span>
                  {errors.password}
                </div>
              )}
            </div>
          </div>

          {/* Personal Info Section (only for registration) */}
          {isSignUp && (
            <>
              <div className="border-t border-gray-300 pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Фамилия:</label>
                  <input
                    type="text"
                    name="lastName"
                    value={lastName}
                    onChange={handleInputChange(setLastName)}
                    className={`w-full p-4 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      errors.lastName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                    }`}
                    placeholder="Введите вашу фамилию"
                    required
                  />
                  {errors.lastName && (
                    <div className="text-red-500 text-sm mt-2 flex items-center">
                      <span className="mr-2">⚠️</span>
                      {errors.lastName}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Имя:</label>
                  <input
                    type="text"
                    name="firstName"
                    value={firstName}
                    onChange={handleInputChange(setFirstName)}
                    className={`w-full p-4 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      errors.firstName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                    }`}
                    placeholder="Введите ваше имя"
                    required
                  />
                  {errors.firstName && (
                    <div className="text-red-500 text-sm mt-2 flex items-center">
                      <span className="mr-2">⚠️</span>
                      {errors.firstName}
                    </div>
                  )}
                </div>
              </div>

              {/* Group Selection Section */}
              <div className="border-t border-gray-300 pt-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Выбор учебной группы</h3>
                <GroupSelector onGroupSelect={setSelectedGroupId} />
                
                {errors.group && (
                  <div className="text-red-500 text-sm mt-3 flex items-center">
                    <span className="mr-2">⚠️</span>
                    {errors.group}
                  </div>
                )}
                
                {selectedGroupId ? (
                  <div className="mt-4 p-4 bg-green-50 rounded-xl border-2 border-green-300">
                    <span className="text-green-700 font-medium flex items-center">
                      <span className="mr-2">✅</span>
                      Группа успешно выбрана
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-xl border-2 border-yellow-300">
                    <span className="text-yellow-700 flex items-center">
                      <span className="mr-2">⚠️</span>
                      Для регистрации необходимо выбрать учебную группу
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-xl disabled:bg-gray-400 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                Обработка...
              </div>
            ) : (
              isSignUp ? 'Зарегистрироваться' : 'Войти'
            )}
          </button>
        </form>

        {/* Toggle between Sign Up and Sign In */}
        <div className="mt-8 text-center border-t border-gray-300 pt-6">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              resetForm();
            }}
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-lg px-4 py-2"
          >
            {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </div>
    </div>
  );
}