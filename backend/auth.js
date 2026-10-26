import crypto from 'crypto';
import { get } from './database/db.js';

// Secret key for HMAC signature
const JWT_SECRET = process.env.JWT_SECRET || 'carebridge_master_production_secret_key_2026';

/**
 * Password Hashing using PBKDF2 (Native Node.js Crypto)
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

/**
 * Light Token Generator (Base64 + HMAC SHA256 Signature)
 */
export function generateToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    specialty: user.specialty,
    doctor_id: user.doctor_id || null,
    token_version: user.token_version !== undefined ? user.token_version : 1,
    exp: Math.floor(Date.now() / 1000) + (24 * 3600) // 24 hours
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Express Middleware: Authenticate Token
 */
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    }

    const user = verifyToken(token);
    if (!user) {
      return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }

    // Check token version & user status in database for active session validation
    const dbUser = await get('SELECT status, token_version FROM users WHERE id = ?', [user.id]);
    if (!dbUser || dbUser.status === 'INACTIVE' || (user.token_version !== undefined && dbUser.token_version !== user.token_version)) {
      return res.status(401).json({ error: 'Session invalidated or account disabled. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication processing failed.' });
  }
}

/**
 * Express Middleware: Require Specific Role(s)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const userRole = req.user.role;
    const normalizedUserRole = userRole === 'ADMIN' ? 'ADMINISTRATOR' : userRole;
    const normalizedAllowedRoles = allowedRoles.map(r => r === 'ADMIN' ? 'ADMINISTRATOR' : r);

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({ error: `Access denied. Role '${userRole}' is unauthorized for this resource.` });
    }
    next();
  };
}
