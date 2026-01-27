import { z } from 'zod';

export const personNameSchema = z.object({
  firstName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: 'First name is required' })
    .refine((value) => value.length <= 40, { message: 'First name must be 40 characters or fewer' }),
  lastName: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = (value ?? '').trim();
      return trimmed.length ? trimmed : null;
    })
});

export const personCreateSchema = personNameSchema;

export const personUpdateSchema = z
  .object({
    firstName: z
      .string()
      .optional()
      .transform((value) => (value !== undefined ? value.trim() : value))
      .refine((value) => value === undefined || value.length > 0, { message: 'First name is required' })
      .refine((value) => value === undefined || value.length <= 40, {
        message: 'First name must be 40 characters or fewer'
      }),
    lastName: z
      .string()
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
      })
  })
  .refine((data) => data.firstName !== undefined || data.lastName !== undefined, {
    message: 'No fields provided for update'
  });

