const LOGIN_ERROR_CODES = ['USER_NO_ORGANIZATION', 'INVALID_EMAIL_OR_PASSWORD'] as const;

/** i18n key (namespace `auth`) for a sign-in failure; unknown codes get the generic one. */
export function getLoginErrorKey(code: string | null | undefined) {
  return LOGIN_ERROR_CODES.find((known) => known === code)
    ? (`errors.${code}` as const)
    : ('errors.signinFailed' as const);
}
