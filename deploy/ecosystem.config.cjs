// PM2 process definition for the TanStack Start node-server build.
// Build output lives at .output/server/index.mjs after `NITRO_PRESET=node-server bun run build`.
module.exports = {
  apps: [
    {
      name: "idea411",
      script: ".output/server/index.mjs",
      cwd: ".",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        HOST: "127.0.0.1",
      },
    },
  ],
};
