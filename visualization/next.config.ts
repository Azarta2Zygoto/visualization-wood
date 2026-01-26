import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
    output: 'export', // Generates static HTML/CSS/JS files
    images: {
        unoptimized: true, // Required for static export
    },
    basePath: '/visualization-wood', // Base path for the static export
    assetPrefix: '/visualization-wood/',
    env: {
        NEXT_PUBLIC_BASE_PATH: '/visualization-wood'
    }
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
