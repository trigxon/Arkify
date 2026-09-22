const { getDefaultConfig } = require('expo/metro-config');
const { handleApiRequest } = require('./server/apiProxy');

const config = getDefaultConfig(__dirname);

const originalEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = originalEnhance ? originalEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    if (req.url && req.url.startsWith('/api/')) {
      handleApiRequest(req, res)
        .then((handled) => {
          if (!handled && !res.headersSent) {
            next();
          }
        })
        .catch((err) => {
          console.error('[metro] Error in handleApiRequest:', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
          }
        });
      return;
    }
    return enhanced(req, res, next);
  };
};

module.exports = config;
