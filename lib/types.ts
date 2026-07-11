export type UserRole = 'admin' | 'chemist' | 'technician';

export type HazardLevel = 'low' | 'medium' | 'high' | 'toxic';

export type LotStatus = 'active' | 'expired' | 'depleted';

export type MovementType = 'in' | 'out' | 'adjust';

export type SlipStatus = 'draft' | 'confirmed';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface StorageLocation {
  id: string;
  name: string;
  building: string;
  room: string;
  description: string;
  created_at: string;
}

export interface Chemical {
  id: string;
  code: string;
  name: string;
  cas_number: string;
  formula: string;
  unit: string;
  min_stock: number;
  hazard_level: HazardLevel;
  category: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  chemical_id: string;
  lot_number: string;
  quantity: number;
  initial_quantity: number;
  unit: string;
  received_date: string | null;
  expiry_date: string | null;
  storage_location_id: string | null;
  supplier: string;
  status: LotStatus;
  created_at: string;
  updated_at: string;
}

export interface LotWithRelations extends Lot {
  chemicals?: Pick<Chemical, 'id' | 'code' | 'name' | 'unit' | 'min_stock'>;
  storage_locations?: Pick<StorageLocation, 'id' | 'name'> | null;
}

export interface UsageSlip {
  id: string;
  slip_number: string;
  user_id: string;
  user_name: string;
  purpose: string;
  status: SlipStatus;
  created_at: string;
}

export interface UsageSlipItem {
  id: string;
  slip_id: string;
  lot_id: string | null;
  chemical_name: string;
  quantity_used: number;
  unit: string;
  created_at: string;
}

export interface UsageSlipWithItems extends UsageSlip {
  usage_slip_items?: UsageSlipItem[];
}

export interface StockMovement {
  id: string;
  movement_type: MovementType;
  lot_id: string | null;
  chemical_id: string | null;
  quantity: number;
  unit: string;
  reference: string;
  user_id: string;
  user_name: string;
  notes: string;
  created_at: string;
}

export interface StockMovementWithRelations extends StockMovement {
  chemicals?: Pick<Chemical, 'id' | 'code' | 'name'> | null;
  lots?: Pick<Lot, 'id' | 'lot_number'> | null;
}
