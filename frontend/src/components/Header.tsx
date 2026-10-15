import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to
    return (
      <Link
        to={to}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          active
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            AI
          </div>
          <span className="font-bold text-base text-gray-900 tracking-tight">
            AI 面试<span className="text-indigo-600">助手</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {user ? (
            <>
              {navLink('/jd', 'JD 分析')}
              {navLink('/resume', '简历')}
              {navLink('/records', '分析记录')}
              {!user.is_guest && navLink('/kb', '知识库')}
              <div className="w-px h-4 bg-gray-200 mx-2" />
              <span className="text-xs text-gray-400 px-1">
                {user.is_guest ? '🙋 游客' : `👤 ${user.username}`}
              </span>
              <button
                onClick={handleLogout}
                className="ml-1 px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                退出
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:scale-95 transition-all duration-200 shadow-sm"
            >
              登录 / 注册
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
