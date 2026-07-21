import { z } from 'zod'

const userStatusSchema = z.union([
  z.literal('active'),
  z.literal('inactive'),
])
export type UserStatus = z.infer<typeof userStatusSchema>

export type UserRole = 'admin' | 'custom'

const userPermissionSchema = z.object({
  dashboardIds: z.array(z.number()).default([]),
  pageNames: z.array(z.string()).default([]),
})
export type UserPermission = z.infer<typeof userPermissionSchema>

const _userSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  status: userStatusSchema,
  role: z.enum(['admin', 'custom']),
  permissions: userPermissionSchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type User = z.infer<typeof _userSchema>
