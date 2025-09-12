try {
  var t = localStorage.getItem('theme');
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    // Por defecto: modo claro
    document.documentElement.classList.remove('dark');
  }
} catch (e) {}
