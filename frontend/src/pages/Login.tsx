import { useState } from 'react';
import { api } from '../api/client';
import { useAuth, type AuthUser } from '../store/auth';

type AuthResult = { user: AuthUser; accessToken: string; refreshToken: string };

export function LoginPage() {
  const setAuth = useAuth((s) => s.setAuth);
  const [mode, setMode] = useState<'password' | 'pin'>('password');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const data =
        mode === 'password'
          ? await api.post<AuthResult>('/auth/login', { username, password }, false)
          : await api.post<AuthResult>('/auth/pin', { pin }, false);
      setAuth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const pressPin = (d: string) => {
    if (d === 'del') return setPin((p) => p.slice(0, -1));
    if (d === 'clr') return setPin('');
    setPin((p) => (p.length < 6 ? p + d : p));
  };

  return (
    <div className="h-full grid place-items-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-4">
      <div className="w-full max-w-sm card p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 grid place-items-center text-white font-extrabold text-2xl mb-3">
            Z
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">ZarPOS</h1>
          <p className="text-sm text-slate-500">Restoran boshqaruv tizimi</p>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-1 mb-5 text-sm font-semibold">
          <button
            className={`flex-1 py-1.5 rounded-md ${mode === 'password' ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}
            onClick={() => setMode('password')}
          >
            Login/Parol
          </button>
          <button
            className={`flex-1 py-1.5 rounded-md ${mode === 'pin' ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}
            onClick={() => setMode('pin')}
          >
            PIN kod
          </button>
        </div>

        {mode === 'password' ? (
          <div className="space-y-3">
            <div>
              <label className="label">Login</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="label">Parol</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center text-3xl tracking-[0.5em] font-mono h-12 mb-3">
              {pin.replace(/./g, '•') || <span className="text-slate-300">····</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map((d) => (
                <button
                  key={d}
                  onClick={() => pressPin(d)}
                  className="btn-ghost h-14 text-lg font-bold"
                >
                  {d === 'del' ? '⌫' : d === 'clr' ? 'C' : d}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <button className="btn-primary w-full mt-5 py-3" onClick={submit} disabled={loading}>
          {loading ? 'Kirilmoqda...' : 'Kirish'}
        </button>

        <div className="mt-5 text-[11px] text-slate-400 text-center leading-relaxed">
          Demo: <b>admin / admin123</b> · Kassir PIN <b>1111</b> · Ofitsiant PIN <b>1234</b>
        </div>
      </div>
    </div>
  );
}
