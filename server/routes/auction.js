const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const authMiddleware = require('../middleware/auth');

// Public read of auction state (Projector and Admin polling fallback)
router.get('/state', auctionController.getState);

// Admin controls
router.post('/set-round', authMiddleware, auctionController.setRound);
router.post('/set-player', authMiddleware, auctionController.setPlayer);
router.post('/start-bidding', authMiddleware, auctionController.startBidding);
router.post('/bid', authMiddleware, auctionController.placeBid);
router.post('/sell', authMiddleware, auctionController.sellPlayer);
router.post('/unsold', authMiddleware, auctionController.markUnsold);
router.post('/pause', authMiddleware, auctionController.togglePause);
router.post('/next-player', authMiddleware, auctionController.nextPlayer);
router.post('/prev-player', authMiddleware, auctionController.prevPlayer);
router.post('/undo-sale', authMiddleware, auctionController.undoSale);
router.post('/set-increment', authMiddleware, auctionController.setBidIncrement);

module.exports = router;
