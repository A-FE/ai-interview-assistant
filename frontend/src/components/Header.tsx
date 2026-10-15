import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg text-blue-600 tracking-tight">
          JobPrep Agent
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to="/jd" className="text-gray-600 hover:text-blue-600 transition-colors">
                JD 分析
              </Link>
              <Link to="/user" className="text-gray-600 hover:text-blue-600 transition-colors">
                用户中心
              </Link>
              <span className="text-gray-400 text-xs">
                {user.is_guest ? '游客' : user.username}
              </span>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-500 transition-colors"
              >
                退出
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              登录 / 注册
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
