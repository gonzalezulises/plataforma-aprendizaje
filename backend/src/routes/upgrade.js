import express from 'express';
import { getDatabase, saveDatabase, queryOne, queryAll, run } from '../config/database.js';

const router = express.Router();

// Payment configuration - simulates rizo.ma payment integration
const RIZO_MA_PAYMENT_URL = process.env.RIZO_MA_PAYMENT_URL || 'https://rizo.ma/payment';
const RIZO_MA_CALLBACK_URL = process.env.RIZO_MA_CALLBACK_URL || 'http://localhost:4000/api/upgrade/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Premium plan options
const PREMIUM_PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Plan Mensual',
    price: 9.99,
    currency: 'USD',
    duration_days: 30,
    features: [
      'Acceso a todos los cursos premium',
      'Ejercicios avanzados',
      'Proyectos con revision de instructor',
      'Certificados verificables',
      'Soporte prioritario'
    ]
  },
  annual: {
    id: 'annual',
    name: 'Plan Anual',
    price: 79.99,
    currency: 'USD',
    duration_days: 365,
    features: [
      'Todo lo del plan mensual',
      '2 meses gratis',
      'Acceso anticipado a nuevos cursos',
      'Sesiones 1:1 con instructores',
      'Descuentos en webinars'
    ]
  }
};

/**
 * Initialize upgrade-related database tables
 */
export function initUpgradeTables(db) {
  // Subscriptions table - tracks user premium subscriptions
  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_id TEXT,
      payment_method TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      started_at TEXT,
      expires_at TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for subscription lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`);

  // Payment transactions table - tracks all payment attempts
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subscription_id INTEGER,
      transaction_id TEXT UNIQUE,
      type TEXT NOT NULL DEFAULT 'subscription',
      status TEXT NOT NULL DEFAULT 'pending',
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_method TEXT,
      payment_provider TEXT DEFAULT 'rizo.ma',
      error_message TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for transaction lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status)`);

  console.log('[Upgrade] Database tables initialized');
}

/**
 * GET /api/upgrade/plans
 * Get available premium plans
 */
router.get('/plans', (req, res) => {
  res.json({
    plans: Object.values(PREMIUM_PLANS),
    recommended: 'annual'
  });
});

/**
 * GET /api/upgrade/status
 * Get current user's subscription status
 */
