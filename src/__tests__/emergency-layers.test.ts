import { EMERGENCY_LAYERS, getEmergencyLayer, isEmergencyLayerId } from '@/lib/emergency-layers';

describe('EMERGENCY_LAYERS registry', () => {
  test('contiene 4 layer con id univoci', () => {
    const ids = EMERGENCY_LAYERS.map((l) => l.id);
    expect(ids).toEqual(['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts']);
    expect(new Set(ids).size).toBe(4);
  });

  test('i layer wms hanno config wms, gli altri no', () => {
    for (const l of EMERGENCY_LAYERS) {
      if (l.kind === 'wms') {
        expect(l.wms).toBeDefined();
        expect(l.wms!.url).toMatch(/^https:\/\//);
        expect(l.refreshMinutes).toBeNull();
      } else {
        expect(l.wms).toBeUndefined();
        expect(l.refreshMinutes).toBeGreaterThan(0);
      }
    }
  });

  test('ogni layer ha label, description, attribution e legenda non vuoti', () => {
    for (const l of EMERGENCY_LAYERS) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.description.length).toBeGreaterThan(0);
      expect(l.attribution.length).toBeGreaterThan(0);
      expect(l.legend.length).toBeGreaterThan(0);
    }
  });

  test('getEmergencyLayer risolve un id, isEmergencyLayerId valida', () => {
    expect(getEmergencyLayer('fires-fwi').kind).toBe('wms');
    expect(isEmergencyLayerId('fires-hotspots')).toBe(true);
    expect(isEmergencyLayerId('nope')).toBe(false);
    expect(isEmergencyLayerId(42)).toBe(false);
  });
});
