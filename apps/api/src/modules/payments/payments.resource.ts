import type { PaymentMethod } from '@repo/schemas';

export type PaymentListRow = {
  id: string;
  eventId: string;
  eventDate: string | null;
  clientName: string;
  eventTypeName: string | null;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  reference: string | null;
  createdByName: string | null;
};

export const paymentListItemResource = (row: PaymentListRow) => ({ ...row });
export const paymentCollectionResource = (rows: PaymentListRow[]) => rows.map(paymentListItemResource);
export type PaymentListItemResource = ReturnType<typeof paymentListItemResource>;

export type PaymentIncomeRow = {
  period: string;
  totalAmount: number;
  count: number;
};

export const paymentIncomeItemResource = (row: PaymentIncomeRow) => ({ ...row });
export type PaymentIncomeItemResource = ReturnType<typeof paymentIncomeItemResource>;
