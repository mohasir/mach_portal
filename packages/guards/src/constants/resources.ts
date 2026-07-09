// Recursos de DOMINIO de la app (fuente de la permissionsMatrix).
// user/session NO van acá: son del plugin `admin` de Better Auth y se manejan
// en core/access-control.ts (defaultStatements/adminAc).
export const RESOURCES = {
  NOTE: 'note',
} as const;

export type ResourceType    = (typeof RESOURCES)[keyof typeof RESOURCES];
export type ResourceKeyType = keyof typeof RESOURCES;
