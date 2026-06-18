import { z } from "zod"

import { normalizedEventSchema } from "./normalized.js"

export const issueCategorySchema = z.enum([
  "still_open",
  "newly_resolved",
  "new_tonight",
])

export const issuePrioritySchema = z.enum([
  "urgent",
  "pending",
  "fyi",
])

export const issueFlagSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  sourceIds: z.array(z.string()).optional(),
})

export const handoverIssueSchema = z.object({
  category: issueCategorySchema,
  priority: issuePrioritySchema,
  title: z.string().min(1),
  action: z.string(),
  sourceIds: z.array(z.string().min(1)).min(1),
  flags: z.array(z.string()).default([]),
})

export const issueThreadSchema = z.object({
  threadKey: z.string().min(1),
  room: z.string().nullable(),
  issueKind: z.string().min(1),
  category: issueCategorySchema,
  priority: issuePrioritySchema,
  title: z.string().min(1),
  action: z.string(),
  sourceIds: z.array(z.string().min(1)).min(1),
  flags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  events: z.array(normalizedEventSchema),
})

export type IssueCategory = z.infer<typeof issueCategorySchema>
export type IssuePriority = z.infer<typeof issuePrioritySchema>
export type IssueFlag = z.infer<typeof issueFlagSchema>
export type HandoverIssue = z.infer<typeof handoverIssueSchema>
export type IssueThread = z.infer<typeof issueThreadSchema>
