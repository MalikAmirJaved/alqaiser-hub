import { createContext, useContext, useEffect, useState } from "react";
import { ls } from "../services/localStorageService";
import { initializeSystem } from "../seed/initializeSystem";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeSystem();
    const session = ls.get("session");
    if (session) setUser(session);
    setReady(true);
  }, []);

  const login = (email, password, remember) => {
    const users = ls.get("users", []);
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return { ok: false, error: "Invalid credentials" };
    const session = { id: found.id, name: found.name, email: found.email, role: found.role };
    setUser(session);
    if (remember) ls.set("session", session);
    else sessionStorage.setItem("clickmasters_session", JSON.stringify(session));
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    ls.remove("session");
    sessionStorage.removeItem("clickmasters_session");
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
