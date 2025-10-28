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

        await new Promise(resolve => setTimeout(resolve, 2000));

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

        if (profile.group_id !== parseInt(selectedGroupId)) {
          console.log('🔄 Группа не сохранилась, обновляем...');
          
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">QuizFlow</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg font-medium text-gray-700">Лидерберд</span>
              {!isSignUp && (
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                  Войти
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Platform Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">QuizFlow</h1>
          <p className="text-xl text-gray-600">Платформа для учебного тестирования</p>
        </div>

        {/* Auth Form */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              {isSignUp ? 'Регистрация' : 'Вход'}
            </h2>
            
            {message && (
              <div className={`p-4 rounded-md mb-6 ${
                message.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 
                'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-6">
              {/* Email & Password Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email:
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={handleInputChange(setEmail)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Введите ваш email"
                    required
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Пароль:
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={handleInputChange(setPassword)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Введите ваш пароль"
                    required
                    minLength="6"
                  />
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>
              </div>

              {/* Personal Info Section - Only for Registration */}
              {isSignUp && (
                <div className="space-y-4 border-t border-gray-200 pt-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Фамилия:
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={handleInputChange(setLastName)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Введите вашу фамилию"
                      required
                    />
                    {errors.lastName && (
                      <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Имя:
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={handleInputChange(setFirstName)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Введите ваше имя"
                      required
                    />
                    {errors.firstName && (
                      <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Group Selection - Only for Registration */}
              {isSignUp && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Выбор учебной группы
                  </h3>
                  <GroupSelector onGroupSelect={setSelectedGroupId} />
                  
                  {errors.group && (
                    <p className="text-red-500 text-sm mt-2">{errors.group}</p>
                  )}
                  
                  {selectedGroupId && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-green-700 text-sm">
                        Группа успешно выбрана
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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

            {/* Toggle between Sign Up and Sign In */}
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  resetForm();
                }}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500">
            <p>© 2024 QuizFlow. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}