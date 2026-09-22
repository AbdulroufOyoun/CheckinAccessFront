export const environment = {
  production: false,
  /** Laravel API port: 8000 = Herd (default), 8001 = Octane (run k6/start-octane.ps1) */
  apiPort: 8000,
  reverb: {
    key: 'checkinaccess-local-key',
    host: '127.0.0.1',
    port: 8081,
    scheme: 'http',
  },
};
