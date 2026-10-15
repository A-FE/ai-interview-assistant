import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import JDAnalysis from './pages/JDAnalysis'
import StudyPlan from './pages/StudyPlan'
import Interview from './pages/Interview'
import Report from './pages/Report'
import UserCenter from './pages/UserCenter'
import { useAuth } from './hooks/useAuth'
import { AuthProvider } from './contexts/AuthContext'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/jd" element={<RequireAuth><JDAnalysis /></RequireAuth>} />
          <Route path="/study" element={<RequireAuth><StudyPlan /></RequireAuth>} />
          <Route path="/interview" element={<RequireAuth><Interview /></RequireAuth>} />
          <Route path="/report/:id" element={<RequireAuth><Report /></RequireAuth>} />
          <Route path="/user" element={<RequireAuth><UserCenter /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
