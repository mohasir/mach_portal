import { TbCalendarRepeat, TbHistory, TbUserExclamation } from 'react-icons/tb';
import type { ReleaseNote } from '../types';

export const releaseNote_0_16_0: ReleaseNote = {
  version: '0.16.0',
  slides: [
    {
      title: {
        es: 'Reprograma eventos fácilmente',
        en: 'Reschedule events with ease',
      },
      description: {
        es: 'Cambia la fecha y hora de cualquier evento desde el listado o su detalle, y añade el motivo para mantener a tu equipo al tanto.',
        en: 'Change the date and time of any event directly from the list or detail view, adding a reason to keep your team aligned.',
      },
      icon: TbCalendarRepeat,
    },
    {
      title: {
        es: 'Alertas de solapamiento',
        en: 'Schedule conflict alerts',
      },
      description: {
        es: 'Evita cruces de agenda: si un miembro del equipo ya tiene una asignación ese día, se mostrará una alerta antes de guardar con un enlace directo.',
        en: 'Avoid double-booking: if a team member already has an assignment that day, an alert will be displayed before saving with a direct link.',
      },
      icon: TbUserExclamation,
    },
    {
      title: {
        es: 'Historial de cambios',
        en: 'Complete change log',
      },
      description: {
        es: 'Consulta en todo momento la trazabilidad del evento: fecha anterior y nueva, motivo del cambio y quién lo realizó.',
        en: 'Track all modifications inside the event detail: previous and new dates, reason for change, and who made it.',
      },
      icon: TbHistory,
    },
  ],
};
