import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import JDAnalysis from './pages/JDAnalysis'
import StudyPlan from './pages/StudyPlan'
import Interview from './pages/Interview'
import Report from './pages/Report'
import Records from './pages/Records'
import ResumePage from './pages/ResumePage'
import KBPage from './pages/KBPage'
import { useAuth } from './hooks/useAuth'
import { AuthProvider } from './contexts/AuthContext'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, initializing } = useAuth()
  if (initializing) return null
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
          <Route path="/records" element={<RequireAuth><Records /></RequireAuth>} />
          <Route path="/resume" element={<RequireAuth><ResumePage /></RequireAuth>} />
          <Route path="/kb" element={<RequireAuth><KBPage /></RequireAuth>} />
          {/* legacy redirect */}
          <Route path="/user" element={<Navigate to="/records" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
