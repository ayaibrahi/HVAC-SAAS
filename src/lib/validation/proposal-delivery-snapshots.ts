import { z } from "zod";

export const deliverySnapshotStatusSchema = z.enum(["active", "superseded"]);

export const deliverySnapshotLineItemSchema = z
  .object({
    position: z.number().int().min(0),
    serviceName: z.string().trim().min(1).max(200),
    serviceDescription: z.string().nullable(),
    description: z.string().max(1000),
    quantity: z.number().int().min(1).max(100),
    unitPrice: z.number().min(0),
    lineTotal: z.number().min(0),
  })
  .strict();

export const deliverySnapshotLineItemsSchema = z
  .array(deliverySnapshotLineItemSchema)
  .min(1)
  .max(20);

export type DeliverySnapshotLineItemInput = z.infer<
  typeof deliverySnapshotLineItemSchema
>;
