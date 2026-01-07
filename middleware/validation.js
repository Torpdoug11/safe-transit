const { body, validationResult } = require('express-validator');
const validator = require('validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.escape(req.body[key]);
      }
    });
  }
  next();
};

const depositValidation = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number greater than 0'),
  body('requirement')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Requirement must be between 1 and 1000 characters'),
  body('time_limit')
    .isISO8601()
    .withMessage('Time limit must be a valid ISO8601 timestamp')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Time limit must be in the future');
      }
      return true;
    }),
  body('creator_id')
    .optional()
    .isUUID()
    .withMessage('Creator ID must be a valid UUID'),
  body('receiver_id')
    .optional()
    .isUUID()
    .withMessage('Receiver ID must be a valid UUID'),
  body('creator_email')
    .optional()
    .isEmail()
    .withMessage('Creator email must be a valid email address'),
  body('receiver_email')
    .optional()
    .isEmail()
    .withMessage('Receiver email must be a valid email address')
];

const uuidValidation = [
  body('id')
    .isUUID()
    .withMessage('ID must be a valid UUID')
];

module.exports = {
  handleValidationErrors,
  sanitizeInput,
  depositValidation,
  uuidValidation
};
