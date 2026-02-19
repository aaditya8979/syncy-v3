import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { RoomPage } from './pages/RoomPage'
import { JoinPage } from './pages/JoinPage'
import { useAuth } from './hooks/useAuth'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const Spinner = () => (
  <div className="min-h-screen bg-[#070710] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

const AppRoutes = () => {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />

  return (
    <Routes>
      <Route path="/login"     element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/room/:id"  element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
      {/* /join/:id — shareable link, redirects to login then room */}
      <Route path="/join/:id"  element={<JoinPage />} />
      <Route path="/"          element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
