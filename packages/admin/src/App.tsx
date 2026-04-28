/**
 * App component with routing and layout
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Performance from "./pages/Performance";
import Conversations from "./pages/Conversations";
import Installs from "./pages/Installs";
import Alerts from "./pages/Alerts";
import CrashIssues from "./pages/CrashIssues";
import CrashStats from "./pages/CrashStats";
import Users from "./pages/Users";
import System from "./pages/System";

// Protected route component
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: string;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 50, textAlign: "center" }}>加载中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role === "viewer" && requiredRole !== "viewer") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Admin route (only for admin role)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="performance" element={<Performance />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="installs" element={<Installs />} />
        <Route
          path="alerts"
          element={
            <ProtectedRoute requiredRole="operator">
              <Alerts />
            </ProtectedRoute>
          }
        />
        <Route path="crash-issues" element={<CrashIssues />} />
        <Route path="crash-stats" element={<CrashStats />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
        <Route
          path="system"
          element={
            <AdminRoute>
              <System />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}