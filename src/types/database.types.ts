export type Direction = 'Long' | 'Short'
export type TradeResult = 'TP1' | 'TP2' | 'SL' | 'BE'
export type UserRole = 'admin' | 'member'

export type Trade = {
  id: string
  created_at: string
  user_id: string
  entry_datetime: string
  exit_datetime: string | null
  direction: Direction
  entry_price: number | null
  exit_price: number | null
  position_size: number
  points: number | null
  pnl_dollars: number | null
  result: TradeResult
  notes: string | null
}

export type TradeInsert = Omit<Trade, 'id' | 'created_at' | 'user_id'> &
  Partial<Pick<Trade, 'id' | 'created_at' | 'user_id'>>

export type TradeUpdate = Partial<TradeInsert>

export type Profile = {
  id: string
  email: string
  role: UserRole
  approved: boolean
  created_at: string
}

export type ProfileInsert = Omit<Profile, 'created_at'> & Partial<Pick<Profile, 'created_at'>>
export type ProfileUpdate = Partial<Pick<Profile, 'role' | 'approved'>>

export type Database = {
  public: {
    Tables: {
      trades: {
        Row: Trade
        Insert: TradeInsert
        Update: TradeUpdate
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
