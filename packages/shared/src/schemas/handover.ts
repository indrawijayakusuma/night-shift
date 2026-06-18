import { z } from "zod"

import { structuredEventSchema } from "./events.js"
import { hotelSchema } from "./hotel.js"
import { handoverIssueSchema } from "./issue.js"
import { nightLogSchema } from "./nightLog.js"

export const handoverSummaryItemSchema = z.object({
  title: z.string().min(1),
  action: z.string(),
  sourceIds: z.array(z.string().min(1)).min(1),
  flags: z.array(z.string()).default([]),
})

/** @deprecated Use handoverSummaryItemSchema — kept for existing imports */
export const summaryItemSchema = handoverSummaryItemSchema

export const handoverSummarySchema = z.object({
  urgent: z.array(handoverSummaryItemSchema),
  pending: z.array(handoverSummaryItemSchema),
  fyi: z.array(handoverSummaryItemSchema),
})

export const handoverMetaSchema = z.object({
  eventCount: z.number().int().nonnegative(),
  nightLogCount: z.number().int().nonnegative(),
  reconciliationNotes: z.array(z.string()),
})

export const handoverRequestSchema = z.object({
  hotel: hotelSchema,
  events: z.array(structuredEventSchema),
  nightLogs: z.array(nightLogSchema),
  targetMorning: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "targetMorning must be an ISO date (YYYY-MM-DD)",
  }),
})

export const draftHandoverSchema = z.object({
  summary: handoverSummarySchema,
  issues: z.array(handoverIssueSchema),
})

export const handoverResponseSchema = z.object({
  hotel: hotelSchema,
  targetMorning: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime({ offset: true }),
  summary: handoverSummarySchema,
  issues: z.array(handoverIssueSchema),
  meta: handoverMetaSchema,
})

export type HandoverSummaryItem = z.infer<typeof handoverSummaryItemSchema>
export type SummaryItem = HandoverSummaryItem
export type HandoverSummary = z.infer<typeof handoverSummarySchema>
export type HandoverMeta = z.infer<typeof handoverMetaSchema>
export type HandoverRequest = z.infer<typeof handoverRequestSchema>
export type DraftHandover = z.infer<typeof draftHandoverSchema>
export type HandoverResponse = z.infer<typeof handoverResponseSchema>
