export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  price: string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  modifiers: Modifier[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  type: 'DISH' | 'GOODS' | 'PREPARATION';
  price: string;
  unit: string;
  imageUrl?: string | null;
  isActive: boolean;
  inStopList: boolean;
  category?: { id: string; name: string; color: string };
  modifierGroups?: { group: ModifierGroup }[];
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  status: 'NEW' | 'SENT' | 'READY' | 'SERVED' | 'CANCELLED';
  note?: string;
  modifiers: OrderItemModifier[];
}

export interface Order {
  id: string;
  number: number;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  source: 'POS' | 'PHONE' | 'QR' | 'WEB';
  status: 'OPEN' | 'SENT' | 'READY' | 'PAID' | 'CANCELLED';
  tableId?: string;
  guests: number;
  subtotal: string;
  discountPct: string;
  discountAmt: string;
  serviceFeePct: string;
  serviceFeeAmt: string;
  deliveryFee: string;
  total: string;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryStatus?: string | null;
  bonusEarned: string;
  bonusRedeemed: string;
  openedAt: string;
  items: OrderItem[];
  table?: { id: string; name: string };
  waiter?: { id: string; fullName: string };
  customer?: { id: string; fullName: string; phone?: string | null; discountPct: string; bonusBalance: string } | null;
}

export interface Table {
  id: string;
  name: string;
  seats: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED';
  orders: { id: string; number: number; total: string; guests: number; openedAt: string }[];
}

export interface Hall {
  id: string;
  name: string;
  sortOrder: number;
  tables: Table[];
}

export interface StockLevel {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: string;
  minQuantity: string;
  costPerUnit: string;
  value: string;
  lowStock: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: string;
  minQuantity: string;
  isActive: boolean;
}

export interface DashboardStats {
  revenue: string;
  cost: string;
  profit: string;
  marginPct: string;
  ordersCount: number;
  guests: number;
  averageCheck: string;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: string;
  revenue: string;
  profit: string;
}

export interface Shift {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openingCash: string;
  openedAt: string;
  user?: { id: string; fullName: string };
}

export interface Customer {
  id: string;
  fullName: string;
  phone?: string | null;
  cardNumber?: string | null;
  address?: string | null;
  bonusBalance: string;
  discountPct: string;
  note?: string | null;
  createdAt: string;
}

export interface BonusTransaction {
  id: string;
  type: 'EARN' | 'REDEEM' | 'ADJUST';
  amount: string;
  balanceAfter: string;
  note?: string | null;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  bonusTransactions: BonusTransaction[];
  ordersCount: number;
  totalSpent: string;
}

export interface Courier {
  id: string;
  fullName: string;
  phone?: string | null;
}

export interface DeliveryOrder {
  id: string;
  number: number;
  status: string;
  deliveryStatus: 'PENDING' | 'ASSIGNED' | 'ON_WAY' | 'DELIVERED' | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryFee: string;
  total: string;
  openedAt: string;
  source: string;
  items: { id: string; name: string; quantity: string; status: string }[];
  courier?: Courier | null;
  customer?: { id: string; fullName: string; phone?: string | null } | null;
}

export type AppSettings = Record<string, string>;

export interface RecipeItemRow {
  id: string;
  ingredientId: string;
  quantity: string;
  ingredient: Ingredient;
}

export interface ReceiptDto {
  kind: 'PRECHECK' | 'FISCAL';
  title: string;
  currency: string;
  company: { name: string };
  branch: { name: string; address?: string | null; phone?: string | null };
  order: {
    number: number;
    typeLabel: string;
    table?: string | null;
    waiter?: string | null;
    guests: number;
    openedAt: string;
    closedAt?: string | null;
  };
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    modifiers: { name: string; price: number }[];
  }[];
  subtotal: number;
  discountPct: number;
  discountAmt: number;
  serviceFeePct: number;
  serviceFeeAmt: number;
  total: number;
  payments: { methodLabel: string; amount: number }[];
  paid: number;
  change: number;
  cashier?: string | null;
  printedAt: string;
  footer: string;
}
