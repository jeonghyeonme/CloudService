import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login as loginApi } from "../../lib/auth";
import { useAuth } from "../../contexts/AuthContext";
import { PATHS } from "../../constants/path";
import AuthShell from "./AuthShell";
import "./Auth.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const successMessage = location.state?.successMessage || "";
  const registeredEmail = location.state?.registeredEmail || "";

  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginApi({ email, password });

      login({
        nickname: data.nickname,
        profileImageUrl: data.profileImageUrl,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });

      navigate(PATHS.explore, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="다시 만나서 반가워요"
      subtitle="계정에 로그인하여 학습을 이어가세요!"
      footer={
        <>
          아직 계정이 없으신가요?{" "}
          <Link to={PATHS.register} className="auth-link">
            회원가입
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin}>
        {successMessage && <p className="auth-success">{successMessage}</p>}

        <div className="form-group">
          <label className="form-label" htmlFor="email-or-phone">
            이메일 또는 전화번호
          </label>
          <input
            className="form-input"
            id="email-or-phone"
            type="text"
            placeholder="예: nathan@substratum.io"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            비밀번호
          </label>
          <input
            className="form-input"
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="btn-neon" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </AuthShell>
  );
};

export default Login;
