import { z } from 'zod';

export const tripGroupMemberSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z
    .string()
    .optional()
    .transform((value) => (value !== undefined ? value.trim() : value)),
  lastName: z
    .string()
    .optional()
    .transform((value) => (value !== undefined ? value.trim() : value))
}).superRefine((data, ctx) => {
  // Member can be an existing person reference (id), or a new person payload.
  // Per spec: last name is optional, first name is required when creating a person.
  if (data.id) {
    return;
  }
  const first = data.firstName?.trim() ?? '';
  if (!first) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'First name is required',
      path: ['firstName']
    });
  }
});

export const tripGroupNameSchema = z
  .string()
  .trim()
  .min(1, 'Group name is required')
  .max(16, 'Group name must be 16 characters or fewer');

export const tripGroupCreateSchema = z.object({
  name: tripGroupNameSchema,
  members: z.array(tripGroupMemberSchema).max(100).default([])
});

export const tripGroupUpdateSchema = z.object({
  name: tripGroupNameSchema.optional(),
  members: z.array(tripGroupMemberSchema).max(100).optional()
}).refine((data) => data.name !== undefined || data.members !== undefined, {
  message: 'No fields provided for update'
});



