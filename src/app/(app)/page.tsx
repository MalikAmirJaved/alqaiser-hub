import { redirect } from "next/navigation";

/**
 * Root app route: redirect to /dashboard.
 * Using next/navigation redirect (server-side, zero JS sent to client).
 */
export default function AppRootPage() {
  redirect("/dashboard");
}
