import { Router } from 'express'
import { getCustomer, requireCustomer } from '../auth'
import { getHome, getUsual } from '../services/home'

export const homeRoutes = Router()

// Everything on the home screen that does not depend on who is looking.
homeRoutes.get('/home', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(getHome())
})

homeRoutes.get('/me/usual', requireCustomer, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(getUsual(getCustomer(res)!.id))
})
