const { v4: uuidv4 } = require('uuid');

class Deposit {
  constructor({
    amount,
    requirement,
    time_limit,
    creator_id,
    receiver_id,
    status = 'created',
    payment_status = 'pending',
    creator_email = null,
    receiver_email = null,
    notification_preferences = {
      expiration: true,
      expiring_soon: true,
      payment_failed: true,
      fulfillment: true
    }
  }) {
    this.id = uuidv4();
    this.amount = amount;
    this.requirement = requirement;
    this.time_limit = time_limit;
    this.creator_id = creator_id;
    this.receiver_id = receiver_id;
    this.status = status;
    this.payment_status = payment_status;
    this.creator_email = creator_email;
    this.receiver_email = receiver_email;
    this.notification_preferences = notification_preferences;
    this.created_at = new Date();
    this.updated_at = new Date();
  }

  static validateStatus(status) {
    const validStatuses = ['created', 'pending_payment', 'active', 'fulfilled', 'expired', 'cancelled'];
    return validStatuses.includes(status);
  }

  static validatePaymentStatus(paymentStatus) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
    return validStatuses.includes(paymentStatus);
  }

  updateStatus(newStatus) {
    if (!Deposit.validateStatus(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Must be one of: created, pending_payment, active, fulfilled, expired, cancelled`);
    }
    this.status = newStatus;
    this.updated_at = new Date();
  }

  updatePaymentStatus(newPaymentStatus) {
    if (!Deposit.validatePaymentStatus(newPaymentStatus)) {
      throw new Error(`Invalid payment status: ${newPaymentStatus}. Must be one of: pending, processing, completed, failed, cancelled`);
    }
    this.payment_status = newPaymentStatus;
    this.updated_at = new Date();
  }


  updateNotificationPreferences(preferences) {
    this.notification_preferences = { ...this.notification_preferences, ...preferences };
    this.updated_at = new Date();
  }

  shouldReceiveNotification(notificationType) {
    return this.notification_preferences[notificationType] === true;
  }

  setEmails(creatorEmail, receiverEmail) {
    this.creator_email = creatorEmail;
    this.receiver_email = receiverEmail;
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      amount: this.amount,
      requirement: this.requirement,
      time_limit: this.time_limit,
      creator_id: this.creator_id,
      receiver_id: this.receiver_id,
      status: this.status,
      payment_status: this.payment_status,
      creator_email: this.creator_email,
      receiver_email: this.receiver_email,
      notification_preferences: this.notification_preferences,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Deposit;
