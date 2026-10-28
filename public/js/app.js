const themeToggle = document.getElementById('themeToggle');
const inspectBtn = document.getElementById('inspectBtn');
const sourceUrl = document.getElementById('sourceUrl');
const inspectResult = document.getElementById('inspectResult');

const applyTheme = () => {
  const dark = localStorage.getItem('mediaflow-theme') === 'dark';
  document.body.classList.toggle('dark', dark);
  themeToggle.textContent = dark ? 'Light mode' : 'Dark mode';
};

themeToggle.addEventListener('click', () => {
  localStorage.setItem('mediaflow-theme', document.body.classList.contains('dark') ? 'light' : 'dark');
  applyTheme();
});

inspectBtn.addEventListener('click', async () => {
  const url = sourceUrl.value;
  inspectResult.textContent = 'Inspecting...';

  try {
    const res = await fetch('/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    inspectResult.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    inspectResult.textContent = 'Inspection failed.';
  }
});

document.getElementById('convertImageBtn').addEventListener('click', async () => {
  const file = document.getElementById('imageFile').files[0];
  if (!file) return;
  const body = new FormData();
  body.append('file', file);
  body.append('outputFormat', document.getElementById('imageFormat').value);

  const res = await fetch('/api/convert/image', { method: 'POST', body });
  const data = await res.json();
  document.getElementById('imageOutput').textContent = JSON.stringify(data, null, 2);
});

document.getElementById('convertVideoBtn').addEventListener('click', async () => {
  const file = document.getElementById('videoFile').files[0];
  if (!file) return;
  const body = new FormData();
  body.append('file', file);
  body.append('outputFormat', document.getElementById('videoFormat').value);

  const res = await fetch('/api/convert/video', { method: 'POST', body });
  const data = await res.json();
  document.getElementById('videoOutput').textContent = JSON.stringify(data, null, 2);
});

applyTheme();
