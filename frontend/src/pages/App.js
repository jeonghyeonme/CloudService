import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";

// Context
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ServerProvider, useServers } from "../contexts/ServerContext";
import { ToastProvider } from "../contexts/ToastContext";

// Components
import Onboarding from "../components/Onboarding/Onboarding";
import Login from "../components/Auth/Login";
import Register from "../components/Auth/Register";
import ChatLayout from "../components/Chat/ChatLayout";
import ExploreServers from "../components/Servers/ExploreServers";
import ProfileEdit from "../components/Profile/ProfileEdit";
import NotFound from "../components/NotFound/NotFound";
import SharedLayout from "../components/layout/SharedLayout";
import { PATHS } from "../constants/path";

/**
 * 로그인 여부에 따라 라우팅을 보호하는 컴포넌트
 */
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) {
    return <Navigate to={PATHS.login} replace />;
  }
  return children;
};

function AppRoutes() {
  const navigate = useNavigate();
  const { isLoggedIn, refreshToken, logout } = useAuth();
  const { clearJoinedServers } = useServers();

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        const { logout: logoutApi } = await import("../lib/auth");
        await logoutApi(refreshToken);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearJoinedServers();
      logout();
      navigate(PATHS.onboarding, { replace: true });
    }
  };

  return (
    <SharedLayout isLoggedIn={isLoggedIn} onLogout={handleLogout}>
      <Routes>
        {/* 기존 라우팅 로직 유지 (이미 로그인한 사용자가 로그인/회원가입 페이지 접근 방지) */}
        <Route
          path={PATHS.home}
          element={
            isLoggedIn ? (
              <Navigate to={PATHS.explore} replace />
            ) : (
              <Navigate to={PATHS.onboarding} replace />
            )
          }
        />
        <Route
          path={PATHS.onboarding}
          element={
            isLoggedIn ? (
              <Navigate to={PATHS.explore} replace />
            ) : (
              <Onboarding />
            )
          }
        />
        <Route
          path={PATHS.login}
          element={
            isLoggedIn ? <Navigate to={PATHS.explore} replace /> : <Login />
          }
        />
        <Route
          path={PATHS.register}
          element={
            isLoggedIn ? <Navigate to={PATHS.explore} replace /> : <Register />
          }
        />
        <Route
          path={PATHS.server}
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path={PATHS.explore}
          element={
            <ProtectedRoute>
              <ExploreServers />
            </ProtectedRoute>
          }
        />
        {/* 404 Not Found 페이지 처리 */}
        <Route
          path={PATHS.profileEdit}
          element={
            <ProtectedRoute>
              <ProfileEdit />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SharedLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ServerProvider>
          <AppRoutes />
        </ServerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
