fetch('https://script-auth-api.vercel.app/api/verify', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ code:'ACT-2025-1234-ABCD', host:'test', ua:'test' })
}).then(r=>r.text()).then(console.log)
