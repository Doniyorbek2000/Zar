import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { canManage, useAuth } from '../store/auth';
import { roleName } from '../lib/format';
import { useRealtime } from '../realtime/useRealtime';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  managerOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'POS Terminal', icon: '🧾' },
  { to: '/kitchen', label: 'Oshxona (KDS)', icon: '👨‍🍳' },
  { to: '/delivery', label: 'Dostavka', icon: '🛵' },
  { to: '/dashboard', label: 'Boshqaruv paneli', icon: '📊', managerOnly: true },
  { to: '/menu', label: 'Menyu', icon: '🍽', managerOnly: true },
  { to: '/inventory', label: 'Ombor', icon: '📦', managerOnly: true },
  { to: '/customers', label: 'Mijozlar & Bonus', icon: '💳', managerOnly: true },
  { to: '/reports', label: 'Hisobotlar', icon: '📈', managerOnly: true },
  { to: '/qr-codes', label: 'QR menyu', icon: '📱', managerOnly: true },
  { to: '/settings', label: 'Sozlamalar', icon: '⚙️', managerOnly: true },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const manage = canManage(user?.role);
  const { connected } = useRealtime();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.managerOnly || manage);

  const SidebarContent = (
    <>
      <div className="px-5 py-5 flex items-center gap-2 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-brand-600 grid place-items-center text-white font-extrabold text-lg">
          Z
        </div>
        <div>
          <div className="text-white font-bold leading-tight">ZarPOS</div>
          <div className="text-[11px] text-slate-500">Restoran tizimi</div>
        </div>
      </div>

      <div className="px-5 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2 text-[11px] font-medium">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className={connected ? 'text-green-400' : 'text-slate-500'}>
            {connected ? 'Jonli ulanish faol' : 'Ulanmoqda...'}
          </span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          🚪 Chiqish
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 bg-slate-900 flex-col">{SidebarContent}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 flex flex-col shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 text-white">
          <button onClick={() => setOpen(true)} className="text-2xl leading-none">
            ☰
          </button>
          <div className="w-7 h-7 rounded-md bg-brand-600 grid place-items-center font-extrabold text-sm">Z</div>
          <span className="font-bold">ZarPOS</span>
          <span className={`ml-auto w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-600'}`} />
        </div>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
