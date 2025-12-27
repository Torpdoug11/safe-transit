const express = require('express');
const router = express.Router();

// In-memory reference to the scheduler service (will be set by server.js)
let schedulerService = null;
let sharedNotificationService = null;

function setSchedulerService(service) {
  schedulerService = service;
  sharedNotificationService = service.notificationService;
}

// Get scheduler status
router.get('/status', (req, res) => {
  if (!schedulerService) {
    return res.status(503).json({
      error: 'Scheduler service not available'
    });
  }

  try {
    const status = schedulerService.getSchedulerStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get scheduler status',
      message: error.message
    });
  }
});

// Run manual expired deposits check
router.post('/check-expired', async (req, res) => {
  if (!schedulerService) {
    return res.status(503).json({
      error: 'Scheduler service not available'
    });
  }

  try {
    await schedulerService.runManualCheck();
    res.json({
      message: 'Manual expired deposits check completed'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to run manual check',
      message: error.message
    });
  }
});

// Get notification history
router.get('/notifications', (req, res) => {
  try {
    if (!sharedNotificationService) {
      return res.status(503).json({
        error: 'Notification service not available'
      });
    }
    
    const { limit = 50, offset = 0, deposit_id } = req.query;
    
    let result;
    if (deposit_id) {
      const notifications = sharedNotificationService.getNotificationHistory(deposit_id);
      result = {
        notifications: notifications.slice(offset, offset + parseInt(limit)),
        total: notifications.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } else {
      result = sharedNotificationService.getAllNotifications(parseInt(limit), parseInt(offset));
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get notifications',
      message: error.message
    });
  }
});

// Send test notification
router.post('/test-notification', async (req, res) => {
  try {
    if (!sharedNotificationService) {
      return res.status(503).json({
        error: 'Notification service not available'
      });
    }
    
    const { deposit_id, type = 'test' } = req.body;
    
    if (!deposit_id) {
      return res.status(400).json({
        error: 'Deposit ID is required'
      });
    }
    
    const deposits = require('./deposits').getDeposits();
    const deposit = deposits.get(deposit_id);
    
    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }
    
    const result = await sharedNotificationService.sendExpirationNotification(deposit, type);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send test notification',
      message: error.message
    });
  }
});

// Add custom scheduled task
router.post('/tasks', (req, res) => {
  if (!schedulerService) {
    return res.status(503).json({
      error: 'Scheduler service not available'
    });
  }

  try {
    const { name, cronExpression, taskType } = req.body;
    
    if (!name || !cronExpression) {
      return res.status(400).json({
        error: 'Task name and cron expression are required'
      });
    }
    
    // Define callback based on task type
    let callback;
    switch (taskType) {
      case 'check_expired':
        callback = () => schedulerService.checkExpiredDeposits();
        break;
      case 'check_expiring_soon':
        callback = () => schedulerService.checkExpiringSoonDeposits();
        break;
      default:
        return res.status(400).json({
          error: 'Invalid task type. Use: check_expired, check_expiring_soon'
        });
    }
    
    schedulerService.addCustomTask(name, cronExpression, callback);
    
    res.json({
      message: `Custom task '${name}' added successfully`,
      task: {
        name,
        cronExpression,
        taskType
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to add custom task',
      message: error.message
    });
  }
});

// Remove custom scheduled task
router.delete('/tasks/:name', (req, res) => {
  if (!schedulerService) {
    return res.status(503).json({
      error: 'Scheduler service not available'
    });
  }

  try {
    const { name } = req.params;
    
    schedulerService.removeCustomTask(name);
    
    res.json({
      message: `Custom task '${name}' removed successfully`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to remove custom task',
      message: error.message
    });
  }
});

module.exports = {
  router,
  setSchedulerService
};
