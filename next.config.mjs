import withSerwistInit from '@serwist/next';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Espone la versione (da package.json) al client per l'indicatore in Impostazioni.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
};

export default withSerwist(nextConfig);
