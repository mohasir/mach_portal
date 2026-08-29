import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { hexColor } from './fields';

export const eventTypesListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'isActive', 'sortOrder']).default('name'),
});
export type EventTypesListQuery = z.infer<typeof eventTypesListQuerySchema>;

export const EVENT_TYPE_COLOR_PRESETS = [
  '#f5222d', // red
  '#fa541c', // volcano
  '#fa8c16', // orange
  '#faad14', // gold
  '#fadb14', // yellow
  '#a0d911', // lime
  '#52c41a', // green
  '#13c2c2', // cyan
  '#1677ff', // blue (AntD's default colorLink)
  '#2f54eb', // geekblue
  '#722ed1', // purple
  '#eb2f96', // magenta
  '#91922A', // olive (brand)
  '#4A2C2A', // brown (brand)
  '#8c8c8c', // grey
] as const;

export const DEFAULT_EVENT_TYPE_COLOR: (typeof EVENT_TYPE_COLOR_PRESETS)[number] = '#1677ff';

const eventTypeMutationFields = {
  name: z.string().trim().min(1, 'eventTypes.validation.nameRequired').max(120),
  color: hexColor('eventTypes.validation.colorInvalid').optional(),
} as const;

export const createEventTypeSchema = z.object(eventTypeMutationFields);
export const updateEventTypeSchema = z.object(eventTypeMutationFields);

export type CreateEventTypeInput = z.infer<typeof createEventTypeSchema>;
export type UpdateEventTypeInput = z.infer<typeof updateEventTypeSchema>;

export const eventTypeToggleActiveSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});
export type EventTypeToggleActiveInput = z.infer<typeof eventTypeToggleActiveSchema>;
