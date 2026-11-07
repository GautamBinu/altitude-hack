import { Router } from 'express'
import { getCustomer, requireCustomer } from '../auth'
import { summaryFor } from '../services/loyalty'

/** Things that belong to the signed-in customer. */
export const meRoutes = Router()

meRoutes.get('/me/loyalty', requireCustomer, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(summaryFor(getCustomer(res)!.id))
})
