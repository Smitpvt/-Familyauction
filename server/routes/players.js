const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const authMiddleware = require('../middleware/auth');

// Public read
router.get('/', playerController.getAllPlayers);
router.get('/:id', playerController.getPlayerById);

// Protected admin writes
router.post('/', authMiddleware, playerController.createPlayer);
router.put('/:id', authMiddleware, playerController.updatePlayer);
router.delete('/:id', authMiddleware, playerController.deletePlayer);
router.post('/:id/re-auction', authMiddleware, playerController.reauctionPlayer);
router.post('/bulk-import', authMiddleware, playerController.bulkImportPlayers);

module.exports = router;
