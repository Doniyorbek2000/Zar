# ZarPOS — Restoran va Kafe Avtomatlashtirish Tizimi

> iiko, Clopos, Poster, Jowi kabi professional restoran-menejment platformalari uslubida qurilgan zamonaviy, ochiq kodli POS tizimi.

ZarPOS — restoranlar, kafelar va tez ovqatlanish shoxobchalari uchun to'liq
avtomatlashtirish yechimi: menyu boshqaruvi, texnologik kartalar, ofitsiant/kassir
terminali (POS), stollar va zallar, ombor va inventarizatsiya, kassa smenalari
hamda real vaqtli hisobotlar.

## ✨ Asosiy imkoniyatlar

| Modul | Tavsif |
|-------|--------|
| 🔐 **Auth & RBAC** | JWT autentifikatsiya, rollar (Admin, Menejer, Kassir, Ofitsiant, Oshpaz), PIN-kod bilan tez kirish |
| 🍽 **Menyu** | Kategoriyalar, taomlar, narxlar, modifikatorlar (guruhlar bilan), stop-list |
| 📋 **Texkartalar** | Texnologik kartalar (retseptlar): har bir taom uchun ingredientlar va sarf normasi, avtomatik tannarx |
| 🧾 **POS / Buyurtma** | Stol ochish, taom qo'shish, modifikatorlar, chegirmalar, hisob bo'lish, chek |
| 🪑 **Zallar & Stollar** | Zallar, stollar joylashuvi, band/bo'sh holat, stolni ko'chirish/birlashtirish |
| 📦 **Ombor** | Ingredientlar, yetkazib beruvchilar, kirim (prixod), chiqim, spisaniye (write-off), inventarizatsiya, qoldiqlar |
| 💵 **Kassa & Smena** | Smena ochish/yopish, naqd/karta to'lovlar, kassa harakati, X/Z hisobot |
| 📊 **Hisobotlar** | Sotuvlar dinamikasi, foyda, ABC-analiz, ofitsiantlar reytingi, tannarx/margin |
| 👥 **Mijozlar** | Mijozlar bazasi, chegirma kartalari, bonus dasturi (loyihalangan) |
| 🏢 **Multi-branch** | Bir necha shoxobcha (filial) qo'llab-quvvatlanadi |

## 🏗 Texnologiyalar

**Backend**
- Node.js + TypeScript
- Express (modulli, qatlamli arxitektura)
- Prisma ORM + PostgreSQL
- JWT (access/refresh), bcrypt
- Zod (validatsiya)
- Pino (structured logging)

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS
- TanStack Query (server state)
- Zustand (client state)
- React Router
- Responsive: planshet POS + desktop admin panel

**Infratuzilma**
- Docker Compose (PostgreSQL)
- Prisma migrations + seed

## 📂 Struktura

```
zarpos/
├── backend/            # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma   # Domen modeli (30+ jadval)
│   │   └── seed.ts         # Demo ma'lumotlar
│   └── src/
│       ├── config/         # Env, konfiguratsiya
│       ├── lib/            # Prisma client, logger, errors
│       ├── middleware/     # Auth, RBAC, error handler
│       ├── modules/        # Biznes modullar (auth, menu, orders, ...)
│       └── server.ts
├── frontend/           # React + Vite SPA
│   └── src/
│       ├── api/            # API klient
│       ├── components/     # UI komponentlar
│       ├── pages/          # POS, Admin, Login, Reports ...
│       └── store/          # Zustand store
├── docker-compose.yml  # PostgreSQL
└── package.json        # npm workspaces
```

## 🚀 Ishga tushirish

### 1. Talablar
- Node.js 20+
- Docker (PostgreSQL uchun) yoki mavjud PostgreSQL

### 2. Bog'liqliklarni o'rnatish
```bash
npm install
```

### 3. Ma'lumotlar bazasi (Docker)
```bash
docker compose up -d        # PostgreSQL 5432-portda
```

### 4. Backend sozlash
```bash
cd backend
cp .env.example .env        # kerak bo'lsa qiymatlarni o'zgartiring
npm run prisma:generate
npm run prisma:migrate      # jadvallarni yaratadi
npm run seed                # demo ma'lumot: menyu, xodimlar, stollar
npm run dev                 # API: http://localhost:4000
```

### 5. Frontend
```bash
cd frontend
npm run dev                 # UI: http://localhost:5173
```

### Demo kirish
| Rol | Login | Parol |
|-----|-------|-------|
| Admin | `admin` | `admin123` |
| Kassir | `kassir` | `kassir123` |
| Ofitsiant | `ofitsiant` (PIN: `1234`) | `ofitsiant123` |

## 📜 Litsenziya
MIT
