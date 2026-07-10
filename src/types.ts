export type CategoryType = 'Starter' | 'Appetizer' | 'Main' | 'Drink' | 'Dessert';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: CategoryType;
  price: number;
  isSpecial: boolean;
  status: 'active' | 'inactive';
}

export type ActivityType = 'reservation' | 'inquiry' | 'change' | 'takeout' | 'general';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  time: string;
  duration: string;
  status: 'SUCCESS' | 'HANDLED';
}

export interface CallTrend {
  day: string;
  val: number;
  count: number;
}

export interface DashboardAnalytics {
  totalCallsHandled: number;
  successfulCalls: number;
  successRate: number;
  activeOffers: number;
  inactiveSpecials: number;
  scriptCount: number;
  reservationCount: number;
  pendingReservations: number;
  openOrders: number;
  orderRevenue: number;
  averageDurationSeconds: number;
  volumeTrend7d: CallTrend[];
  volumeTrend30d: CallTrend[];
}

export type ScriptCategory = 'STANDARD' | 'DYNAMIC' | 'CAMPAIGN' | 'INTERNAL';

export interface Script {
  id: string;
  title: string;
  description: string;
  category: ScriptCategory;
  text: string;
  avatarText: string;
  lastUpdated: string;
  stats: {
    successRate: string;
    avgDuration: string;
    intentAccuracy: string;
  };
}

export interface WorkspaceSettings {
  brandName: string;
  activeVoice: string;
  phoneRouting: string;
  autoUpsellPercent: number;
  autoConfirmSms: boolean;
  serviceHours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
}

export type UserRole = 'admin' | 'manager' | 'staff';

export interface AccessUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'cancelled';
export type ReservationSource = 'ai-call' | 'web' | 'staff';

export interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  notes: string;
  status: ReservationStatus;
  source: ReservationSource;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type OrderType = 'dine-in' | 'takeout' | 'delivery';

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  type: OrderType;
  placedAt: string;
  notes: string;
}
