const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  getMyOptions,
  getOptionById,
  buyOption,
  exerciseOption,
  getOptionHistory
} = require('../controllers/optionController');

const router = express.Router();

// Get all active options for the logged-in user
router.get('/options', auth, getMyOptions);

// Get a single option by ID (active)
router.get('/options/:optionId', auth, getOptionById);

// Buy a new option
router.post('/options', auth, buyOption);

// Early exercise an option
router.post('/options/:optionId/exercise', auth, exerciseOption);

// Get option transaction history for the user
router.get('/options/history', auth, getOptionHistory);

module.exports = router;
