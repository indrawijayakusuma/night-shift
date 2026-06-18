import { z } from "zod"

export const eventTypeSchema = z.enum([
  "check_in",
  "check_in_issue",
  "maintenance",
  "compliance",
  "complaint",
  "lost_keycard",
  "deposit_issue",
  "facilities",
  "no_show",
  "walk_in",
  "finance_note",
  "incident",
  "early_checkout_request",
  "damage_report",
  "note",
  "guest_message",
])

export const eventStatusSchema = z.enum([
  "resolved",
  "unresolved",
  "pending",
])

export const structuredEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  type: eventTypeSchema,
  room: z.string().nullable(),
  guest: z.string().nullable(),
  description: z.string(),
  status: eventStatusSchema,
})

export type EventType = z.infer<typeof eventTypeSchema>
export type EventStatus = z.infer<typeof eventStatusSchema>
export type StructuredEvent = z.infer<typeof structuredEventSchema>
