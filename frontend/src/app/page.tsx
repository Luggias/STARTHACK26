"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { authRegister, authLogin } from "@/lib/api";
import IntroScenes from "@/components/intro-scenes";
import OnboardingDialog from "@/components/onboarding-dialog";

type Screen = "hero" | "register" | "login" | "intro" | "guest-intro" | "onboarding";

export default function LandingPage() {
  const router = useRouter();
  const setUser = useGameStore((s) => s.setUser);
  const setToken = useGameStore((s) => s.setToken);

  const [screen, setScreen] = useState<Screen>("hero");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [username, setUsername] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in name, email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token, user } = await authRegister({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        age: age ? parseInt(age) : undefined,
        country: country.trim() || undefined,
        username: username.trim() || undefined,
      });
      setToken(token);
      setUser(user);
      setScreen("intro");
    } catch {
      setError("Email already in use or registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token, user } = await authLogin(loginEmail.trim(), loginPassword);
      setToken(token);
      setUser(user);
      router.push("/home");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  function handleGuest() {
    setToken("guest");
    setUser({
      id: "guest",
      username: "guest",
      full_name: "Guest Player",
      email: "guest@local",
      invest_iq: 0,
      risk_profile: "unknown",
    });
    setScreen("guest-intro");
  }

  if (screen === "intro") return <IntroScenes onComplete={() => setScreen("onboarding")} />;
  if (screen === "guest-intro") return <IntroScenes onComplete={() => router.push("/home")} />;
  if (screen === "onboarding") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <OnboardingDialog
          username={username || email.split("@")[0]}
          onComplete={() => router.push("/home")}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Radial gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{
            width: "140%",
            height: "60vh",
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,113,227,0.18) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <span className="text-sm font-semibold tracking-tight text-white/80">
          Cache Me If You Can
        </span>
        <button
          onClick={() => { setScreen("login"); setError(""); }}
          className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-white/15"
        >
          Sign in
        </button>
      </nav>

      <AnimatePresence mode="wait">
        {screen === "hero" && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32 text-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#30d158]" />
                <span className="text-xs font-medium text-white/60">START Hack 2026</span>
              </div>

              <h1 className="text-display mb-6 text-white">
                Master<br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(135deg, #2997ff 0%, #bf5af2 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  the market.
                </span>
              </h1>

              <p className="mx-auto mb-10 max-w-lg text-xl text-white/50" style={{ letterSpacing: "-0.01em" }}>
                Build real investment portfolios, test them against history, and
                compete with friends. No real money — just real knowledge.
              </p>

              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setScreen("register"); setError(""); }}
                  className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition-all hover:bg-white/90"
                >
                  Get started free
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGuest}
                  className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-semibold text-white/70 transition-all hover:bg-white/5 hover:text-white"
                >
                  Continue as Guest
                </motion.button>
              </div>
            </motion.div>

            {/* Feature tiles */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="mt-24 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-3xl w-full"
            >
              {[
                { icon: "↗", title: "GBM Simulation", body: "20-year Monte Carlo projections powered by real market parameters." },
                { icon: "⚔", title: "Live Battles", body: "Real-time 1v1 portfolio showdowns. Same scenario, different strategies." },
                { icon: "✦", title: "AI Coach", body: "Discover your investing personality with Claude-powered analysis." },
              ].map((f) => (
                <div key={f.title} className="glass rounded-2xl p-6 text-left">
                  <div className="mb-3 text-2xl text-[#2997ff]">{f.icon}</div>
                  <p className="mb-1.5 text-base font-semibold text-white">{f.title}</p>
                  <p className="text-sm leading-relaxed text-white/40">{f.body}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {(screen === "register" || screen === "login") && (
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4"
          >
            <div className="w-full max-w-sm">
              <h2 className="mb-1 text-center text-2xl font-bold text-white">
                {screen === "register" ? "Create account" : "Welcome back"}
              </h2>
              <p className="mb-8 text-center text-sm text-white/40">
                {screen === "register"
                  ? "Start your investing journey today."
                  : "Sign in to your account."}
              </p>

              <div className="glass-strong rounded-2xl p-8">
                {screen === "register" ? (
                  <div className="space-y-3">
                    <Input placeholder="Full name" value={fullName} onChange={setFullName} />
                    <Input placeholder="Email" type="email" value={email} onChange={setEmail} />
                    <Input placeholder="Password" type="password" value={password} onChange={setPassword} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Age" type="number" value={age} onChange={setAge} />
                      <Input placeholder="Country" value={country} onChange={setCountry} />
                    </div>
                    <Input placeholder="Username (optional)" value={username} onChange={setUsername} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input placeholder="Email" type="email" value={loginEmail} onChange={setLoginEmail} autoFocus />
                    <Input
                      placeholder="Password"
                      type="password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      onEnter={handleLogin}
                    />
                  </div>
                )}

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 text-center text-sm text-[#ff453a]"
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={screen === "register" ? handleRegister : handleLogin}
                  disabled={loading}
                  className="mt-5 w-full rounded-full bg-[#0071e3] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#0077ed] disabled:opacity-40"
                >
                  {loading ? "Loading…" : screen === "register" ? "Create account" : "Sign in"}
                </motion.button>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.08]" />
                  <span className="text-xs text-white/20">or</span>
                  <div className="h-px flex-1 bg-white/[0.08]" />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleGuest}
                  className="mt-3 w-full rounded-full border border-white/10 py-3 text-sm font-medium text-white/40 transition-all hover:border-white/20 hover:text-white/60"
                >
                  Continue as Guest
                </motion.button>

                <p className="mt-4 text-center text-xs text-white/30">
                  {screen === "register" ? (
                    <>Already have an account?{" "}
                      <button onClick={() => { setScreen("login"); setError(""); }} className="text-[#2997ff] hover:underline">Sign in</button>
                    </>
                  ) : (
                    <>No account?{" "}
                      <button onClick={() => { setScreen("register"); setError(""); }} className="text-[#2997ff] hover:underline">Create one</button>
                    </>
                  )}
                </p>
              </div>

              <button
                onClick={() => setScreen("hero")}
                className="mt-5 w-full text-center text-xs text-white/25 hover:text-white/50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  type = "text",
  autoFocus,
  onEnter,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-white/20 focus:bg-white/[0.08]"
    />
  );
}
