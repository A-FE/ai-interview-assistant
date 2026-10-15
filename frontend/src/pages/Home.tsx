import { Link } from 'react-router-dom'
import { authAPI } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const features = [
  {
    icon: '📋',
    title: 'JD 智能解析',
    desc: '自动提取岗位技术要求，评估与你的匹配度',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    tag: '匹配分析',
  },
  {
    icon: '📚',
    title: '定向复习清单',
    desc: '基于历史薄弱点，生成针对性个人复习计划',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    tag: '个性化',
  },
  {
    icon: '🎯',
    title: '真实模拟面试',
    desc: '代码沙箱判题，面试官连环追问，大厂面试体验',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-orange-50',
    tag: '沙箱运行',
  },
]

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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/30">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
          AI 驱动 · 实时流式分析
        </div>

        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight">
          让 AI 帮你<br />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            拿下目标 Offer
          </span>
        </h1>

        <p className="text-lg text-gray-500 mb-3 max-w-xl mx-auto leading-relaxed">
          JD 解析 → 个性化复习清单 → 模拟面试 → 薄弱点追踪
        </p>
        <p className="text-sm text-gray-400 mb-10">全流程覆盖，精准提升面试通过率</p>

        <div className="flex gap-4 justify-center flex-wrap">
          {user ? (
            <Link
              to="/jd"
              className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all duration-200 shadow-lg shadow-indigo-200 text-base"
            >
              开始备考 →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all duration-200 shadow-lg shadow-indigo-200 text-base"
              >
                登录 / 注册
              </Link>
              <button
                onClick={handleGuest}
                className="px-8 py-3.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all duration-200 shadow-sm text-base"
              >
                游客体验
              </button>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:-translate-y-0.5"
            >
              <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center text-2xl mb-4`}>
                {f.icon}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 text-base">{f.title}</h3>
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{f.tag}</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
