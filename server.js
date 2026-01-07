require('dotenv').config();
const express = require('express');
const { router: depositRoutes } = require('./routes/deposits');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const { router: schedulerRoutes, setSchedulerService } = require('./routes/scheduler');
const SchedulerService = require('./services/schedulerService');
const NotificationService = require('./services/notificationService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// CORS middleware (for development)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Routes
app.use('/deposit', depositRoutes);
app.use('/payment', paymentRoutes);
app.use('/admin', adminRoutes);
app.use('/scheduler', schedulerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Safe Transit API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      deposits: {
        create: 'POST /deposit',
        getStatus: 'GET /deposit/:id',
        fulfill: 'PUT /deposit/:id/fulfill',
        getAll: 'GET /deposit'
      },
      payments: {
        createPayment: 'POST /payment/create-payment',
        capturePayment: 'POST /payment/capture-payment',
        releasePayment: 'POST /payment/release-payment'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize shared services
const notificationService = new NotificationService();
const schedulerService = new SchedulerService(notificationService);

// Set scheduler service reference for routes
setSchedulerService(schedulerService);

// Start server
app.listen(PORT, () => {
  console.log(`Safe Transit API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/`);
  
  // Start the scheduler after server is ready
  schedulerService.startScheduler();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    schedulerService.stopScheduler();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    schedulerService.stopScheduler();
    process.exit(0);
  });
});

module.exports = app;
