import { Route, Routes, Navigate } from 'react-router-dom';
import { ShopLayout } from './components/ShopLayout';
import { HomePage } from './pages/HomePage';
import { ProductListPage } from './pages/ProductListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { LoginPage } from './pages/LoginPage';
import { DeliveryAddressPage } from './pages/DeliveryAddressPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { SearchPage } from './pages/SearchPage';
import { ProfilePage } from './pages/ProfilePage';
import { StoresPage } from './pages/StoresPage';
import { VendorStorePage } from './pages/VendorStorePage';
import { VendorProductDetailPage } from './pages/VendorProductDetailPage';
import { OffersPage } from './pages/OffersPage';

export function App() {
  return (
    <Routes>
      <Route element={<ShopLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/restaurants" element={<StoresPage />} />
        <Route path="/vendors/:vendorId" element={<VendorStorePage />} />
        <Route path="/vendors/:vendorId/products/:vendorProductId" element={<VendorProductDetailPage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/delivery-address" element={<DeliveryAddressPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
