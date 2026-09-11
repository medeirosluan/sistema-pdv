import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PermissionRoute } from './components/PermissionRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Admin } from './pages/Admin';
import { About } from './pages/About';
import { Audit } from './pages/Audit';
import { CashRegister } from './pages/CashRegister';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Download } from './pages/Download';
import { ForgotPassword } from './pages/ForgotPassword';
import { Help } from './pages/Help';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Pdv } from './pages/Pdv';
import { Pricing } from './pages/Pricing';
import { Privacy } from './pages/Privacy';
import { Products } from './pages/Products';
import { Register } from './pages/Register';
import { Reports } from './pages/Reports';
import { ResetPassword } from './pages/ResetPassword';
import { Sales } from './pages/Sales';
import { Settings } from './pages/Settings';
import { Terms } from './pages/Terms';
import { Users } from './pages/Users';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/planos" element={<Pricing />} />
      <Route path="/baixar" element={<Download />} />
      <Route path="/ajuda" element={<Help />} />
      <Route path="/sobre" element={<About />} />
      <Route path="/termos" element={<Terms />} />
      <Route path="/privacidade" element={<Privacy />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route
            path="painel"
            element={
              <PermissionRoute permission="reports.view">
                <Dashboard />
              </PermissionRoute>
            }
          />
          <Route
            path="pdv"
            element={
              <PermissionRoute permission="sales.create">
                <Pdv />
              </PermissionRoute>
            }
          />
          <Route
            path="vendas"
            element={
              <PermissionRoute permission="reports.view">
                <Sales />
              </PermissionRoute>
            }
          />
          <Route
            path="produtos"
            element={
              <PermissionRoute permission="products.view">
                <Products />
              </PermissionRoute>
            }
          />
          <Route
            path="clientes"
            element={
              <PermissionRoute permission="customers.view">
                <Customers />
              </PermissionRoute>
            }
          />
          <Route
            path="caixa"
            element={
              <PermissionRoute permission="cash.operate">
                <CashRegister />
              </PermissionRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <PermissionRoute permission="users.manage">
                <Users />
              </PermissionRoute>
            }
          />
          <Route
            path="relatorios"
            element={
              <PermissionRoute permission="reports.view">
                <Reports />
              </PermissionRoute>
            }
          />
          <Route
            path="configuracoes"
            element={
              <PermissionRoute permission="settings.manage">
                <Settings />
              </PermissionRoute>
            }
          />
          <Route
            path="auditoria"
            element={
              <PermissionRoute permission="settings.manage">
                <Audit />
              </PermissionRoute>
            }
          />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
