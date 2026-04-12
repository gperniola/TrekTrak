const divIcon = jest.fn(() => ({ options: {}, createIcon: jest.fn() }));
const icon = jest.fn(() => ({ options: {} }));

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
};

export default L;
export { divIcon, icon, DivIcon };
