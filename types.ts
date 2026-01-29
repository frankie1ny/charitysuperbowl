
export interface PaymentTransaction {
  id: string;
  amount: number;
  method: string;
  timestamp: number;
  notes?: string;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  phone: string;
  alias: string;
  paymentHistory?: PaymentTransaction[];
}

export interface Square {
  id: number;
  row: number;
  col: number;
  participantId: string | null;
  alias: string;
  paidAmount: number;
  paymentMethod?: string;
  assigned: boolean;
}

export interface GlobalSettings {
  adminPassword?: string;
  charityName: string;
  zelleAccount?: string;
  paypalAccount?: string;
  venmoAccount?: string;
}

export interface PoolSettings {
  teamA: string;
  teamB: string;
  costPerBox: number;
  rowNumbers: number[];
  colNumbers: number[];
  isLocked: boolean;
}

export type GameSettings = GlobalSettings & PoolSettings;

export interface Pool {
  id: string;
  name: string;
  squares: Square[];
  participants: Participant[];
  settings: PoolSettings;
  createdAt: number;
}

export interface AppState {
  pools: Pool[];
  activePoolId: string;
  globalSettings: GlobalSettings;
}

export type Tab = 'grid' | 'roster' | 'admin';