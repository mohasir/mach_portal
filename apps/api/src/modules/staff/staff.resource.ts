import { staff } from '../../db/schema';

export const publicStaffColumns = {
  id: staff.id,
  name: staff.name,
  phone: staff.phone,
  email: staff.email,
  isActive: staff.isActive,
  createdAt: staff.createdAt,
} as const;

export type PublicStaff = Pick<typeof staff.$inferSelect, keyof typeof publicStaffColumns>;

export const staffResource = (row: PublicStaff) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  isActive: row.isActive,
  createdAt: row.createdAt,
});

export const staffCollectionResource = (rows: PublicStaff[]) => rows.map(staffResource);

export type StaffResource = ReturnType<typeof staffResource>;
