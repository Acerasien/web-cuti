"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      {/* Background decoration */}
      <div style={styles.bgDecor1} />
      <div style={styles.bgDecor2} />

      <div className="card-outer" style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>
        <div className="card-inner" style={{ padding: "var(--space-8)" }}>
          {/* Logo */}
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h1 style={styles.logoTitle}>Web Cuti</h1>
            <p style={styles.logoSub}>Manajemen Cuti Karyawan</p>
          </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <h2 style={styles.formTitle}>Masuk ke Akun</h2>
          <p style={styles.formSub}>Masukkan email/username dan password Anda</p>

          {/* Error */}
          {error && (
            <div style={styles.errorBox} role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Email / Username */}
          <div className="form-group">
            <label htmlFor="email" className="form-label required">
              Email atau Username
            </label>
            <input
              id="email"
              type="text"
              className="form-input"
              placeholder="nama@perusahaan.com atau username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password" className="form-label required">
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
                style={{ paddingRight: "48px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={isLoading || !email || !password}
            style={{ marginTop: "var(--space-2)" }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Memproses...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Masuk
              </>
            )}
          </button>
        </form>

          <p style={styles.footer}>
            Hubungi administrator jika lupa password
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--space-4)",
    backgroundColor: "var(--color-bg)",
    position: "relative",
    overflow: "hidden",
  },
  bgDecor1: {
    position: "absolute",
    top: "-150px",
    right: "-150px",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, rgba(124, 58, 237, 0) 70%)",
    filter: "blur(60px)",
  },
  bgDecor2: {
    position: "absolute",
    bottom: "-100px",
    left: "-100px",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0) 70%)",
    filter: "blur(60px)",
  },
  logoArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "var(--space-8)",
  },
  logoIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "var(--space-4)",
  },
  logoTitle: {
    fontFamily: "var(--font-heading)",
    fontSize: "var(--text-2xl)",
    fontWeight: 700,
    color: "var(--color-text)",
  },
  logoSub: {
    fontSize: "var(--text-sm)",
    color: "var(--color-text-muted)",
    marginTop: "4px",
  },
  formTitle: {
    fontFamily: "var(--font-heading)",
    fontSize: "var(--text-xl)",
    fontWeight: 600,
    color: "var(--color-text)",
    marginBottom: "4px",
  },
  formSub: {
    fontSize: "var(--text-sm)",
    color: "var(--color-text-muted)",
    marginBottom: "var(--space-6)",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "var(--radius-md)",
    background: "var(--color-danger-light)",
    color: "var(--color-danger)",
    fontSize: "var(--text-sm)",
    marginBottom: "var(--space-4)",
    border: "1px solid rgba(220,38,38,0.2)",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-muted)",
    padding: "4px",
    display: "flex",
    alignItems: "center",
  },
  footer: {
    textAlign: "center",
    fontSize: "var(--text-xs)",
    color: "var(--color-text-muted)",
    marginTop: "var(--space-6)",
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
