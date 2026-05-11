module.exports = {
  apps: [
    {
      name: 'score-signals-v1-hourly',
      cwd: '/root/ai-dive',
      script: 'npm',
      args: 'run score:signals:v1 -- --limit 500',
      cron_restart: '10 * * * *',
      autorestart: false,
      time: true,
      out_file: '/root/ai-dive/logs/score-signals-hourly.out.log',
      error_file: '/root/ai-dive/logs/score-signals-hourly.err.log',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'score-signals-v1-nightly-force',
      cwd: '/root/ai-dive',
      script: 'npm',
      args: 'run score:signals:v1 -- --force --limit 2000',
      cron_restart: '30 3 * * *',
      autorestart: false,
      time: true,
      out_file: '/root/ai-dive/logs/score-signals-nightly.out.log',
      error_file: '/root/ai-dive/logs/score-signals-nightly.err.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
