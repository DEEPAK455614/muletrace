export type Channel = 'UPI' | 'IMPS' | 'NEFT' | 'RTGS' | 'ATM';

export interface Customer {
  id: string;
  name: string;
  ageBand: string;
  occupation: string;
  city: string;
  declaredIncome: number; // annual, INR
}

export interface Account {
  id: string;
  customerId: string;
  bank: string;
  ifsc: string;
  type: 'savings' | 'current';
  openedAt: number;
  city: string;
  pin: string;
  deviceId: string;
  phone: string;
  addressId: string;
}

export interface Txn {
  id: string;
  from: string; // account id, or 'EXT' for external inbound seed money
  to: string; // account id, or 'ATM' for cash withdrawal
  amount: number; // INR
  ts: number; // epoch ms
  channel: Channel;
}

export interface Complaint {
  id: string;
  ref: string; // NCRP-style reference
  category: string;
  reportedAt: number;
  amountLost: number;
  victimAccountId: string;
  namedAccountIds: string[];
  city: string;
  state: string;
  summary: string;
}

export type GroundRole =
  | 'mule-pass' | 'mule-layer' | 'mule-struct' | 'mule-dormant' | 'mule-witting'
  | 'collector' | 'herder' | 'roundtrip' | 'offramp';

export interface GroundTruth {
  role: GroundRole;
  ring: string;
  note: string;
}

export interface World {
  generatedAt: number;
  windowStart: number;
  windowEnd: number;
  customers: Customer[];
  accounts: Account[];
  txns: Txn[];
  complaints: Complaint[];
  groundTruth: Record<string, GroundTruth>;
  // Benign look-alikes injected deliberately: accountId -> archetype note.
  // These are KNOWN NEGATIVES - the classic false-positive traps.
  hardNegatives: Record<string, string>;
  scenarioNotes: { ring: string; title: string; description: string; size: number }[];
}
