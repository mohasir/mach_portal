export const ErrorCodes = {
  user: {
    NOT_FOUND: 'USER_NOT_FOUND',
    ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
    CANNOT_DELETE_SELF: 'USER_CANNOT_DELETE_SELF',
    CANNOT_EDIT_OWN_ROLE: 'USER_CANNOT_EDIT_OWN_ROLE',
  },
} as const;

type ValuesOf<T> = T[keyof T];

export type ErrorCode = ValuesOf<{
  [Group in keyof typeof ErrorCodes]: ValuesOf<(typeof ErrorCodes)[Group]>;
}>;
