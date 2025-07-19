import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
});

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
  reactStrictMode: false,
};

// export default withPWA(nextConfig);
export default nextConfig;
