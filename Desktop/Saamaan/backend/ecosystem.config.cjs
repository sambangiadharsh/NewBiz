module.exports = {
  apps: [
    {
      name: 'ecommerce-backend',
      script: 'dist/server.js',
      instances: 'max',       // Utilizes all CPU cores on Azure App Service
      exec_mode: 'cluster',   // Cluster mode for zero-downtime reloads & load balancing
      max_memory_restart: '1G',
      restart_delay: 3000,    // Wait 3s before restarting on crash
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
