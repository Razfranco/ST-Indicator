import { MNQ_DOLLAR_PER_POINT } from './constants'

export function calculatePnlFromPoints(
  points: number | null,
  positionSize: number | null,
): number | null {
  if (points == null || positionSize == null) return null
  return Math.round(points * MNQ_DOLLAR_PER_POINT * positionSize * 100) / 100
}
