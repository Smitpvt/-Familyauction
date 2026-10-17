const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');

router.get('/summary', resultsController.getAuctionSummary);
router.get('/export-csv', resultsController.exportCSV);

module.exports = router;
