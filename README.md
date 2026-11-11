# MoneyGain website (demo prototype)

## Included features
- Create account with email and strong password (10+ characters, letters, numbers and symbols).
- Email OTP verification.
- Existing users can log in with email and password.
- Dashboard starts with a **simulated $10 demo balance**.
- A 10-second sample-ad preview adds a **simulated $10 demo credit**.
- Referral link; a verified new account using that link adds a **simulated $20 demo credit** to the referrer's balance.
- Password hashing, session cookies, and basic rate limiting.

## Important: demo only
This project is a functional prototype, not a real money-making or payment platform. The balance and rewards are simulated, have no cash value, and cannot be withdrawn or transferred. The ad preview is not a real advertisement and does not generate ad revenue. Do not claim that users will earn or receive real money from it. Before adding real advertising or payouts, obtain appropriate legal advice and use an ad provider that expressly permits the intended reward model; never simulate ad views or clicks.

## Run on Windows, macOS or Linux
1. Install Node.js 18 or newer.
2. Extract the ZIP folder.
3. Open a terminal in the extracted `moneygain` folder.
4. Run:
   ```bash
   npm install
   ```
5. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET`.
6. Run:
   ```bash
   npm start
   ```
7. Open `http://localhost:3000` in your browser.

## Email OTP setup
For real email delivery, configure SMTP values in `.env`:
- `SMTP_HOST`
- `SMTP_PORT` (usually 587)
- `SMTP_SECURE` (`false` for STARTTLS on port 587; `true` for port 465)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

If SMTP is not configured, the code is printed in the terminal for local testing only. Do not deploy publicly with terminal OTP fallback or the development session secret.

## Deployment notes
This starter stores users in `data/users.json` and uses the default Express in-memory session store. These are suitable only for local demonstration. For production, replace them with a proper database and persistent session store, enable HTTPS, configure secure secrets, add email resend/verification controls, privacy terms, abuse prevention, and a reviewed real-rewards implementation.
