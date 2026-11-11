const $ = id => document.getElementById(id);
let pendingEmail = '';
let referral = new URLSearchParams(location.search).get('ref') || '';
let adInterval = null;

function showMessage(message, error=false) {
  $('authMessage').textContent = message;
  $('authMessage').className = 'message' + (error ? ' error' : '');
}
function showForm(which) {
  ['signupForm','otpForm','loginForm'].forEach(id => $(id).classList.toggle('hidden', id !== which));
  $('signupTab').classList.toggle('active', which === 'signupForm');
  $('loginTab').classList.toggle('active', which === 'loginForm');
  showMessage('');
}
async function api(url, data) {
  const r = await fetch(url, {method: data ? 'POST' : 'GET', headers: data ? {'Content-Type':'application/json'} : {}, body: data ? JSON.stringify(data) : undefined});
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'Something went wrong.');
  return result;
}
$('signupTab').onclick = () => showForm('signupForm');
$('loginTab').onclick = () => showForm('loginForm');
$('backSignup').onclick = () => showForm('signupForm');

$('signupForm').onsubmit = async e => {
  e.preventDefault(); showMessage('Sending verification code…');
  try {
    pendingEmail = $('signupEmail').value.trim();
    const result = await api('/api/register', {email:pendingEmail, password:$('signupPassword').value});
    showForm('otpForm'); showMessage(result.message);
  } catch(err) { showMessage(err.message, true); }
};
$('otpForm').onsubmit = async e => {
  e.preventDefault(); showMessage('Checking your code…');
  try {
    const result = await api('/api/verify-otp', {email:pendingEmail, otp:$('otpInput').value, referral});
    showMessage(result.message); await loadDashboard();
  } catch(err) { showMessage(err.message, true); }
};
$('loginForm').onsubmit = async e => {
  e.preventDefault(); showMessage('Logging in…');
  try {
    await api('/api/login', {email:$('loginEmail').value.trim(), password:$('loginPassword').value});
    await loadDashboard();
  } catch(err) { showMessage(err.message, true); }
};

async function loadDashboard() {
  try {
    const data = await api('/api/me');
    $('authView').classList.add('hidden'); $('dashboardView').classList.remove('hidden');
    $('welcomeEmail').textContent = data.user.email;
    $('balance').textContent = '$' + Number(data.user.balance).toFixed(2);
    $('refLink').value = location.origin + '/?ref=' + encodeURIComponent(data.user.referralCode);
    $('refCount').textContent = data.referralCount;
    $('adCount').textContent = data.adCredits;
  } catch (_) {
    $('dashboardView').classList.add('hidden'); $('authView').classList.remove('hidden');
  }
}
$('watchBtn').onclick = () => {
  if (adInterval) return;
  let seconds = 10;
  $('watchBtn').disabled = true;
  $('watchBtn').textContent = 'Please wait…';
  $('adStatus').textContent = 'Demo preview in progress.';
  $('adTimer').textContent = seconds;
  adInterval = setInterval(async () => {
    seconds--; $('adTimer').textContent = seconds;
    if (seconds <= 0) {
      clearInterval(adInterval); adInterval = null;
      try {
        await api('/api/demo-ad-credit', {});
        await loadDashboard();
        $('adStatus').textContent = 'A simulated $10 credit was added to your demo balance.';
      } catch(err) { $('adStatus').textContent = err.message; }
      $('watchBtn').disabled = false; $('watchBtn').textContent = 'Start demo ad';
      $('adTimer').textContent = '✓';
    }
  }, 1000);
};
$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText($('refLink').value); $('copyBtn').textContent = 'Copied!'; setTimeout(()=>$('copyBtn').textContent='Copy',1500); }
  catch (_) { $('refLink').select(); document.execCommand('copy'); $('copyBtn').textContent='Copied!'; }
};
$('logoutBtn').onclick = async () => { await api('/api/logout', {}); $('dashboardView').classList.add('hidden'); $('authView').classList.remove('hidden'); showForm('loginForm'); };
$('year').textContent = new Date().getFullYear();
loadDashboard();
