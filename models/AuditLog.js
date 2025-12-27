const { v4: uuidv4 } = require('uuid');

class AuditLog {
  constructor({
    deposit_id,
    action,
    previous_status,
    new_status,
    previous_payment_status,
    new_payment_status,
    admin_id,
    reason,
    metadata = {}
  }) {
    this.id = uuidv4();
    this.deposit_id = deposit_id;
    this.action = action;
    this.previous_status = previous_status;
    this.new_status = new_status;
    this.previous_payment_status = previous_payment_status;
    this.new_payment_status = new_payment_status;
    this.admin_id = admin_id;
    this.reason = reason;
    this.metadata = metadata;
    this.timestamp = new Date();
  }

  static validateAction(action) {
    const validActions = [
      'status_override',
      'payment_status_override', 
      'manual_restitution',
      'manual_capture',
      'manual_cancellation',
      'admin_intervention'
    ];
    return validActions.includes(action);
  }

  toJSON() {
    return {
      id: this.id,
      deposit_id: this.deposit_id,
      action: this.action,
      previous_status: this.previous_status,
      new_status: this.new_status,
      previous_payment_status: this.previous_payment_status,
      new_payment_status: this.new_payment_status,
      admin_id: this.admin_id,
      reason: this.reason,
      metadata: this.metadata,
      timestamp: this.timestamp
    };
  }
}

module.exports = AuditLog;
