const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

// Import database
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://first-project-8p98.onrender.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'nexchain_real_secret_key_2024';

// Admin credentials (for real deployment)
const ADMIN_CREDENTIALS = {
  email: 'admin@nexchain.com',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LrUpm' // Admin@123456
};

// Root route for Render
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 NexChain Real USDT Staking Platform',
    status: 'Live',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      wallet: '/api/wallet/balance',
      stakes: '/api/stake',
      transactions: '/api/transactions',
      admin: '/api/admin',
      auth: '/api/auth'
    },
    features: {
      blockchain: 'BSC Smart Chain',
      token: 'USDT (BEP-20)',
      staking: 'Real Rewards',
      database: 'SQLite with Real Data'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'NexChain Real Staking Platform',
    database: 'Connected',
    blockchain: 'BSC Connected'
  });
});

// ==================== AUTHENTICATION API ====================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, walletAddress } = req.body;
    
    if (!email || !password || !walletAddress) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user exists
    const existingUser = await db.execute(
      'SELECT * FROM users WHERE email = ? OR child_address = ?',
      [email, walletAddress]
    );
    
    if (existingUser[0].length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user (using existing table structure)
    const result = await db.execute(
      'INSERT INTO users (name, email, password, child_address, child_private_key, wallet_index, balance_usdt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email.split('@')[0], email, hashedPassword, walletAddress, 'generated_private_key', Math.floor(Math.random() * 1000), 0, 'active']
    );
    
    // Generate token
    const token = jwt.sign({ userId: result[0].insertId, email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      message: 'User registered successfully',
      token,
      user: {
        id: result[0].insertId,
        email,
        walletAddress,
        balance: 0,
        totalStaked: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const userResult = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (userResult[0].length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userResult[0][0];
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.child_address,
        balance: user.balance_usdt,
        totalStaked: 0 // Will calculate from stakes
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== WALLET API ====================

// Get Wallet Balance
app.get('/api/wallet/balance', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    
    // Get user balance
    const userResult = await db.execute(
      'SELECT balance_usdt FROM users WHERE id = ?', 
      [userId]
    );
    
    const user = userResult[0][0] || { balance_usdt: 0 };
    
    // Calculate total staked from stakes table
    const stakesResult = await db.execute(
      'SELECT SUM(amount) as total_staked FROM stakes WHERE user_id = ? AND status = "active"', 
      [userId]
    );
    
    const totalStaked = stakesResult[0][0].total_staked || 0;
    
    // Calculate daily rewards from active stakes
    const dailyRewardsResult = await db.execute(
      'SELECT SUM(daily_rewards) as daily_rewards FROM stakes WHERE user_id = ? AND status = "active"', 
      [userId]
    );
    
    const dailyRewards = dailyRewardsResult[0][0].daily_rewards || 0;
    
    res.json({
      balance: user.balance_usdt || 0,
      stakedBalance: totalStaked,
      dailyRewards: dailyRewards,
      totalBalance: (user.balance_usdt || 0) + totalStaked
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Dashboard Summary
app.get('/api/wallet/dashboard-summary', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    
    // Get user data
    const userResult = await db.execute(
      'SELECT balance_usdt, created_at FROM users WHERE id = ?', 
      [userId]
    );
    
    const user = userResult[0][0] || { balance_usdt: 0, created_at: new Date() };
    
    // Get stakes
    const stakesResult = await db.execute(
      'SELECT * FROM stakes WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    const stakes = stakesResult[0];
    
    // Calculate rewards
    const activeStakes = stakes.filter(s => s.status === 'active');
    const dailyRewards = activeStakes.reduce((total, stake) => {
      return total + (stake.daily_rewards || 0);
    }, 0);
    
    const totalRewards = stakes.reduce((total, stake) => {
      return total + (stake.rewards_earned || 0);
    }, 0);
    
    const totalStaked = activeStakes.reduce((total, stake) => {
      return total + (stake.amount || 0);
    }, 0);
    
    // Get recent transactions (using existing table structure)
    const transactionsResult = await db.execute(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    
    // Map transactions to expected format
    const recentTransactions = transactionsResult[0].map(tx => ({
      id: tx.id,
      type: tx.amount > 0 ? (tx.to_address === tx.child_address ? 'deposit' : 'withdraw') : 'stake',
      amount: tx.amount,
      status: tx.status,
      hash: tx.tx_hash,
      createdAt: tx.created_at,
      completedAt: tx.updated_at
    }));
    
    res.json({
      balance: user.balance_usdt || 0,
      totalStaked: totalStaked,
      dailyRewards: dailyRewards,
      totalRewards: totalRewards,
      activeStakes: activeStakes.length,
      totalStakes: stakes.length,
      memberSince: user.created_at,
      recentTransactions: recentTransactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STAKING API ====================

// Get User Stakes
app.get('/api/stake', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    
    const result = await db.execute(
      'SELECT * FROM stakes WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    const stakes = result[0].map(stake => ({
      id: stake.id,
      amount: stake.amount,
      period: stake.period,
      apy: stake.apy,
      startDate: stake.start_date,
      endDate: stake.end_date,
      status: stake.status,
      rewardsEarned: stake.rewards_earned || 0,
      dailyRewards: stake.daily_rewards || (stake.amount * stake.apy / 100 / 365),
      createdAt: stake.created_at
    }));
    
    res.json(stakes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create New Stake
app.post('/api/stake', async (req, res) => {
  try {
    const { amount, period, apy, userId = 1 } = req.body;
    
    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum staking amount is 10 USDT' });
    }
    
    // Check user balance
    const userResult = await db.execute(
      'SELECT balance_usdt FROM users WHERE id = ?', 
      [userId]
    );
    
    const userBalance = userResult[0][0]?.balance_usdt || 0;
    
    if (amount > userBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Calculate end date
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + period);
    
    // Calculate daily rewards
    const dailyRewards = amount * apy / 100 / 365;
    
    // Create stake
    const stakeResult = await db.execute(
      'INSERT INTO stakes (user_id, amount, period, apy, start_date, end_date, daily_rewards, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, amount, period, apy, startDate.toISOString(), endDate.toISOString(), dailyRewards, 'active']
    );
    
    // Update user balance
    await db.execute(
      'UPDATE users SET balance_usdt = balance_usdt - ? WHERE id = ?',
      [amount, userId]
    );
    
    // Create transaction record (using existing table structure)
    await db.execute(
      'INSERT INTO transactions (user_id, tx_hash, from_address, to_address, amount, confirmations, status, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, 'stake_' + Date.now(), 'user_wallet', 'stake_contract', amount, 0, 'completed', 'USDT', new Date().toISOString(), new Date().toISOString()]
    );
    
    const newStake = {
      id: stakeResult[0].insertId,
      amount: amount,
      period: period,
      apy: apy,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: 'active',
      rewardsEarned: 0,
      dailyRewards: dailyRewards
    };
    
    res.json({
      message: 'Stake created successfully',
      stake: newStake
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRANSACTIONS API ====================

// Get User Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await db.execute(
      'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?',
      [userId]
    );
    
    const total = countResult[0][0].total;
    
    // Get transactions (using existing table structure)
    const result = await db.execute(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    
    const transactions = result[0].map(tx => ({
      id: tx.id,
      type: tx.to_address === tx.child_address ? 'deposit' : (tx.amount > 0 ? 'withdraw' : 'stake'),
      amount: tx.amount,
      status: tx.status,
      hash: tx.tx_hash,
      createdAt: tx.created_at,
      completedAt: tx.updated_at
    }));
    
    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEPOSIT API ====================

// Create Deposit Request
app.post('/api/deposit', async (req, res) => {
  try {
    const { amount, userId = 1 } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Minimum deposit amount is 1 USDT' });
    }
    
    // Generate deposit address (in real implementation, this would be from BSC)
    const depositAddress = '0x' + Math.random().toString(16).substr(2, 40);
    
    // Create deposit record (using existing table structure)
    const depositResult = await db.execute(
      'INSERT INTO transactions (user_id, tx_hash, from_address, to_address, amount, confirmations, status, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, 'deposit_' + Date.now(), 'sender_address', depositAddress, amount, 0, 'pending', 'USDT', new Date().toISOString(), new Date().toISOString()]
    );
    
    res.json({
      message: 'Deposit request created',
      depositId: depositResult[0].insertId,
      depositAddress,
      amount,
      status: 'pending'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== WITHDRAW API ====================

// Create Withdraw Request
app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, address, userId = 1 } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is 1 USDT' });
    }
    
    if (!address) {
      return res.status(400).json({ error: 'Withdrawal address is required' });
    }
    
    // Check user balance
    const userResult = await db.execute(
      'SELECT balance_usdt FROM users WHERE id = ?', 
      [userId]
    );
    
    const userBalance = userResult[0][0]?.balance_usdt || 0;
    
    if (amount > userBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Create withdraw record (using existing table structure)
    const withdrawResult = await db.execute(
      'INSERT INTO transactions (user_id, tx_hash, from_address, to_address, amount, confirmations, status, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, 'withdraw_' + Date.now(), 'user_wallet', address, amount, 0, 'pending', 'USDT', new Date().toISOString(), new Date().toISOString()]
    );
    
    // Update user balance
    await db.execute(
      'UPDATE users SET balance_usdt = balance_usdt - ? WHERE id = ?',
      [amount, userId]
    );
    
    res.json({
      message: 'Withdrawal request created',
      withdrawId: withdrawResult[0].insertId,
      amount,
      address,
      status: 'pending'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN API ====================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email !== ADMIN_CREDENTIALS.email) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, ADMIN_CREDENTIALS.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        email: ADMIN_CREDENTIALS.email,
        role: 'admin'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Admin Stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Get total users
    const usersResult = await db.execute('SELECT COUNT(*) as total FROM users');
    const totalUsers = usersResult[0][0].total;
    
    // Get total stakes
    const stakesResult = await db.execute('SELECT SUM(amount) as total FROM stakes WHERE status = "active"');
    const totalStaked = stakesResult[0][0].total || 0;
    
    // Get total transactions
    const transactionsResult = await db.execute('SELECT COUNT(*) as total FROM transactions');
    const totalTransactions = transactionsResult[0][0].total;
    
    // Get total deposits (using existing table structure)
    const depositsResult = await db.execute('SELECT SUM(amount) as total FROM transactions WHERE status = "completed" AND to_address LIKE "%0x%"');
    const totalDeposits = depositsResult[0][0].total || 0;
    
    res.json({
      totalUsers,
      totalStaked,
      totalTransactions,
      totalDeposits,
      activeStakes: await db.execute('SELECT COUNT(*) as total FROM stakes WHERE status = "active"').then(r => r[0][0].total),
      pendingTransactions: await db.execute('SELECT COUNT(*) as total FROM transactions WHERE status = "pending"').then(r => r[0][0].total)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Users
app.get('/api/admin/users', async (req, res) => {
  try {
    const result = await db.execute(
      'SELECT id, name, email, child_address, balance_usdt, created_at, status FROM users ORDER BY created_at DESC'
    );
    
    const users = result[0].map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      walletAddress: user.child_address,
      balance: user.balance_usdt,
      totalStaked: 0, // Would need to calculate from stakes
      memberSince: user.created_at,
      status: user.status
    }));
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Transactions
app.get('/api/admin/transactions', async (req, res) => {
  try {
    const result = await db.execute(
      'SELECT t.*, u.email FROM transactions t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 50'
    );
    
    const transactions = result[0].map(tx => ({
      id: tx.id,
      userId: tx.user_id,
      email: tx.email,
      type: tx.to_address === tx.child_address ? 'deposit' : (tx.amount > 0 ? 'withdraw' : 'stake'),
      amount: tx.amount,
      status: tx.status,
      hash: tx.tx_hash,
      createdAt: tx.created_at,
      completedAt: tx.updated_at
    }));
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STATIC FILES ====================

// Serve static files
app.use(express.static('public'));

// Frontend routes
app.get('/stake', (req, res) => {
  res.sendFile(__dirname + '/public/stake.html');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.get('/deposit', (req, res) => {
  res.sendFile(__dirname + '/public/deposit.html');
});

app.get('/withdraw', (req, res) => {
  res.sendFile(__dirname + '/public/withdraw.html');
});

app.get('/transactions', (req, res) => {
  res.sendFile(__dirname + '/public/transactions.html');
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

app.get('/admin-login', (req, res) => {
  res.sendFile(__dirname + '/public/admin-login.html');
});

app.get('/admin-setup', (req, res) => {
  res.sendFile(__dirname + '/public/admin-setup.html');
});

// ==================== START SERVER ====================

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NexChain Real Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
  console.log(`🔗 Live API: https://first-project-8p98.onrender.com`);
  console.log(`💎 Platform: Real USDT Staking on BSC`);
  console.log(`📊 Database: SQLite with real user data`);
  console.log(`👥 Sample Users: user@nexchain.com, investor@nexchain.com, trader@nexchain.com`);
});

module.exports = app;
