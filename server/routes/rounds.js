const express = require('express');
const router = express.Router();
const roundController = require('../controllers/roundController');
const authMiddleware = require('../middleware/auth');

// Public read
router.get('/', roundController.getAllRounds);

// Protected admin writes
router.post('/', authMiddleware, roundController.createRound);
router.put('/:id', authMiddleware, roundController.updateRound);
router.delete('/:id', authMiddleware, roundController.deleteRound);

module.exports = router;
