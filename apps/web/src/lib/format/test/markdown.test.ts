import { describe, expect, it } from 'vitest';
import { isSafeLinkHref, lengthStatus, markdownToPlainText, maxLengthValidator } from '../markdown';

describe('markdownToPlainText', () => {
  it('drops bold and italic markers', () => {
    expect(markdownToPlainText('Some **bold**, __strong__, *it* and _em_ text')).toBe(
      'Some bold, strong, it and em text',
    );
  });

  it('drops heading and quote markers', () => {
    expect(markdownToPlainText('## Title\n\n> A quote')).toBe('Title A quote');
  });

  it('drops bullet and ordered list markers', () => {
    expect(markdownToPlainText('- one\n* two\n+ three\n\n1. first\n2) second')).toBe(
      'one two three first second',
    );
  });

  it('keeps the text of links and images, never the URL', () => {
    expect(
      markdownToPlainText('See [the menu](https://a.com/x) ![logo](https://a.com/l.png)'),
    ).toBe('See the menu logo');
  });

  it('unescapes escaped characters and HTML entities', () => {
    expect(markdownToPlainText('5 \\* 3 &lt;b&gt; &amp; \\[x\\]')).toBe('5 * 3 <b> & [x]');
  });

  it('collapses line breaks and repeated spaces into single spaces', () => {
    expect(markdownToPlainText('line one  \nline two\n\n\n   line   three')).toBe(
      'line one line two line three',
    );
  });

  it('leaves plain text untouched', () => {
    expect(markdownToPlainText('Grilled salmon with seasonal vegetables')).toBe(
      'Grilled salmon with seasonal vegetables',
    );
  });

  it('returns an empty string for empty or blank input', () => {
    expect(markdownToPlainText('')).toBe('');
    expect(markdownToPlainText('  \n ')).toBe('');
  });

  it('truncates with an ellipsis within the requested length', () => {
    const text = markdownToPlainText('**abcdef** ghij', 8);
    expect(text).toBe('abcdef…');
    expect(text.length).toBeLessThanOrEqual(8);
  });

  it('does not truncate text that already fits', () => {
    expect(markdownToPlainText('abc', 3)).toBe('abc');
  });

  it('never splits an emoji when truncating', () => {
    expect(markdownToPlainText('ab😀😀😀', 4)).toBe('ab😀…');
  });
});

describe('isSafeLinkHref', () => {
  it('allows web, mail and phone links', () => {
    expect(isSafeLinkHref('https://example.com')).toBe(true);
    expect(isSafeLinkHref('http://example.com/a?b=c')).toBe(true);
    expect(isSafeLinkHref('mailto:sales@example.com')).toBe(true);
    expect(isSafeLinkHref('tel:+5491100000000')).toBe(true);
  });

  it('rejects script and data URLs, whatever their casing or padding', () => {
    expect(isSafeLinkHref('javascript:alert(1)')).toBe(false);
    expect(isSafeLinkHref(' JavaScript:alert(1)')).toBe(false);
    expect(isSafeLinkHref('java\nscript:alert(1)')).toBe(false);
    expect(isSafeLinkHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeLinkHref('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects relative and empty links', () => {
    expect(isSafeLinkHref('/admin')).toBe(false);
    expect(isSafeLinkHref('')).toBe(false);
    expect(isSafeLinkHref(undefined)).toBe(false);
  });
});

describe('lengthStatus', () => {
  it('counts the stored Markdown and flags only what exceeds the limit', () => {
    expect(lengthStatus('**ab**', 6)).toEqual({ count: 6, over: false });
    expect(lengthStatus('**ab**', 5)).toEqual({ count: 6, over: true });
    expect(lengthStatus(undefined, 5)).toEqual({ count: 0, over: false });
  });
});

describe('maxLengthValidator', () => {
  // Each emoji is 2 UTF-16 units, the unit the API (Zod) and the counter measure.
  const withEmoji = (units: number) => `${'a'.repeat(units - 2)}😀`;
  const validate = (max: number, value: string | undefined) =>
    maxLengthValidator(max, 'too long')({}, value);

  it('accepts emoji text at or below the limit in UTF-16 units', async () => {
    await expect(validate(500, withEmoji(499))).resolves.toBeUndefined();
    await expect(validate(500, withEmoji(500))).resolves.toBeUndefined();
    await expect(validate(10000, withEmoji(10000))).resolves.toBeUndefined();
  });

  it('rejects emoji text one unit over the limit, even when its code points fit', async () => {
    const value = withEmoji(501);
    expect(Array.from(value).length).toBe(500);
    await expect(validate(500, value)).rejects.toThrow('too long');
    await expect(validate(10000, withEmoji(10001))).rejects.toThrow('too long');
  });

  it('accepts an empty value', async () => {
    await expect(validate(500, undefined)).resolves.toBeUndefined();
    await expect(validate(500, '')).resolves.toBeUndefined();
  });
});