router.get('/status', (req, res) => {
  // Check authentication
  if (!req.session.isAuthenticated || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  // Check if user already has premium
  const isPremium = userRole === 'student_premium' || userRole === 'instructor' || userRole === 'instructor_admin';

  // Get active subscription if any
  const db = getDatabase();
  const subscription = queryOne(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND status = 'active'
    ORDER BY expires_at DESC LIMIT 1
  `, [userId]);

  res.json({
    isPremium,
    currentRole: userRole,
    subscription: subscription ? {
      planId: subscription.plan_id,
      planName: PREMIUM_PLANS[subscription.plan_id]?.name || 'Premium',
      startedAt: subscription.started_at,
      expiresAt: subscription.expires_at,
      status: subscription.status
    } : null
  });
});

/**
 * POST /api/upgrade/initiate
 * Start the upgrade process - creates a pending subscription and returns payment URL
 */
router.post('/initiate', (req, res) => {
  // Check authentication
  if (!req.session.isAuthenticated || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const userId = req.session.user.id;
  const userRole = req.session.user.role;
  const { planId } = req.body;

  // Validate plan
  const plan = PREMIUM_PLANS[planId];
  if (!plan) {
    return res.status(400).json({ error: 'Plan no valido' });
  }

  // Check if user already has premium
  if (userRole === 'student_premium' || userRole === 'instructor' || userRole === 'instructor_admin') {
    return res.status(400).json({ error: 'Ya tienes una suscripcion activa' });
  }

  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Create pending subscription
    const result = run(`
      INSERT INTO subscriptions (user_id, plan_id, status, amount, currency, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?, ?)
    `, [userId, planId, plan.price, plan.currency, now, now]);

    const subscriptionId = result.lastInsertRowid;

    // Generate unique transaction ID
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment transaction record
    run(`
      INSERT INTO payment_transactions (user_id, subscription_id, transaction_id, type, status, amount, currency, created_at, updated_at)
      VALUES (?, ?, ?, 'subscription', 'pending', ?, ?, ?, ?)
    `, [userId, subscriptionId, transactionId, plan.price, plan.currency, now, now]);

    // Store transaction ID in session for callback verification
    req.session.pendingTransaction = transactionId;
    req.session.pendingSubscription = subscriptionId;

    // Build payment URL (in production, this would be an actual rizo.ma payment link)
    const paymentParams = new URLSearchParams({
      transaction_id: transactionId,
      amount: plan.price.toString(),
      currency: plan.currency,
      description: `${plan.name} - Plataforma de Aprendizaje`,
      callback_url: RIZO_MA_CALLBACK_URL,
      success_url: `${FRONTEND_URL}/upgrade/success`,
      cancel_url: `${FRONTEND_URL}/upgrade/cancel`
    });

    const paymentUrl = `${RIZO_MA_PAYMENT_URL}?${paymentParams.toString()}`;

    // For development mode, log payment info to console
    console.log('[Upgrade] Payment initiated');
    console.log('[Upgrade] Transaction ID:', transactionId);
    console.log('[Upgrade] Amount:', plan.price, plan.currency);
    console.log('[Upgrade] Payment URL:', paymentUrl);
    console.log('[Upgrade] To simulate successful payment, visit: /api/upgrade/simulate-payment?transaction_id=' + transactionId);

    res.json({
      success: true,
      transactionId,
      subscriptionId,
      paymentUrl,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency
      },
      // Development mode info
      development: {
        message: 'Para simular un pago exitoso en desarrollo, usa el endpoint de simulacion',
        simulateUrl: `/api/upgrade/simulate-payment?transaction_id=${transactionId}`
      }
    });
  } catch (error) {
    console.error('[Upgrade] Error initiating upgrade:', error);
    res.status(500).json({ error: 'Error al iniciar el proceso de pago' });
  }
});

/**
 * GET /api/upgrade/simulate-payment
 * Development-only endpoint to simulate a successful payment from rizo.ma
 */
router.get('/simulate-payment', (req, res) => {
  const { transaction_id } = req.query;

  if (!transaction_id) {
    return res.status(400).json({ error: 'Transaction ID requerido' });
  }

  console.log('[Upgrade] Simulating payment for transaction:', transaction_id);

  // Forward to callback handler
  req.query.status = 'success';
  req.query.payment_method = 'simulated';

  // Redirect to callback handler
  res.redirect(`/api/upgrade/callback?transaction_id=${transaction_id}&status=success&payment_method=simulated`);
});

/**
 * GET /api/upgrade/callback
 * Payment callback from rizo.ma - processes the payment result
 */
router.get('/callback', (req, res) => {
  const { transaction_id, status, payment_method, error } = req.query;

  console.log('[Upgrade] Payment callback received');
  console.log('[Upgrade] Transaction ID:', transaction_id);
  console.log('[Upgrade] Status:', status);

  if (!transaction_id) {
    return res.redirect(`${FRONTEND_URL}/upgrade/error?message=${encodeURIComponent('ID de transaccion no proporcionado')}`);
  }

  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Get transaction
    const transaction = queryOne('SELECT * FROM payment_transactions WHERE transaction_id = ?', [transaction_id]);

    if (!transaction) {
      console.error('[Upgrade] Transaction not found:', transaction_id);
      return res.redirect(`${FRONTEND_URL}/upgrade/error?message=${encodeURIComponent('Transaccion no encontrada')}`);
    }

    if (status === 'success') {
      // Update transaction status
      run(`
        UPDATE payment_transactions
        SET status = 'completed', payment_method = ?, updated_at = ?
        WHERE transaction_id = ?
      `, [payment_method || 'card', now, transaction_id]);

      // Get subscription
      const subscription = queryOne('SELECT * FROM subscriptions WHERE id = ?', [transaction.subscription_id]);

      if (subscription) {
        // Calculate expiration date based on plan
        const plan = PREMIUM_PLANS[subscription.plan_id];
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (plan?.duration_days || 30));

        // Update subscription status
        run(`
          UPDATE subscriptions
          SET status = 'active', payment_id = ?, payment_method = ?, started_at = ?, expires_at = ?, updated_at = ?
          WHERE id = ?
        `, [transaction_id, payment_method || 'card', now, expiresAt.toISOString(), now, subscription.id]);

        // Update user role to premium
        run(`
          UPDATE users SET role = 'student_premium', updated_at = ? WHERE id = ?
        `, [now, transaction.user_id]);

        // If user is in session, update their session
        if (req.session.user && req.session.user.id === transaction.user_id) {
          req.session.user.role = 'student_premium';
        }

        console.log('[Upgrade] User upgraded to premium:', transaction.user_id);
        console.log('[Upgrade] Subscription expires:', expiresAt.toISOString());
      }

      // Redirect to success page
      res.redirect(`${FRONTEND_URL}/upgrade/success?transaction_id=${transaction_id}`);
    } else {
      // Payment failed or cancelled
      run(`
        UPDATE payment_transactions
        SET status = 'failed', error_message = ?, updated_at = ?
        WHERE transaction_id = ?
      `, [error || 'Payment failed', now, transaction_id]);

      run(`
        UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?
      `, [now, now, transaction.subscription_id]);

      res.redirect(`${FRONTEND_URL}/upgrade/error?message=${encodeURIComponent(error || 'El pago no fue completado')}`);
    }
  } catch (err) {
    console.error('[Upgrade] Callback error:', err);
    res.redirect(`${FRONTEND_URL}/upgrade/error?message=${encodeURIComponent('Error al procesar el pago')}`);
  }
});

/**
 * POST /api/upgrade/verify
 * Verify if a transaction was successful and update session
 */
router.post('/verify', (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: 'Transaction ID requerido' });
  }

  try {
    const transaction = queryOne('SELECT * FROM payment_transactions WHERE transaction_id = ?', [transactionId]);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaccion no encontrada' });
    }

    const subscription = queryOne('SELECT * FROM subscriptions WHERE id = ?', [transaction.subscription_id]);

    // If user is authenticated and this is their transaction, update session
    if (req.session.user && req.session.user.id === transaction.user_id && transaction.status === 'completed') {
      req.session.user.role = 'student_premium';
    }

    res.json({
      success: transaction.status === 'completed',
      status: transaction.status,
      subscription: subscription ? {
        planId: subscription.plan_id,
        planName: PREMIUM_PLANS[subscription.plan_id]?.name,
        status: subscription.status,
        expiresAt: subscription.expires_at
      } : null
    });
  } catch (error) {
    console.error('[Upgrade] Verify error:', error);
    res.status(500).json({ error: 'Error al verificar la transaccion' });
  }
});

/**
 * GET /api/upgrade/history
 * Get user's payment history
 */
router.get('/history', (req, res) => {
  if (!req.session.isAuthenticated || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const userId = req.session.user.id;

  try {
    const transactions = queryAll(`
      SELECT pt.*, s.plan_id, s.status as subscription_status
      FROM payment_transactions pt
      LEFT JOIN subscriptions s ON pt.subscription_id = s.id
      WHERE pt.user_id = ?
      ORDER BY pt.created_at DESC
      LIMIT 20
    `, [userId]);

    res.json({
      transactions: transactions.map(t => ({
        id: t.transaction_id,
        planId: t.plan_id,
        planName: PREMIUM_PLANS[t.plan_id]?.name,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        subscriptionStatus: t.subscription_status,
        createdAt: t.created_at
      }))
    });
  } catch (error) {
    console.error('[Upgrade] History error:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

export default router;
