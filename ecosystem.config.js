/**
 * PM2 Ecosystem Configuration — VIITS NEXUS 24/7
 *
 * Uso:
 *   npm run build          # Compilar React
 *   pm2 start ecosystem.config.js  # Iniciar producción
 *   pm2 monit              # Monitor en tiempo real
 *   pm2 logs viits-nexus   # Ver logs
 *   pm2 restart viits-nexus # Reiniciar manualmente
 *   pm2 save               # Guardar config para auto-start
 *   pm2 startup            # Registrar PM2 para inicio automático del SO
 */
module.exports = {
  apps: [{
    name: 'viits-nexus',
    script: 'server.js',
    instances: 1,
    autorestart: true,          // Auto-restart on crash
    watch: false,               // No file watching in production
    max_memory_restart: '512M', // Restart if memory exceeds 512MB (prevents leaks)
    min_uptime: '10s',          // Minimum uptime before considering it "started"
    max_restarts: 100,          // Max restarts before stopping
    restart_delay: 2000,        // 2s delay between restarts

    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      TZ: 'America/Bogota',    // Force Colombia timezone at OS level
    },

    // Logging
    error_file: './logs/viits-error.log',
    out_file: './logs/viits-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Health check (PM2 Plus feature, works with pm2 monit)
    // If health check fails, PM2 will restart the process
  }],
};
