/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false, // true = 308 (SEO redirect)
      },
    ];
  },
};
module.exports = nextConfig;
