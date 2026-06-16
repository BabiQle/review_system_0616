import { defineConfig } from "vite";
import { miaodaDevPlugin } from "miaoda-sc-plugin";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    miaodaDevPlugin(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    // 绑定所有网卡，启动后同时显示 Local 和 Network 地址
    // 局域网同事可通过 http://<本机IP>:5173 访问
    host: "0.0.0.0",
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // 强制所有依赖共享同一个 React 实例，避免多实例导致 hooks 失效
    dedupe: ['react', 'react-dom'],
  },
});
