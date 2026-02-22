import { z } from 'zod';

export const tripLinkSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().url()
});

export const tripTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .transform((value) => value.toLowerCase());

export const tripCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    startDate: z.coerce.date({ errorMap: () => ({ message: 'startDate must be a valid date' }) }),
    endDate: z.coerce.date({ errorMap: () => ({ message: 'endDate must be a valid date' }) }),
    links: z.array(tripLinkSchema).max(20).optional().default([]),
    tripTypes: z.array(tripTypeSchema).max(10).optional().default([]),
    // Legacy single-group field (backwards compatible)
    tripGroupId: z.string().uuid().optional().nullable(),
    // New companions model (Option A): store selected group ids + person ids.
    companionGroupIds: z.array(z.string().uuid()).max(50).optional().default([]),
    companionPersonIds: z.array(z.string().uuid()).max(200).optional().default([])
  })
  .transform((data) => ({
    ...data,
    startDate: data.startDate,
    endDate: data.endDate
  }));

export const tripUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    startDate: z
      .coerce.date({ errorMap: () => ({ message: 'startDate must be a valid date' }) })
      .optional(),
    endDate: z.coerce.date({ errorMap: () => ({ message: 'endDate must be a valid date' }) }).optional(),
    reflection: z.string().max(7000).optional(),
    links: z.array(tripLinkSchema).max(20).optional(),
    tripTypes: z.array(tripTypeSchema).max(10).optional(),
    tripGroupId: z.string().uuid().nullable().optional(),
    companionGroupIds: z.array(z.string().uuid()).max(50).optional(),
    companionPersonIds: z.array(z.string().uuid()).max(200).optional(),
    isTripContentLocked: z.boolean().optional(),
    isReflectionLocked: z.boolean().optional()
  })
  .refine(
    (data) =>
      data.startDate ||
      data.endDate ||
      data.name ||
      data.reflection ||
      data.links ||
      data.tripTypes ||
      data.tripGroupId !== undefined ||
      data.companionGroupIds !== undefined ||
      data.companionPersonIds !== undefined ||
      data.isTripContentLocked !== undefined ||
      data.isReflectionLocked !== undefined,
    { message: 'No fields provided for update' }
  );

export const tripDayUpdateSchema = z.object({
  highlight: z.string().max(240).nullable().optional(),
  journalEntry: z.string().max(7000).nullable().optional(),
  paragraphs: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        text: z.string().max(7000),
        isStory: z.boolean().optional().default(false)
      })
    )
    .max(300)
    .optional(),
  isFavorite: z.boolean().optional(),
  hashtags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(50)
        .transform((tag) => tag.replace(/^#/, '').toLowerCase())
    )
    .max(30)
    .optional(),
  locationsToAdd: z
    .array(
      z.object({
        displayName: z.string().min(1).max(180),
        city: z.string().nullable().optional(),
        region: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        lat: z.number().refine((value) => Math.abs(value) <= 90),
        lng: z.number().refine((value) => Math.abs(value) <= 180)
      })
    )
    .optional(),
  locationIdsToRemove: z.array(z.string().uuid()).optional(),
  isLocked: z.boolean().optional()
});

export const photoCreateSchema = z.object({
  tripId: z.string().uuid(),
  tripDayId: z.string().uuid(),
  tripLocationId: z.string().uuid().optional(),
  thumbnailUrl: z.string().url(),
  fullUrl: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

