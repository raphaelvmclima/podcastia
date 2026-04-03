module.exports = {
  apps: [
    {
      name: 'podcastia-api',
      cwd: '/opt/podcastia',
      script: 'node_modules/.bin/tsx',
      args: 'apps/api/src/server.ts',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
        DOTENV_CONFIG_PATH: '/opt/podcastia/.env',
      },
      exp_backoff_restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
    {
      name: 'podcastia-web',
      cwd: '/opt/podcastia/apps/web/.next/standalone/apps/web',
      script: 'server.js',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
        HOSTNAME: '0.0.0.0',
      },
      exp_backoff_restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
