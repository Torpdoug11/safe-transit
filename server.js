require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { logger, requestLogger, errorHandler } = require('./middleware/logging');
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
app.use(requestLogger);


// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

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
app.use(errorHandler);

// Initialize shared services
const notificationService = new NotificationService();
const schedulerService = new SchedulerService(notificationService);

// Set scheduler service reference for routes
setSchedulerService(schedulerService);

// Start server
app.listen(PORT, () => {
  logger.info(`Safe Transit API server started`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
  console.log(`Safe Transit API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/`);
  
  // Start the scheduler after server is ready
  schedulerService.startScheduler();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    console.log('\nShutting down gracefully...');
    schedulerService.stopScheduler();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    console.log('\nShutting down gracefully...');
    schedulerService.stopScheduler();
    process.exit(0);
  });
});

module.exports = app;
