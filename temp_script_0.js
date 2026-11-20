
(function(){
  document.documentElement.setAttribute('data-theme', localStorage.getItem('si_theme') || 'light');
  const token = sessionStorage.getItem('schiller_token');
  const role = String(sessionStorage.getItem('schiller_role') || '').toLowerCase();
  if (!token || !['admin','superadmin','administrator'].includes(role)) window.location.href = 'login.html';
})();
