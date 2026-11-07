import { Router } from 'express'
import { z } from 'zod'
import { moodLimiter, parse } from '../http'
import { moodPicks } from '../services/mood'

export const moodRoutes = Router()

const moodSchema = z.object({
  text: z.string().trim().min(2, 'Tell us a little more.').max(300, 'Keep it to 300 characters or fewer.'),
})

// Open to guests. Three drinks for a line of free text; never reveals whether a model was used.
moodRoutes.post('/mood', moodLimiter, async (req, res) => {
  const { text } = parse(moodSchema, req.body)
  res.set('Cache-Control', 'no-store')
  res.json(await moodPicks(text))
})
