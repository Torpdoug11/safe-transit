const express = require('express');
const router = express.Router();
const Deposit = require('../models/Deposit');
const AuditLog = require('../models/AuditLog');
const validator = require('validator');

const auditLogs = new Map();

// Get all deposits with filtering
router.get('/deposits', (req, res) => {
  try {
    const { status, payment_status, limit = 50, offset = 0 } = req.query;
    const deposits = require('./deposits').getDeposits();
    
    let allDeposits = Array.from(deposits.values());
    
    if (status) {
      allDeposits = allDeposits.filter(d => d.status === status);
    }
    
    if (payment_status) {
      allDeposits = allDeposits.filter(d => d.payment_status === payment_status);
    }
    
    allDeposits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const paginatedDeposits = allDeposits.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      deposits: paginatedDeposits.map(d => d.toJSON()),
      total: allDeposits.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Manual status override
router.put('/deposits/:id/override', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_status, admin_id, reason } = req.body;
    
    if (!validator.isUUID(id)) {
      return res.status(400).json({
        error: 'Invalid deposit ID format'
      });
    }
    
    if (!admin_id || !reason) {
      return res.status(400).json({
        error: 'Admin ID and reason are required'
      });
    }
    
    const deposits = require('./deposits').getDeposits();
    const deposit = deposits.get(id);
    
    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }
    
    const previousStatus = deposit.status;
    const previousPaymentStatus = deposit.payment_status;
    
    if (status && status !== previousStatus) {
      deposit.updateStatus(status);
    }
    
    if (payment_status && payment_status !== previousPaymentStatus) {
      deposit.updatePaymentStatus(payment_status);
    }
    
    const auditLog = new AuditLog({
      deposit_id: id,
      action: 'status_override',
      previous_status: previousStatus,
      new_status: deposit.status,
      previous_payment_status: previousPaymentStatus,
      new_payment_status: deposit.payment_status,
      admin_id,
      reason,
      metadata: {
        endpoint: req.originalUrl,
        user_agent: req.get('User-Agent')
      }
    });
    
    auditLogs.set(auditLog.id, auditLog);
    
    res.json({
      message: 'Deposit overridden successfully',
      deposit: deposit.toJSON(),
      audit_log: auditLog.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Manual restitution
router.post('/deposits/:id/restitute', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_id, reason } = req.body;
    
    if (!validator.isUUID(id)) {
      return res.status(400).json({
        error: 'Invalid deposit ID format'
      });
    }
    
    if (!admin_id || !reason) {
      return res.status(400).json({
        error: 'Admin ID and reason are required'
      });
    }
    
    const deposits = require('./deposits').getDeposits();
    const deposit = deposits.get(id);
    
    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }
    
    const previousPaymentStatus = deposit.payment_status;
    
    // Mark payment as cancelled
    if (deposit.payment_status === 'processing' || deposit.payment_status === 'completed') {
      deposit.updatePaymentStatus('cancelled');
    }
    
    deposit.updatePaymentStatus('cancelled');
    if (deposit.status === 'active') {
      deposit.updateStatus('cancelled');
    }
    
    const auditLog = new AuditLog({
      deposit_id: id,
      action: 'manual_restitution',
      previous_status: deposit.status,
      new_status: deposit.status,
      previous_payment_status: previousPaymentStatus,
      new_payment_status: deposit.payment_status,
      admin_id,
      reason,
      metadata: {
        endpoint: req.originalUrl
      }
    });
    
    auditLogs.set(auditLog.id, auditLog);
    
    res.json({
      message: 'Manual restitution completed successfully',
      deposit: deposit.toJSON(),
      audit_log: auditLog.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get audit logs
router.get('/audit-logs', (req, res) => {
  try {
    const { deposit_id, limit = 50, offset = 0 } = req.query;
    
    let allLogs = Array.from(auditLogs.values());
    
    if (deposit_id) {
      allLogs = allLogs.filter(log => log.deposit_id === deposit_id);
    }
    
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const paginatedLogs = allLogs.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      audit_logs: paginatedLogs.map(log => log.toJSON()),
      total: allLogs.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const deposits = require('./deposits').getDeposits();
    const allDeposits = Array.from(deposits.values());
    
    const stats = {
      total_deposits: allDeposits.length,
      status_counts: {},
      payment_status_counts: {},
      total_amount: allDeposits.reduce((sum, d) => sum + d.amount, 0),
      recent_deposits: allDeposits
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(d => d.toJSON())
    };
    
    allDeposits.forEach(deposit => {
      stats.status_counts[deposit.status] = (stats.status_counts[deposit.status] || 0) + 1;
      stats.payment_status_counts[deposit.payment_status] = (stats.payment_status_counts[deposit.payment_status] || 0) + 1;
    });
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
