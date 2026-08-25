import { render, screen } from '@testing-library/react';
import { EmergencyWmsLayer, wmsTimeParam } from '@/components/map/emergency/EmergencyWmsLayer';
import { getEmergencyLayer } from '@/lib/emergency-layers';

describe('wmsTimeParam', () => {
  const now = new Date('2026-08-25T10:00:00');
  test('today → data odierna', () => {
    expect(wmsTimeParam('today', now)).toBe('2026-08-25');
  });
  test('yearToDate → intervallo da inizio anno', () => {
    expect(wmsTimeParam('yearToDate', now)).toBe('2026-01-01/2026-08-25');
  });
});

describe('EmergencyWmsLayer', () => {
  test('renderizza WMSTileLayer con layers, TIME e opacity dal def', () => {
    render(<EmergencyWmsLayer def={getEmergencyLayer('fires-fwi')} />);
    const el = screen.getByTestId('wms-tile-layer');
    const params = JSON.parse(el.getAttribute('data-params')!);
    expect(params.layers).toBe('mf010.fwi');
    expect(params.time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.transparent).toBe(true);
    expect(el.getAttribute('data-opacity')).toBe('0.55');
  });

  test('def senza wms → non renderizza nulla', () => {
    render(<EmergencyWmsLayer def={getEmergencyLayer('fires-hotspots')} />);
    expect(screen.queryByTestId('wms-tile-layer')).toBeNull();
  });
});
