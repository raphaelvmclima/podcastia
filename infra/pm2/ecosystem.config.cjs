module.exports = {
  apps: [
    {
      name: "podcastia-api",
      cwd: "/opt/podcastia/apps/api",
      script: "npx",
      args: "tsx src/server.ts",
      env: {
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: "/opt/podcastia/.env",
      },
      max_memory_restart: "500M",
      restart_delay: 5000,
    },
    {
      name: "podcastia-web",
      cwd: "/opt/podcastia/apps/web",
      script: "npx",
      args: "next start -p 3002",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "500M",
      restart_delay: 5000,
    },
  ],
};
