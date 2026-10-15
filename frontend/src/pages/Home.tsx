import { Link } from 'react-router-dom'
import { authAPI } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const handleGuest = async () => {
    try {
      const res = await authAPI.guest()
      login(res.data)
      navigate('/jd')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          JobPrep <span className="text-blue-600">Agent</span>
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          AI 驱动的技术面试备考助手
        </p>
        <p className="text-sm text-gray-400 mb-12">
          JD 解析 · 个性化复习清单 · 多轮模拟面试 · 薄弱点追踪
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: '📋', title: 'JD 智能解析', desc: '自动提取岗位技术要求，评估与你的匹配度' },
            { icon: '📚', title: '定向复习清单', desc: '基于历史薄弱点，生成针对性复习计划' },
            { icon: '🎯', title: '真实模拟面试', desc: '代码沙箱判题，面试官连环追问，体验大厂面试' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm text-left">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          {user ? (
            <Link
              to="/jd"
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-lg"
            >
              开始备考 →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-lg"
              >
                登录 / 注册
              </Link>
              <button
                onClick={handleGuest}
                className="px-8 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors text-lg"
              >
                游客体验
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
