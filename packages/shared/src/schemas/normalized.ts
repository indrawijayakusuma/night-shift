import { z } from "zod"

import { eventStatusSchema } from "./events.js"

export const eventSourceSchema = z.enum(["structured", "night_log"])

export const normalizedEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  room: z.string().nullable(),
  type: z.string().min(1),
  description: z.string(),
  status: eventStatusSchema,
  source: eventSourceSchema,
  guest: z.string().nullable().optional(),
  originalExcerpt: z.string().optional(),
  nightLabel: z.string().optional(),
})

export type EventSource = z.infer<typeof eventSourceSchema>
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>
