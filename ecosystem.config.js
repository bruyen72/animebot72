module.exports = {
  apps: [{
    name: 'yakabot',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '768M',
    restart_delay: 5000,
    max_restarts: 50,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
