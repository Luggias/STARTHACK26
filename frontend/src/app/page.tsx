"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { authRegister, authLogin } from "@/lib/api";
import IntroScenes from "@/components/intro-scenes";
import OnboardingDialog from "@/components/onboarding-dialog";

type Mode = "auth" | "intro" | "onboarding";
type Tab = "register" | "login";

export default function HomePage() {
  const router = useRouter();
  const setUser = useGameStore((s) => s.setUser);
  const setToken = useGameStore((s) => s.setToken);

  const [mode, setMode] = useState<Mode>("auth");
  const [tab, setTab] = useState<Tab>("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Register fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [username, setUsername] = useState("");

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in name, email and password");
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
      setMode("intro");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Please enter email and password");
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
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (tab === "register") handleRegister();
    else handleLogin();
  }

  if (mode === "intro") {
    return <IntroScenes onComplete={() => setMode("onboarding")} />;
  }
  if (mode === "onboarding") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <OnboardingDialog username={username || email.split("@")[0]} onComplete={() => router.push("/home")} />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00d4ff]/8 blur-3xl" />
        <div className="absolute left-1/2 top-2/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7c3aed]/8 blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
      >
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight">
            Cache{" "}
            <span className="bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] bg-clip-text text-transparent">
              Me If You Can
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Learn investing by competing. No real money — just real knowledge.
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#0f0f1a] p-8 shadow-2xl">
          {/* Tab toggle */}
          <div className="mb-6 flex rounded-xl bg-slate-900/60 p-1">
            {(["register", "login"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className="relative flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors"
                style={{ color: tab === t ? "#fff" : "#475569" }}
              >
                {tab === t && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#00d4ff]/20 to-[#7c3aed]/20 border border-[#00d4ff]/20"
                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
                  />
                )}
                <span className="relative">{t === "register" ? "New Player" : "Login"}</span>
              </button>
            ))}
          </div>

          {tab === "register" ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full name *"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(""); }}
                className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
              />
              <input
                type="email"
                placeholder="Email *"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
              />
              <input
                type="password"
                placeholder="Password *"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 transition-all"
                  min={10} max={120}
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 transition-all"
                />
              </div>
              <input
                type="text"
                placeholder="Username (optional)"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 20))}
                className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 transition-all"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); setError(""); }}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
              />
            </div>
          )}

          {error && (
            <motion.p
              className="mt-3 text-center text-xs text-red-400"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}

          <motion.button
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#00d4ff]/80 to-[#7c3aed]/80 py-3.5 font-bold shadow-lg disabled:opacity-50 text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Loading..." : tab === "register" ? "Create Account →" : "Enter Game →"}
          </motion.button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-700">
          START Hack 2026 · Cache Me If You Can
        </p>
      </motion.div>
    </main>
  );
}
