import { AppLauncher } from "./_components/app-launcher";

// /dashboard is the app launcher. Sign-in and access are already checked by the dashboard layout,
// so this page runs no queries of its own.
export default function DashboardPage() {
  return <AppLauncher />;
}
