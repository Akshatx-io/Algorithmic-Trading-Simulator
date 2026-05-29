import { useLocation, NavLink, Outlet } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  // ProtectedRoute already guards this layout — no need for a second redirect
  // here. We just expose `logout` to the topbar button (audit 3.11).
  const { logout, user } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/portfolio":   return "Portfolio";
      case "/performance": return "Performance";
      case "/trade":       return "Trade";
      default:             return "Dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col lg:flex-row">

      {/* Sidebar */}
      <div className="w-full lg:w-64 lg:min-w-64 bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-800 p-4 lg:p-6">
        <h1 className="text-xl font-bold mb-8 tracking-wide text-blue-400">
            AI Trading Terminal
        </h1>

         <nav className="space-y-2 lg:space-y-3">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600/80 text-white shadow-md"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/portfolio"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600/80 text-white shadow-md"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              Portfolio
            </NavLink>

            <NavLink
              to="/performance"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600/80 text-white shadow-md"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              Performance
            </NavLink>

            <NavLink
              to="/trade"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600/80 text-white shadow-md"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              Trade
            </NavLink>
        </nav>

      </div>

            {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar with live ticker */}
        <Topbar />

        <div className="p-4 lg:p-8 overflow-x-hidden">

            <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-semibold">
                {getPageTitle()}
            </h2>

            <div className="flex items-center gap-3">
              {user?.username && (
                <span className="text-sm text-gray-400 hidden md:inline">
                  {user.username}
                </span>
              )}
              <button
                onClick={() => logout()}
                className="px-3 py-1.5 text-sm bg-gray-700 rounded transition-all duration-200 hover:bg-blue-500"
              >
                Logout
              </button>
            </div>
            </div>

            <Outlet />

        </div>

        </div>
    </div>
  );
}