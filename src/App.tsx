import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { BusinessRoute } from './components/BusinessRoute'
import { Layout } from './components/Layout'
import { BusinessLayout } from './components/BusinessLayout'
import { LoginPage } from './pages/LoginPage'
import { TradeListPage } from './pages/TradeListPage'
import { TradeFormPage } from './pages/TradeFormPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ReportPage = lazy(() => import('./pages/ReportPage').then((m) => ({ default: m.ReportPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const CustomersPage = lazy(() =>
  import('./pages/business/CustomersPage').then((m) => ({ default: m.CustomersPage })),
)
const CustomerFormPage = lazy(() =>
  import('./pages/business/CustomerFormPage').then((m) => ({ default: m.CustomerFormPage })),
)
const LeadsPage = lazy(() => import('./pages/business/LeadsPage').then((m) => ({ default: m.LeadsPage })))
const ExpensesPage = lazy(() =>
  import('./pages/business/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
)
const CashflowPage = lazy(() =>
  import('./pages/business/CashflowPage').then((m) => ({ default: m.CashflowPage })),
)

function PageFallback() {
  return <p className="py-10 text-center text-zinc-500">טוען...</p>
}

/** מלביש עמוד עסקי בהגנות הגישה (מאושר + business_access), Layout הראשי, וטאבי המודול העסקי */
function businessPage(element: ReactNode) {
  return (
    <ProtectedRoute>
      <BusinessRoute>
        <Layout>
          <Suspense fallback={<PageFallback />}>
            <BusinessLayout>{element}</BusinessLayout>
          </Suspense>
        </Layout>
      </BusinessRoute>
    </ProtectedRoute>
  )
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
          <Route path="/business" element={<Navigate to="/business/customers" replace />} />
          <Route path="/business/customers" element={businessPage(<CustomersPage />)} />
          <Route path="/business/customers/new" element={businessPage(<CustomerFormPage />)} />
          <Route path="/business/customers/:id/edit" element={businessPage(<CustomerFormPage />)} />
          <Route path="/business/leads" element={businessPage(<LeadsPage />)} />
          <Route path="/business/expenses" element={businessPage(<ExpensesPage />)} />
          <Route path="/business/cashflow" element={businessPage(<CashflowPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
