import type { Direction, TradeResult } from '../types/database.types'

export const DIRECTIONS: Direction[] = ['Long', 'Short']

export const RESULTS: TradeResult[] = ['TP1', 'TP2', 'SL', 'BE']

/** שווי דולרי לנקודה ב-MNQ (Micro E-mini Nasdaq-100), לחוזה אחד */
export const MNQ_DOLLAR_PER_POINT = 2
