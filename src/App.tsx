import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { TradeListPage } from './pages/TradeListPage'
import { TradeFormPage } from './pages/TradeFormPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ReportPage = lazy(() => import('./pages/ReportPage').then((m) => ({ default: m.ReportPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

function PageFallback() {
  return <p className="py-10 text-center text-zinc-500">טוען...</p>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <TradeListPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <TradeFormPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <TradeFormPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<PageFallback />}>
                    <DashboardPage />
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<PageFallback />}>
                    <ReportPage />
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <Layout>
                    <Suspense fallback={<PageFallback />}>
                      <AdminPage />
                    </Suspense>
                  </Layout>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
