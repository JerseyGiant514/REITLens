import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/yahoo-api': {
            target: 'https://query1.finance.yahoo.com',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/yahoo-api/, ''),
          },
        },
      },
      plugins: [tailwindcss(), react()],
      resolve: {
        dedupe: ['react', 'react-dom', 'zustand'],
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'zustand', 'recharts', '@supabase/supabase-js'],
      },
      build: {
        outDir: 'dist',
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-charts': ['recharts'],
              'vendor-supabase': ['@supabase/supabase-js'],
              'vendor-motion': ['motion'],
            }
          }
        },
        chunkSizeWarningLimit: 1000,
        sourcemap: mode === 'development',
      }
    };
});
