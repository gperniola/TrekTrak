/** Condizioni meteo selezionabili per un completamento. `code` è ciò che si persiste. */
export interface WeatherOption {
  code: string;
  icon: string;
  label: string;
}

export const WEATHER_OPTIONS: WeatherOption[] = [
  { code: 'sereno', icon: '☀️', label: 'Sereno' },
  { code: 'poco-nuvoloso', icon: '🌤️', label: 'Poco nuvoloso' },
  { code: 'nuvoloso', icon: '☁️', label: 'Nuvoloso' },
  { code: 'pioggia', icon: '🌧️', label: 'Pioggia' },
  { code: 'temporale', icon: '⛈️', label: 'Temporale' },
  { code: 'nebbia', icon: '🌫️', label: 'Nebbia' },
  { code: 'neve', icon: '❄️', label: 'Neve' },
];

const BY_CODE = new Map(WEATHER_OPTIONS.map((o) => [o.code, o]));

export function weatherOption(code: string | undefined | null): WeatherOption | undefined {
  return code ? BY_CODE.get(code) : undefined;
}
