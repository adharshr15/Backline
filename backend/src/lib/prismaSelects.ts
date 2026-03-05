// src/lib/prismaSelects.ts
export const userSafeSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  isPromoter: true
};