const sql = require('mssql')
const { pool, poolConnect } = require('../database')

// Database helper functions
async function resetAccount(userId) {
  await poolConnect

  await pool.request()
    .input('userId', sql.Int, userId)
    .query(`DELETE FROM transactions WHERE user_id = @userId`)

  await pool.request()
    .input('userId', sql.Int, userId)
    .query(`DELETE FROM portfolios WHERE user_id = @userId`)

  await pool.request()
    .input('userId', sql.Int, userId)
    .query(`UPDATE users SET credits = 10000, totalScore = 0 WHERE id = @userId`)
}

async function deleteAccount(userId) {
  await poolConnect

  // Casecade will delete related entities
  await pool.request()
    .input('userId', sql.Int, userId)
    .query(`DELETE FROM users WHERE id = @userId`)
}

// Controller functions (called by routes)
async function resetUserAccount(req, res) {
  try {
    const userId = req.user.id
    await resetAccount(userId)
    res.status(200).json({ message: 'Account reset successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to reset account' })
  }
}

async function deleteUserAccount(req, res) {
  try {
    const userId = req.user.id
    await deleteAccount(userId)
    res.status(200).json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
}

module.exports = {
  resetUserAccount,
  deleteUserAccount,
}
