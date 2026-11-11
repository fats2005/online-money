const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'moneygain.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false });
app.use(['/api/register', '/api/verify-otp', '/api/login'], authLimiter);

function readUsers() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeUsers(users) { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }
function makeRef() { return crypto.randomBytes(5).toString('hex'); }
function validPassword(p) {
  return typeof p === 'string' && p.length >= 10 &&
    /[A-Za-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
}
function hashOtp(code) { return crypto.createHash('sha256').update(code).digest('hex'); }
function publicUser(u) {
  return { email: u.email, balance: u.balance, referralCode: u.referralCode, verified: u.verified };
}
function requireAuth(req, res, next) {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

async function sendOtp(email, code) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: Number(SMTP_PORT || 587),
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER, to: email,
      subject: 'Your MoneyGain verification code',
      text: `Your MoneyGain verification code is ${code}. It expires in 10 minutes.`
    });
  } else {
    console.log(`\n[LOCAL DEMO ONLY] OTP for ${email}: ${code}\n`);
  }
}

app.post('/api/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!validPassword(password)) return res.status(400).json({ error: 'Use at least 10 characters with letters, numbers and a symbol.' });

  const users = readUsers();
  if (users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });

  const code = String(crypto.randomInt(100000, 1000000));
  const user = {
    email, passwordHash: await bcrypt.hash(password, 12),
    verified: false, otpHash: hashOtp(code), otpExpires: Date.now() + 10 * 60 * 1000,
    balance: 10, referralCode: makeRef(), referredBy: null,
    adCredits: 0, createdAt: new Date().toISOString()
  };
  users.push(user);
  try {
    await sendOtp(email, code);
    writeUsers(users);
    req.session.pendingEmail = email;
    res.json({ message: 'Verification code sent. Check your email.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not send verification email. Check SMTP settings and try again.' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  const email = String(req.body.email || req.session.pendingEmail || '').trim().toLowerCase();
  const code = String(req.body.otp || '').trim();
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user || user.verified) return res.status(400).json({ error: 'No pending verification was found.' });
  if (Date.now() > user.otpExpires || hashOtp(code) !== user.otpHash) return res.status(400).json({ error: 'Incorrect or expired verification code.' });

  user.verified = true;
  delete user.otpHash; delete user.otpExpires;
  const ref = String(req.body.referral || '').trim();
  if (ref) {
    const referrer = users.find(u => u.referralCode === ref && u.email !== user.email && u.verified);
    if (referrer) {
      referrer.balance += 20;
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      user.referredBy = referrer.referralCode;
    }
  }
  writeUsers(users);
  req.session.userEmail = email;
  delete req.session.pendingEmail;
  res.json({ message: 'Account verified successfully.', user: publicUser(user) });
});

app.post('/api/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash)))
    return res.status(401).json({ error: 'Incorrect email or password.' });
  if (!user.verified) return res.status(403).json({ error: 'Please complete email verification first.' });
  req.session.userEmail = email;
  res.json({ message: 'Login successful.', user: publicUser(user) });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = readUsers().find(u => u.email === req.session.userEmail);
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: publicUser(user), referralCount: user.referralCount || 0, adCredits: user.adCredits || 0 });
});

// This endpoint adds DEMO credits only. It is not connected to an ad network.
app.post('/api/demo-ad-credit', requireAuth, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.email === req.session.userEmail);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  user.balance += 10;
  user.adCredits = (user.adCredits || 0) + 1;
  writeUsers(users);
  res.json({ message: 'Demo credit added.', user: publicUser(user), adCredits: user.adCredits });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`MoneyGain running at http://localhost:${PORT}`));
