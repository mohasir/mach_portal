import type { Request, Response } from 'express';
import { z } from 'zod';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { TenantRunner } from '../../db';
import { ErrorCodes } from '../../lib/errors';
import type { ResolvedAccess } from '../../lib/rbac/access';
import { paymentAttachmentsModule } from './events.module';
import { eventOwnerId } from './events.scope';

// Mounted behind guardTenantSession, which sets res.locals.tenantId, userId, access and
// runInTenant only after every tenant, membership and permission check passed.
export async function uploadPaymentAttachment(req: Request, res: Response) {
  const tenantId = res.locals['tenantId'] as string | undefined;
  const userId = res.locals['userId'] as string | undefined;
  const access = res.locals['access'] as ResolvedAccess | undefined;
  const runInTenant = res.locals['runInTenant'] as TenantRunner | undefined;
  if (!tenantId || !userId || !access || !runInTenant) {
    throw new Error('uploadPaymentAttachment requires guardTenantSession');
  }

  const parsedId = z.uuid().safeParse(req.params['paymentId']);
  if (!parsedId.success) {
    res.status(400).json({ errorCode: ErrorCodes.eventPayment.NOT_FOUND });
    return;
  }
  if (!req.file) {
    res.status(400).json({ errorCode: ErrorCodes.eventPayment.ATTACHMENT_INVALID_TYPE });
    return;
  }
  const attachment = await paymentAttachmentsModule(runInTenant, tenantId).add(
    parsedId.data,
    req.file,
    userId,
    eventOwnerId(access, userId, [RESOURCES.PAYMENT, ACTIONS.UPLOAD_ATTACHMENT]),
  );
  res.status(201).json(attachment);
}
