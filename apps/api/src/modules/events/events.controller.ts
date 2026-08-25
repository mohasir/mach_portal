import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { ErrorCodes } from '../../lib/errors';
import { ConfigRepository } from '../config/config.repository';
import { QuotesRepository } from '../quotes/quotes.repository';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

const service = new EventsService(
  new EventsRepository(db),
  new QuotesRepository(db),
  new ConfigRepository(db),
);

export async function uploadPaymentAttachment(req: Request, res: Response) {
  const parsedId = z.uuid().safeParse(req.params['paymentId']);
  if (!parsedId.success) {
    res.status(400).json({ errorCode: ErrorCodes.eventPayment.NOT_FOUND });
    return;
  }
  if (!req.file) {
    res.status(400).json({ errorCode: ErrorCodes.eventPayment.ATTACHMENT_INVALID_TYPE });
    return;
  }
  const attachment = await service.addPaymentAttachment(
    parsedId.data,
    req.file,
    (res.locals['userId'] as string | undefined) ?? null,
  );
  res.status(201).json(attachment);
}
