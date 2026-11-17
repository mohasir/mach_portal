import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../Markdown';

const render = (markdown: string) => renderToStaticMarkup(createElement(Markdown, null, markdown));

describe('Markdown', () => {
  it('renders the allowed formats', () => {
    const html = render(
      '## Title\n\n**bold** *it* [web](https://example.com)\n\n- a\n\n1. b\n\n> quote',
    );
    expect(html).toContain('<h2');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toMatch(/<ul[^>]*>\s*<li>a<\/li>\s*<\/ul>/);
    expect(html).toMatch(/<ol[^>]*>\s*<li>b<\/li>\s*<\/ol>/);
    expect(html).toContain('<blockquote');
  });

  it('opens links in a new tab without passing the opener or referrer', () => {
    const html = render('[web](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders raw HTML as inert text, never as elements', () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops the target of script links and keeps their text', () => {
    for (const href of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x']) {
      const html = render(`[click](${href})`);
      expect(html).not.toMatch(/href=/);
      expect(html.toLowerCase()).not.toContain('javascript:');
      expect(html).toContain('click');
    }
  });

  it('keeps the text of formats the editor does not offer', () => {
    const html = render('![logo](https://example.com/x.png) `code` ~~old~~\n\n| a |\n|---|\n| b |');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('<code');
    expect(html).toContain('code');
    expect(html).toContain('old');
  });
});
