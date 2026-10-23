function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  body { margin: 0; background: #f4f6f8; color: #1b1d21; font-family: system-ui, sans-serif; }
  main { max-width: 28rem; margin: 0 auto; padding: 2.5rem 1.25rem 3rem; }
  h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 0.5rem; }
  p { line-height: 1.45; }
  label { display: block; font-weight: 650; margin: 1rem 0 0.4rem; }
  input[type="email"] { width: 100%; box-sizing: border-box; font-size: 1rem; padding: 0.8rem; border: 1px solid #c5cad1; border-radius: 0.6rem; }
  .check { display: flex; gap: 0.6rem; align-items: flex-start; margin: 1rem 0; font-weight: 450; }
  button, a.wallet { display: block; width: 100%; box-sizing: border-box; margin-top: 0.75rem; padding: 0.95rem 1rem; border-radius: 0.7rem; font-size: 1rem; text-align: center; text-decoration: none; }
  button { border: 0; background: #111; color: #fff; }
  a.apple { background: #111; color: #fff; }
  a.google { background: #fff; color: #111; border: 1px solid #c5cad1; }
  .error { color: #8d1d1d; }
  img { width: 240px; height: 240px; background: #fff; border-radius: 0.7rem; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

function claimForm({ siteSlug, pass, error }) {
  const notice = error ? `<p class="error">${esc(error)}</p>` : "";
  return layout({
    title: "Add to wallet",
    body: `<h1>Add this pass to your wallet</h1>
<p>Enter your email. On a phone, Apple Wallet or Google Wallet opens next.</p>
${notice}
<form method="post" action="/wallet">
<input type="hidden" name="site" value="${esc(siteSlug)}">
<input type="hidden" name="pass" value="${esc(pass)}">
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email" maxlength="254" required>
<label class="check"><input type="checkbox" name="consent" value="yes" required> I agree to share this email so this pass can be created for me.</label>
<button type="submit">Continue</button>
</form>`,
  });
}

function fallbackPage({ addUrl, qrDataUrl }) {
  const href = esc(addUrl);
  return layout({
    title: "Add to wallet",
    body: `<h1>Add this pass</h1>
<p>On a phone, use a button. Or scan this code with the phone that should keep the pass.</p>
<a class="wallet apple" href="${href}">Add to Apple Wallet</a>
<a class="wallet google" href="${href}">Add to Google Wallet</a>
<p><img alt="QR code for this pass" src="${esc(qrDataUrl)}"></p>`,
  });
}

function messagePage(title, message) {
  return layout({
    title,
    body: `<h1>${esc(title)}</h1><p>${esc(message)}</p>`,
  });
}

module.exports = {
  claimForm,
  fallbackPage,
  messagePage,
};
