import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { FacilityProvider } from './FacilityProvider';
import { AppLayout } from '../components/AppLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { ReservationsPage } from '../features/reservations/ReservationsPage';
import { CourtsPage } from '../features/courts/CourtsPage';
import { AuthenticatedRedirect, ForgotPasswordPage, LoginPage, PublicOnlyRoute, RegisterPage, RequireAuth, RequireRoles, ResetPasswordPage } from '../features/auth/AuthPages';
import { CustomerPortalPage } from '../features/portal/CustomerPortalPage';
import { UserManagementPage } from '../features/users/UserManagementPage';
import { DirectoryPage } from '../features/directory/DirectoryPage';
import { PaymentsPage } from '../features/payments/PaymentsPage';
import { MaintenancePage } from '../features/maintenance/MaintenancePage';
import { TournamentsPage } from '../features/tournaments/TournamentsPage';
import { StandingsPage } from '../features/tournaments/StandingsPage';
import { MatchesPage } from '../features/matches/MatchesPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { RevenueOccupancyPage } from '../features/reports/RevenueOccupancyPage';
import { PromotionsPage } from '../features/promotions/PromotionsPage';
import { ActivityPage } from '../features/activity/ActivityPage';
import { ROUTES } from './routes';

const STAFF_ROLES = ['owner', 'receptionist'] as const;
const OWNER_ROLE = ['owner'] as const;
const MAINTENANCE_ROLES = ['owner', 'receptionist', 'maintenance'] as const;
const MATCH_ROLES = ['owner', 'receptionist', 'referee'] as const;

function FacilityDataBoundary() {
  return <FacilityProvider><Outlet /></FacilityProvider>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path={ROUTES.login} element={<LoginPage />} />
            <Route path={ROUTES.register} element={<RegisterPage />} />
            <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
          </Route>
          <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<RequireRoles allowed={STAFF_ROLES} />}>
              <Route element={<FacilityDataBoundary />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path={ROUTES.calendar.slice(1)} element={<CalendarPage />} />
                  <Route path={ROUTES.reservations.slice(1)} element={<ReservationsPage />} />
                  <Route path={ROUTES.courts.slice(1)} element={<CourtsPage />} />
                  <Route path={ROUTES.customers.slice(1)} element={<DirectoryPage entity="customers" />} />
                  <Route path={ROUTES.teams.slice(1)} element={<DirectoryPage entity="teams" />} />
                  <Route path={ROUTES.payments.slice(1)} element={<PaymentsPage />} />
                  <Route path={ROUTES.tournaments.slice(1)} element={<RequireRoles allowed={STAFF_ROLES} />}>
                    <Route index element={<TournamentsPage />} />
                  </Route>
                  <Route path={ROUTES.standings.slice(1)} element={<RequireRoles allowed={STAFF_ROLES} />}>
                    <Route index element={<StandingsPage />} />
                  </Route>
                  <Route path={ROUTES.occupancy.slice(1)} element={<RequireRoles allowed={OWNER_ROLE} />}>
                    <Route index element={<RevenueOccupancyPage />} />
                  </Route>
                  <Route path={ROUTES.reports.slice(1)} element={<RequireRoles allowed={OWNER_ROLE} />}>
                    <Route index element={<ReportsPage />} />
                  </Route>
                  <Route path={ROUTES.promotions.slice(1)} element={<RequireRoles allowed={OWNER_ROLE} />}>
                    <Route index element={<PromotionsPage />} />
                  </Route>
                  <Route path={ROUTES.users.slice(1)} element={<RequireRoles allowed={OWNER_ROLE} />}>
                    <Route index element={<UserManagementPage />} />
                  </Route>
                  <Route path={ROUTES.activity.slice(1)} element={<RequireRoles allowed={OWNER_ROLE} />}>
                    <Route index element={<ActivityPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>
            <Route element={<RequireRoles allowed={MAINTENANCE_ROLES} />}>
              <Route element={<FacilityDataBoundary />}>
                <Route element={<AppLayout />}>
                  <Route path={ROUTES.maintenance.slice(1)} element={<MaintenancePage />} />
                </Route>
              </Route>
            </Route>
            <Route element={<RequireRoles allowed={MATCH_ROLES} />}>
              <Route element={<FacilityDataBoundary />}>
                <Route element={<AppLayout />}>
                  <Route path={ROUTES.matches.slice(1)} element={<MatchesPage />} />
                </Route>
              </Route>
            </Route>
            <Route element={<AppLayout />}>
              <Route path={ROUTES.notifications.slice(1)} element={<NotificationsPage />} />
            </Route>
            <Route element={<RequireRoles allowed={['customer']} />}>
              <Route element={<FacilityDataBoundary />}>
                <Route element={<AppLayout />}>
                  <Route path={ROUTES.portal.slice(1)} element={<CustomerPortalPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="/auth/redirect" element={<AuthenticatedRedirect />} />
          </Route>
          <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
