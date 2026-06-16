module.exports = {
  apps: [
    {
      name: 'clipai-backend',
      cwd: './backend',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      watch: ['src'],
      env: {
        PORT: 2121,
        FRONTEND_URL: 'https://clip.perdafos.my.id',
      },
      max_memory_restart: '500M',
      restart_delay: 3000,
    },
    {
      name: 'clipai-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/vite',
      args: '--host',
      watch: false,
      env: {
        VITE_API_BASE_URL: 'https://clipapi.perdafos.my.id',
        VITE_WS_URL: 'wss://clipapi.perdafos.my.id',
      },
      max_memory_restart: '300M',
      restart_delay: 3000,
    },
  ],
}
