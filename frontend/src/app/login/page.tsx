"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const [loading, setLoading] = useState(false);
  const navigate = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (ready && user) navigate.push("/dashboard");
  }, [ready, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error || "Login failed");
    }
  };


  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">C</div>
          <div>
            <div className="font-semibold">Nexus ERP</div>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Internal Business Operating System</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-md">
            Inventory · Human Resources · Finance · Sales · Operations. Manage everything from one
            secure desktop-grade workspace.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {["Inventory", "HR", "Finance"].map((m) => (
              <div key={m} className="bg-sidebar-accent rounded-xl p-3 text-center text-sm">{m}</div>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nexus ERP</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-primary">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wide">Secure Sign-in</span>
          </div>
          <h2 className="text-2xl font-semibold">{forgot ? "Reset password" : "Sign in"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {forgot ? "Local-only reset for demo purposes." : "Use your work account to continue."}
          </p>

          <div className="mt-5 space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground text-xs">Username or Email</span>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-md pl-9 pr-3 h-10 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </label>

            {!forgot && (
              <label className="block text-sm">
                <span className="text-muted-foreground text-xs">Password</span>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/40 border border-border rounded-md pl-9 pr-3 h-10 outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </label>
            )}

            {!forgot && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember me
                </label>
                <button type="button" className="text-primary hover:underline" onClick={() => setForgot(true)}>
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {err && (
            <div className="mt-4 p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm">
              {err}
            </div>
          )}

          {forgot ? (
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => { alert("Local reset: password is admin123 for the seeded admin."); setForgot(false); }}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                Reset password
              </button>
              <button type="button" onClick={() => setForgot(false)} className="w-full h-10 rounded-md border border-border text-sm">
                Back to sign in
              </button>
            </div>
          ) : (
            <button type="submit" className="mt-5 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
               {loading ? "Signing in..." : "Sign in"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

