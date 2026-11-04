import { test } from 'node:test'
import assert from 'node:assert/strict'
import { grantedTrialRows } from '../src/lib/websiteTrialRows.ts'

const order = { id: 'order-1', full_name: 'Test buyer', email: 'test@example.com', phone: '0500000000', status: 'paid' }
const trial = { id: 'trial-1', order_id: order.id, redeemed_at: '2026-11-04T11:32:08Z', expires_at: '2026-12-04T11:32:08Z', access_granted_at: '2026-11-04T12:00:00Z', access_removed_at: null, notified_at: '2026-11-04T11:32:09Z', tradingview_username: 'Trader' }
test('only granted redemptions join the shared rows and preserve canonical dates and source', () => {
  const rows = grantedTrialRows([order], [trial, { ...trial, id: 'pending', access_granted_at: null }, { ...trial, id: 'unused', redeemed_at: null }, { ...trial, id: 'unmatched', order_id: 'other' }])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].source, 'מימוש קופון קורס דיגיטלי')
  assert.equal(rows[0].trial_week_expiry, trial.expires_at)
  assert.equal(rows[0].created_at, trial.redeemed_at)
  assert.equal(rows[0].handled, false)
  assert.equal(rows[0].id, 'website-trial:trial-1')
  assert.match(rows[0].note, /Trader/)
})
test('removed access remains visible as history, with resolved attention', () => {
  const rows = grantedTrialRows([{ ...order, status: 'refunded' }], [{ ...trial, access_removed_at: '2026-12-04T12:00:00Z' }])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].handled, true)
  assert.match(rows[0].note, /גישה הוסרה/)
  assert.match(rows[0].note, /זוכתה/)
  assert.equal(trial.access_removed_at, null)
})
