import { NavLink, useNavigate } from 'react-router-dom';
import { canManage, useAuth } from '../store/auth';
import { roleName } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  managerOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'POS Terminal', icon: '🧾' },
  { to: '/kitchen', label: 'Oshxona (KDS)', icon: '👨‍🍳' },
  { to: '/dashboard', label: 'Boshqaruv paneli', icon: '📊', managerOnly: true },
  { to: '/menu', label: 'Menyu', icon: '🍽', managerOnly: true },
  { to: '/inventory', label: 'Ombor', icon: '📦', managerOnly: true },
  { to: '/reports', label: 'Hisobotlar', icon: '📈', managerOnly: true },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const manage = canManage(user?.role);

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-300 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-brand-600 grid place-items-center text-white font-extrabold text-lg">
            Z
          </div>
          <div>
            <div className="text-white font-bold leading-tight">ZarPOS</div>
            <div className="text-[11px] text-slate-500">Restoran tizimi</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.filter((n) => !n.managerOnly || manage).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="text-lg">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="px-2 mb-2">
            <div className="text-sm text-white font-semibold">{user?.fullName}</div>
            <div className="text-[11px] text-slate-500">{roleName[user?.role ?? ''] ?? user?.role}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-800 hover:text-white transition"
          >
            🚪 Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
