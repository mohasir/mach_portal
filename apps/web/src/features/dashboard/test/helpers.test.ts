import { describe, expect, it } from 'vitest';
import { metricColSpan, visibleDashboardSections } from '../helpers';

describe('visibleDashboardSections', () => {
  it('shows everything with quotes and events active', () => {
    expect(visibleDashboardSections({ quotes: true, events: true })).toEqual({
      metrics: ['eventsCount', 'revenue', 'quotesCount', 'closeRate'],
      upcomingEvents: true,
      quotesByMonth: true,
      topProducts: true,
    });
  });

  it('hides the quote-derived cards without quotes', () => {
    expect(visibleDashboardSections({ quotes: false, events: true })).toEqual({
      metrics: ['eventsCount', 'revenue'],
      upcomingEvents: true,
      quotesByMonth: false,
      topProducts: false,
    });
  });

  it('hides the event-derived cards without events', () => {
    expect(visibleDashboardSections({ quotes: true, events: false })).toEqual({
      metrics: ['quotesCount', 'closeRate'],
      upcomingEvents: false,
      quotesByMonth: true,
      topProducts: true,
    });
  });

  it('shows no metric tiles in a core-only organization', () => {
    expect(visibleDashboardSections({ quotes: false, events: false })).toEqual({
      metrics: [],
      upcomingEvents: false,
      quotesByMonth: false,
      topProducts: false,
    });
  });
});

describe('metricColSpan', () => {
  it('keeps the four-tile layout', () => {
    expect(metricColSpan(4, 0)).toEqual({ xs: 12, md: 6 });
  });

  it('splits two tiles evenly', () => {
    expect(metricColSpan(2, 1)).toEqual({ xs: 12, md: 12 });
  });

  it('gives a lone last tile the full row on mobile', () => {
    expect(metricColSpan(3, 2)).toEqual({ xs: 24, md: 8 });
    expect(metricColSpan(3, 0)).toEqual({ xs: 12, md: 8 });
    expect(metricColSpan(1, 0)).toEqual({ xs: 24, md: 24 });
  });
});
