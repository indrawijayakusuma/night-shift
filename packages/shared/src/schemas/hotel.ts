import { z } from "zod"

export const hotelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
})

export type Hotel = z.infer<typeof hotelSchema>
