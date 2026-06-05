const divIcon = jest.fn(() => ({ options: {}, createIcon: jest.fn() }));
const icon = jest.fn(() => ({ options: {} }));
const latLngBounds = jest.fn((pts: unknown) => ({ pts, isValid: () => true }));

class DivIcon {
  options: Record<string, unknown>;
  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
  }
}

const L = {
  divIcon,
  icon,
  DivIcon,
  latLngBounds,
};

export default L;
export { divIcon, icon, DivIcon, latLngBounds };
