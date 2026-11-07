import { Router } from 'express'
import { z } from 'zod'
import { requireAdmin } from '../auth'
import { parse } from '../http'
import { exportCsv, getStats } from '../services/stats'

export const statsRoutes = Router()

const rangeSchema = z.enum(['today', '7d', '30d']).default('today')

// Business numbers are for admins. Baristas run the counter.
statsRoutes.get('/dashboard/stats', requireAdmin, (req, res) => {
  const { range } = parse(z.object({ range: rangeSchema }), req.query)
  res.set('Cache-Control', 'no-store')
  res.json(getStats(range))
})

statsRoutes.get('/dashboard/stats/export', requireAdmin, (req, res) => {
  const { range, kind } = parse(z.object({ range: rangeSchema, kind: z.enum(['orders', 'items', 'summary']).default('summary') }), req.query)
  const { filename, csv } = exportCsv(range, kind)
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  })
  res.send(csv)
})
