import { describe, expect, it } from 'vitest';
import { renderReport, renderSiteReport } from '../../src/reporters/index.js';
import { makeReport, makeSiteReport } from './fixtures.js';

describe('json reporter', () => {
  it('round-trips a ScanReport', () => {
    const report = makeReport();
    const out = renderReport(report, 'json');
    expect(JSON.parse(out)).toEqual(report);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('round-trips a SiteReport', () => {
    const site = makeSiteReport();
    const out = renderSiteReport(site, 'json');
    expect(JSON.parse(out)).toEqual(site);
    expect(out.endsWith('\n')).toBe(true);
  });
});
