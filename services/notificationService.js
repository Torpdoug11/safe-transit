const nodemailer = require('nodemailer');
const AuditLog = require('../models/AuditLog');

class NotificationService {
  constructor() {
    this.transporter = null;
    this.notifications = new Map(); // In-memory storage for notifications
    this.initializeEmailTransporter();
  }

  initializeEmailTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      console.log('Email configuration not found. Using console notifications.');
    }
  }

  async sendExpirationNotification(deposit, notificationType = 'expired') {
    const notification = {
      id: require('crypto').randomUUID(),
      deposit_id: deposit.id,
      type: notificationType,
      recipient_email: deposit.creator_email || 'unknown@example.com',
      recipient_id: deposit.creator_id,
      subject: this.getSubject(notificationType, deposit),
      message: this.getMessage(notificationType, deposit),
      timestamp: new Date(),
      status: 'pending'
    };

    try {
      if (this.transporter && notification.recipient_email !== 'unknown@example.com') {
        await this.sendEmail(notification);
      } else {
        this.sendConsoleNotification(notification);
      }

      notification.status = 'sent';
      this.notifications.set(notification.id, notification);

      // Create audit log for notification
      const auditLog = new AuditLog({
        deposit_id: deposit.id,
        action: 'notification_sent',
        previous_status: deposit.status,
        new_status: deposit.status,
        previous_payment_status: deposit.payment_status,
        new_payment_status: deposit.payment_status,
        admin_id: 'system',
        reason: `Automated ${notificationType} notification sent`,
        metadata: {
          notification_id: notification.id,
          notification_type: notificationType,
          recipient: notification.recipient_email
        }
      });

      return { success: true, notification, auditLog };
    } catch (error) {
      notification.status = 'failed';
      notification.error = error.message;
      this.notifications.set(notification.id, notification);

      console.error(`Failed to send ${notificationType} notification for deposit ${deposit.id}:`, error);
      return { success: false, notification, error };
    }
  }

  async sendEmail(notification) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@safetransit.com',
      to: notification.recipient_email,
      subject: notification.subject,
      html: this.createEmailTemplate(notification)
    };

    await this.transporter.sendMail(mailOptions);
  }

  sendConsoleNotification(notification) {
    console.log('\n' + '='.repeat(50));
    console.log('NOTIFICATION SENT');
    console.log('='.repeat(50));
    console.log(`Type: ${notification.type}`);
    console.log(`Deposit ID: ${notification.deposit_id}`);
    console.log(`Recipient: ${notification.recipient_email}`);
    console.log(`Subject: ${notification.subject}`);
    console.log(`Message: ${notification.message}`);
    console.log(`Timestamp: ${notification.timestamp.toISOString()}`);
    console.log('='.repeat(50) + '\n');
  }

  getSubject(type, deposit) {
    switch (type) {
      case 'expired':
        return `Safe Transit: Deposit ${deposit.id.substring(0, 8)}... Has Expired`;
      case 'expiring_soon':
        return `Safe Transit: Deposit ${deposit.id.substring(0, 8)}... Expires Soon`;
      case 'payment_failed':
        return `Safe Transit: Payment Failed for Deposit ${deposit.id.substring(0, 8)}...`;
      default:
        return `Safe Transit: Notification for Deposit ${deposit.id.substring(0, 8)}...`;
    }
  }

  getMessage(type, deposit) {
    const timeLimit = new Date(deposit.time_limit).toLocaleString();
    const amount = `$${deposit.amount}`;
    
    switch (type) {
      case 'expired':
        return `Your deposit of ${amount} (ID: ${deposit.id.substring(0, 8)}...) has expired as of ${timeLimit}. The deposit status has been automatically updated to 'expired'. If you believe this is an error, please contact support.`;
      
      case 'expiring_soon':
        return `Your deposit of ${amount} (ID: ${deposit.id.substring(0, 8)}...) will expire soon. The time limit is ${timeLimit}. Please ensure the requirements are fulfilled before expiration to avoid automatic cancellation.`;
      
      case 'payment_failed':
        return `The payment for your deposit of ${amount} (ID: ${deposit.id.substring(0, 8)}...) has failed. Please update your payment information or contact support to resolve this issue.`;
      
      default:
        return `This is a notification regarding your deposit of ${amount} (ID: ${deposit.id.substring(0, 8)}...).`;
    }
  }

  createEmailTemplate(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Safe Transit Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Safe Transit</h1>
            <p>Secure Deposit Management System</p>
          </div>
          <div class="content">
            <h2>${notification.subject}</h2>
            <p>${notification.message}</p>
            <p><strong>Deposit ID:</strong> ${notification.deposit_id}</p>
            <p><strong>Timestamp:</strong> ${notification.timestamp.toLocaleString()}</p>
            <a href="http://localhost:3000" class="btn">View Your Deposits</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Safe Transit. Please do not reply to this email.</p>
            <p>If you have questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendMultipleNotifications(deposits, notificationType) {
    const results = [];
    
    for (const deposit of deposits) {
      const result = await this.sendExpirationNotification(deposit, notificationType);
      results.push(result);
      
      // Add delay between emails to avoid rate limiting
      if (this.transporter) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  getNotificationHistory(depositId) {
    return Array.from(this.notifications.values())
      .filter(notification => notification.deposit_id === depositId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getAllNotifications(limit = 50, offset = 0) {
    const allNotifications = Array.from(this.notifications.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return {
      notifications: allNotifications.slice(offset, offset + limit),
      total: allNotifications.length,
      limit,
      offset
    };
  }
}

module.exports = NotificationService;
