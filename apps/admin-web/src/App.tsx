import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductsPage } from './pages/ProductsPage';
import { VendorsPage } from './pages/VendorsPage';
import { VendorDetailPage } from './pages/VendorDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { VendorMappingPage } from './pages/VendorMappingPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { DeliveryZonesPage } from './pages/DeliveryZonesPage';
import { DeliveryPeoplePage } from './pages/DeliveryPeoplePage';
import { VendorStaffPage } from './pages/VendorStaffPage';

const placeholderPaths = [
  'pricing',
  'offers',
  'coupons',
  'inventory',
  'customers',
  'payments',
  'notifications',
  'reports',
  'roles',
  'audit-logs',
  'settings',
] as const;

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="vendors/:id" element={<VendorDetailPage />} />
        <Route path="vendor-mapping" element={<VendorMappingPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="configuration" element={<ConfigurationPage />} />
        <Route path="delivery" element={<DeliveryZonesPage />} />
        <Route path="delivery-partners" element={<DeliveryPeoplePage />} />
        <Route path="vendor-partners" element={<VendorStaffPage />} />
        {placeholderPaths.map((path) => (
          <Route key={path} path={path} element={<PlaceholderPage />} />
        ))}
      </Route>
    </Routes>
  );
}
