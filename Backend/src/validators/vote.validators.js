import { z } from "zod";

export const castVoteSchema = z.object({
  phase: z.enum(["pre", "post"], { message: "phase must be 'pre' or 'post'" }),
  stance: z.enum(["in_favor", "against"], { message: "stance must be 'in_favor' or 'against'" }),
});
