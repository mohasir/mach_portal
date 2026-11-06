import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/errors';
import { eventsModuleFromTenant } from './events.module';

// Mounted behind guardTenantSession, which sets res.locals.tenantId and userId only after every
// tenant, membership and permission check passed.
export async function uploadPaymentAttachment(req: Request, res: Response) {
  const tenantId = res.locals['tenantId'] as string | undefined;
  const userId = res.locals['userId'] as string | undefined;
  if (!tenantId || !userId) throw new Error('uploadPaymentAttachment requires guardTenantSession');

  const parsedId = z.uuid().safeParse(req.params['paymentId']);
  if (!parsedId.success) {
    res.status(400).json({ errorCode: ErrorCodes.eventPayment.NOT_FOUND });
    return;
  }
  if (!req.file) {
    res.status(400).json({ errorCode: ErrorCodes.eventPayment.ATTACHMENT_INVALID_TYPE });
    return;
  }
  const attachment = await eventsModuleFromTenant(tenantId).addPaymentAttachment(
    parsedId.data,
    req.file,
    userId,
  );
  res.status(201).json(attachment);
}
