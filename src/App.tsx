import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { PerformanceRoute } from './components/PerformanceRoute'
import { BusinessRoute } from './components/BusinessRoute'
import { MentoringRoute } from './components/MentoringRoute'
import { Layout, ListIcon, PlusIcon, ChartIcon, DocIcon, AdminIcon } from './components/Layout'
import type { NavItem } from './components/Layout'
import { BusinessLayout } from './components/BusinessLayout'
import { MentoringLayout } from './components/MentoringLayout'
import { Toaster } from './components/ui/toast'
import { LoginPage } from './pages/LoginPage'
import { PlatformSelectPage } from './pages/PlatformSelectPage'
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
const TreasuryPage = lazy(() =>
  import('./pages/business/TreasuryPage').then((m) => ({ default: m.TreasuryPage })),
)
const MeetingsPage = lazy(() =>
  import('./pages/mentoring/MeetingsPage').then((m) => ({ default: m.MeetingsPage })),
)
const MeetingFormPage = lazy(() =>
  import('./pages/mentoring/MeetingFormPage').then((m) => ({ default: m.MeetingFormPage })),
)
const MentoringStudentsPage = lazy(() =>
  import('./pages/mentoring/StudentsPage').then((m) => ({ default: m.StudentsPage })),
)
const AssignmentsPage = lazy(() =>
  import('./pages/mentoring/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })),
)

function PageFallback() {
  return <p className="py-10 text-center text-muted-foreground">טוען...</p>
}

const performanceBaseNavItems: NavItem[] = [
  { to: '/performance', label: 'עסקאות', icon: ListIcon },
  { to: '/performance/new', label: 'הזנה', icon: PlusIcon },
  { to: '/performance/dashboard', label: 'דשבורד', icon: ChartIcon },
  { to: '/performance/report', label: 'דוח תקופתי', icon: DocIcon },
]

/** Layout של פלטפורמת הביצועים, עם טאב "ניהול" נוסף למנהלים בלבד */
function PerformanceLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const navItems: NavItem[] = [
    ...performanceBaseNavItems,
    ...(profile?.role === 'admin' ? [{ to: '/performance/admin', label: 'ניהול', icon: AdminIcon }] : []),
  ]
  return <Layout navItems={navItems}>{children}</Layout>
}

/** מלביש עמוד ביצועים בהגנות הגישה (מאושר בפועל, לא רק גישה כלשהי לאפליקציה) ו-Layout של פלטפורמת הביצועים */
function performancePage(element: ReactNode) {
  return (
    <ProtectedRoute>
      <PerformanceRoute>
        <PerformanceLayout>{element}</PerformanceLayout>
      </PerformanceRoute>
    </ProtectedRoute>
  )
}

/** מלביש עמוד עסקי בהגנות הגישה (מאושר + business_access), Layout הראשי, וטאבי המודול העסקי */
function businessPage(element: ReactNode) {
  return (
    <ProtectedRoute>
      <BusinessRoute>
        <Layout navItems={[]}>
          <Suspense fallback={<PageFallback />}>
            <BusinessLayout>{element}</BusinessLayout>
          </Suspense>
        </Layout>
      </BusinessRoute>
    </ProtectedRoute>
  )
}

/** מלביש עמוד מנטורינג בהגנות הגישה (מאושר + mentor_access/admin), Layout הראשי, וטאבי המודול */
function mentoringPage(element: ReactNode) {
  return (
    <ProtectedRoute>
      <MentoringRoute>
        <Layout navItems={[]}>
          <Suspense fallback={<PageFallback />}>
            <MentoringLayout>{element}</MentoringLayout>
          </Suspense>
        </Layout>
      </MentoringRoute>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PlatformSelectPage />
              </ProtectedRoute>
            }
          />
          <Route path="/performance" element={performancePage(<TradeListPage />)} />
          <Route path="/performance/new" element={performancePage(<TradeFormPage />)} />
          <Route path="/performance/edit/:id" element={performancePage(<TradeFormPage />)} />
          <Route
            path="/performance/dashboard"
            element={performancePage(
              <Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </Suspense>,
            )}
          />
          <Route
            path="/performance/report"
            element={performancePage(
              <Suspense fallback={<PageFallback />}>
                <ReportPage />
              </Suspense>,
            )}
          />
          <Route
            path="/performance/admin"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <PerformanceLayout>
                    <Suspense fallback={<PageFallback />}>
                      <AdminPage />
                    </Suspense>
                  </PerformanceLayout>
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
          <Route path="/business/treasury" element={businessPage(<TreasuryPage />)} />
          <Route path="/mentoring" element={<Navigate to="/mentoring/meetings" replace />} />
          <Route path="/mentoring/meetings" element={mentoringPage(<MeetingsPage />)} />
          <Route path="/mentoring/meetings/new" element={mentoringPage(<MeetingFormPage />)} />
          <Route path="/mentoring/meetings/:id/edit" element={mentoringPage(<MeetingFormPage />)} />
          <Route path="/mentoring/students" element={mentoringPage(<MentoringStudentsPage />)} />
          <Route
            path="/mentoring/assignments"
            element={
              <ProtectedRoute>
                <MentoringRoute>
                  <AdminRoute>
                    <Layout navItems={[]}>
                      <Suspense fallback={<PageFallback />}>
                        <MentoringLayout>
                          <AssignmentsPage />
                        </MentoringLayout>
                      </Suspense>
                    </Layout>
                  </AdminRoute>
                </MentoringRoute>
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
