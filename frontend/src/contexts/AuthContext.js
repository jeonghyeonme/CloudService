import React, { createContext, useContext, useState } from "react";

// 전역에서 사용할 Auth Context 생성
const AuthContext = createContext();

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

function decodeJwtPayload(token) {
  if (!token) {
    return null;
  }

  try {
    const encodedPayload = token.split(".")[1];
    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const decodedPayload = window.atob(paddedPayload);

    return JSON.parse(decodedPayload);
  } catch (error) {
    return null;
  }
}

/**
 * 전역 인증 상태 제공자 컴포넌트
 * App 전체를 감싸서 로그인 정보 공유
 */
export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(() =>
    localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const [refreshToken, setRefreshToken] = useState(() =>
    localStorage.getItem(REFRESH_TOKEN_KEY),
  );
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;

    if (parsedUser?.userId) {
      return parsedUser;
    }

    const decodedPayload = decodeJwtPayload(localStorage.getItem(ACCESS_TOKEN_KEY));
    return parsedUser
      ? { ...parsedUser, userId: decodedPayload?.sub || null }
      : null;
  });

  const isLoggedIn = Boolean(accessToken && refreshToken);

  // 로그인 처리 함수
  const login = ({
    nickname,
    profileImageUrl = null,
    accessToken,
    refreshToken,
  }) => {
    const decodedPayload = decodeJwtPayload(accessToken);
    const userData = {
      userId: decodedPayload?.sub || null,
      nickname,
      profileImageUrl,
    };

    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setUser(userData);

    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  };

  // 액세스 토큰 업데이트 함수
  const updateAccessToken = (newAccessToken) => {
    setAccessToken(newAccessToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
  };

  // 로그아웃 처리 함수
  const updateUser = (updates) => {
    setUser((currentUser) => {
      const nextUser = {
        ...(currentUser || {}),
        ...(updates || {}),
      };

      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        accessToken,
        refreshToken,
        login,
        logout,
        updateAccessToken,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
