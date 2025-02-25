import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: "/Exam-Duty-IIITR",
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
