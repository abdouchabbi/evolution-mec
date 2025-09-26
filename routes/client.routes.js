const express = require('express');
const router = express.Router();
const { getClients, createClient, deleteClient } = require('../controllers/client.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(protect, getClients).post(protect, createClient);
router.route('/:id').delete(protect, deleteClient);
module.exports = router;
