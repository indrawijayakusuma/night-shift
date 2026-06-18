import { Router } from 'express'
import { handoverRequestSchema } from '@night-shift/shared'
import { createHandover, healthCheck } from '../controllers/handover.controller.js'
import { asyncHandler } from '../middleware/requestContext.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

router.get('/health', healthCheck)
router.post('/handover', validateBody(handoverRequestSchema), asyncHandler(createHandover))

export default router
