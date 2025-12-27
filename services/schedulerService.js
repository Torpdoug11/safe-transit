const cron = require('node-cron');

class SchedulerService {
  constructor(notificationService = null) {
    this.notificationService = notificationService;
    this.tasks = new Map();
    this.isRunning = false;
  }

  startScheduler() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    console.log('Starting Safe Transit scheduler service...');
    this.isRunning = true;

    // Check for expired deposits every minute
    const expiredDepositsTask = cron.schedule('* * * * *', async () => {
      await this.checkExpiredDeposits();
    }, {
      scheduled: false
    });

    // Check for deposits expiring soon (within 1 hour) every 15 minutes
    const expiringSoonTask = cron.schedule('*/15 * * * *', async () => {
      await this.checkExpiringSoonDeposits();
    }, {
      scheduled: false
    });

    // Cleanup old notifications daily at 2 AM
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldNotifications();
    }, {
      scheduled: false
    });

    // Store tasks for management
    this.tasks.set('expiredDeposits', expiredDepositsTask);
    this.tasks.set('expiringSoon', expiringSoonTask);
    this.tasks.set('cleanup', cleanupTask);

    // Start all tasks
    expiredDepositsTask.start();
    expiringSoonTask.start();
    cleanupTask.start();

    console.log('Scheduler started with the following tasks:');
    console.log('- Expired deposits check: Every minute');
    console.log('- Expiring soon check: Every 15 minutes');
    console.log('- Cleanup task: Daily at 2 AM');

    // Run initial checks
    this.checkExpiredDeposits();
    this.checkExpiringSoonDeposits();
  }

  stopScheduler() {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    console.log('Stopping Safe Transit scheduler service...');
    
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`Stopped task: ${name}`);
    });

    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  async checkExpiredDeposits() {
    try {
      const deposits = require('../routes/deposits').getDeposits();
      const now = new Date();
      const expiredDeposits = [];

      for (const [id, deposit] of deposits) {
        const timeLimit = new Date(deposit.time_limit);
        
        // Check if deposit is expired but not yet marked as expired
        if (timeLimit < now && deposit.status !== 'expired' && deposit.status !== 'cancelled' && deposit.status !== 'fulfilled') {
          expiredDeposits.push(deposit);
        }
      }

      if (expiredDeposits.length > 0) {
        console.log(`Found ${expiredDeposits.length} expired deposits to process`);
        
        for (const deposit of expiredDeposits) {
          // Update deposit status
          deposit.updateStatus('expired');
          
          // Handle payment refunds if applicable
          if (deposit.payment_status === 'completed' || deposit.payment_status === 'captured') {
            await this.handlePaymentRefund(deposit);
          }
          
          // Send notification
          const notificationResult = await this.sendExpirationNotification(deposit, 'expired');
          console.log(`Notification result: ${notificationResult.success ? 'success' : 'failure'}`);
          
          console.log(`Processed expired deposit: ${deposit.id}`);
        }
      }
    } catch (error) {
      console.error('Error checking expired deposits:', error);
    }
  }

  async checkExpiringSoonDeposits() {
    try {
      const deposits = require('../routes/deposits').getDeposits();
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const expiringSoonDeposits = [];

      for (const [id, deposit] of deposits) {
        const timeLimit = new Date(deposit.time_limit);
        
        // Check if deposit expires within the next hour and hasn't been notified
        if (timeLimit <= oneHourFromNow && 
            timeLimit > now && 
            deposit.status === 'created' && 
            !this.hasBeenNotifiedRecently(deposit.id, 'expiring_soon')) {
          expiringSoonDeposits.push(deposit);
        }
      }

      if (expiringSoonDeposits.length > 0) {
        console.log(`Found ${expiringSoonDeposits.length} deposits expiring soon`);
        
        const results = await this.notificationService.sendMultipleNotifications(
          expiringSoonDeposits, 
          'expiring_soon'
        );
        
        console.log(`Sent ${results.filter(r => r.success).length} expiring soon notifications`);
      }
    } catch (error) {
      console.error('Error checking expiring soon deposits:', error);
    }
  }

  async handlePaymentRefund(deposit) {
    try {
      // If using Stripe, attempt to refund the payment
      if (deposit.stripe_payment_intent_id && process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        try {
          const refund = await stripe.refunds.create({
            payment_intent: deposit.stripe_payment_intent_id,
            reason: 'expired_deposit'
          });
          
          console.log(`Refund processed for deposit ${deposit.id}: ${refund.id}`);
          deposit.updatePaymentStatus('refunded');
          
        } catch (stripeError) {
          console.error(`Failed to process refund for deposit ${deposit.id}:`, stripeError);
          deposit.updatePaymentStatus('refund_failed');
        }
      } else {
        // For non-Stripe payments, just mark as refunded
        deposit.updatePaymentStatus('refunded');
      }
    } catch (error) {
      console.error(`Error handling payment refund for deposit ${deposit.id}:`, error);
    }
  }

  hasBeenNotifiedRecently(depositId, notificationType) {
    const notifications = this.notificationService.getNotificationHistory(depositId);
    const recentNotification = notifications.find(n => 
      n.type === notificationType && 
      n.status === 'sent' &&
      (Date.now() - new Date(n.timestamp).getTime()) < 2 * 60 * 60 * 1000 // Within last 2 hours
    );
    
    return !!recentNotification;
  }

  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const allNotifications = this.notificationService.getAllNotifications(1000, 0);
      
      const oldNotifications = allNotifications.notifications.filter(
        notification => new Date(notification.timestamp) < thirtyDaysAgo
      );
      
      if (oldNotifications.length > 0) {
        console.log(`Cleaning up ${oldNotifications.length} old notifications`);
        
        // In a production environment, you would delete from database
        // For now, we'll just log the cleanup
        oldNotifications.forEach(notification => {
          console.log(`Would delete notification: ${notification.id} from ${notification.timestamp}`);
        });
      }
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  getSchedulerStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      taskCount: this.tasks.size
    };
  }

  async runManualCheck() {
    console.log('Running manual expired deposits check...');
    await this.checkExpiredDeposits();
    await this.checkExpiringSoonDeposits();
    console.log('Manual check completed');
  }

  // Add custom scheduled task
  addCustomTask(name, cronExpression, callback) {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name '${name}' already exists`);
    }

    const task = cron.schedule(cronExpression, callback, { scheduled: false });
    this.tasks.set(name, task);
    
    if (this.isRunning) {
      task.start();
    }
    
    console.log(`Added custom task '${name}' with schedule: ${cronExpression}`);
  }

  // Remove custom task
  removeCustomTask(name) {
    const task = this.tasks.get(name);
    if (task) {
      task.stop();
      this.tasks.delete(name);
      console.log(`Removed custom task: ${name}`);
    }
  }
}

module.exports = SchedulerService;
