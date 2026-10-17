const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/auth');

// Public read
router.get('/', teamController.getAllTeams);
router.get('/:id', teamController.getTeamById);

// Protected admin writes
router.post('/', authMiddleware, teamController.createTeam);
router.put('/:id', authMiddleware, teamController.updateTeam);
router.delete('/:id', authMiddleware, teamController.deleteTeam);

module.exports = router;
