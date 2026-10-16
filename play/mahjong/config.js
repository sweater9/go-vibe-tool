// Public endpoint only. Set the HTTPS service URL after backend review and approval.
// Never put credentials here. Local development is intentionally separate.
window.MAHJONG_API = ['localhost','127.0.0.1'].includes(location.hostname) ? 'http://localhost:8787' : '';
