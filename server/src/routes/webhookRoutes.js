const router = require('express').Router();
const express = require('express');
const c = require('../controllers/webhookController');

// Raw body is required for signature verification.
router.post('/paddle', express.raw({ type: '*/*', limit: '1mb' }), c.paddle);

module.exports = router;
