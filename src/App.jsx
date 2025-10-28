import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import AuthWithHTML from './components/AuthWithHTML';
import Profile from './components/Profile'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    // Получаем текущую сессию при загрузке
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Слушаем изменения состояния аутентификации
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session)
      setSession(session)
      setLoading(false)

      if (event === 'SIGNED_IN') {
        setAuthError(null)
      } else if (event === 'SIGNED_OUT') {
        setAuthError(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="text-xl font-semibold text-gray-700">Загрузка QuizFlow...</div>
          <p className="text-gray-500 mt-2">Пожалуйста, подождите</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4">
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">QuizFlow</h1>
          <p className="text-gray-600 text-lg">Платформа для учебного тестирования</p>
        </header>
        
        {/* ИЗМЕНИЛИ ЭТУ СТРОКУ: Auth -> AuthWithHTML */}
        {!session ? <AuthWithHTML /> : <Profile key={session.user.id} session={session} />}
        
        <footer className="text-center py-8 text-gray-500 text-sm">
          <p>© 2024 QuizFlow. Все права защищены.</p>
        </footer>
      </div>
    </div>
  )
}

export default App