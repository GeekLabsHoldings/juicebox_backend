const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const serviceRoutes = require('./serviceRoutes');

const mountRoutes = (app) => {
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/services', serviceRoutes);
};

module.exports = mountRoutes;
