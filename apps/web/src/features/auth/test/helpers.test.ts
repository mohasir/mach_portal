import { describe, expect, it } from 'vitest';
import { getLoginErrorKey } from '../helpers';

describe('getLoginErrorKey', () => {
  it('maps the organization and credential errors to their own messages', () => {
    expect(getLoginErrorKey('USER_NO_ORGANIZATION')).toBe('errors.USER_NO_ORGANIZATION');
    expect(getLoginErrorKey('INVALID_EMAIL_OR_PASSWORD')).toBe('errors.INVALID_EMAIL_OR_PASSWORD');
  });

  it('falls back to the generic sign-in failure', () => {
    expect(getLoginErrorKey('SOMETHING_ELSE')).toBe('errors.signinFailed');
    expect(getLoginErrorKey(undefined)).toBe('errors.signinFailed');
  });
});
