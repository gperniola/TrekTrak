import withPWA from 'next-pwa';

const TILE_CACHE_OPTIONS = { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 };

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'tiles-osm', expiration: TILE_CACHE_OPTIONS },
    },
    {
      urlPattern: /^https:\/\/.*\.tile\.opentopomap\.org\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'tiles-opentopomap', expiration: TILE_CACHE_OPTIONS },
    },
    {
      urlPattern: /^https:\/\/tile\.thunderforest\.com\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'tiles-thunderforest', expiration: TILE_CACHE_OPTIONS },
    },
    {
      urlPattern: /^https:\/\/.*\.tile-cyclosm\.openstreetmap\.fr\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'tiles-cyclosm', expiration: TILE_CACHE_OPTIONS },
    },
    {
      urlPattern: /^https:\/\/tile\.waymarkedtrails\.org\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'tiles-waymarked', expiration: TILE_CACHE_OPTIONS },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default pwaConfig(nextConfig);
