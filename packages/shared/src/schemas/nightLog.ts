import { z } from "zod"

export const nightLogSchema = z.object({
  nightLabel: z.string().min(1),
  content: z.string(),
})

export const nightLogsSchema = z.array(nightLogSchema)

export type NightLog = z.infer<typeof nightLogSchema>
