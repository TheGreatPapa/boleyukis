function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Returns { src, format, el, width, height }. Non JPEG/PNG images are converted to PNG
// because those are the formats the PDF library embeds reliably.
export async function loadTemplateFromFile(file) {
  let src = await readAsDataURL(file);
  let el = await loadImage(src);
  let format = file.type === 'image/jpeg' ? 'JPEG' : 'PNG';
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    const c = document.createElement('canvas');
    c.width = el.naturalWidth;
    c.height = el.naturalHeight;
    c.getContext('2d').drawImage(el, 0, 0);
    src = c.toDataURL('image/png');
    el = await loadImage(src);
  }
  return { src, format, el, width: el.naturalWidth, height: el.naturalHeight, name: file.name };
}

// A built-in ticket so the app can be tried without uploading anything.
export async function makeSampleTemplate() {
  const W = 1200, H = 450, stub = 300;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1e3a8a');
  g.addColorStop(1, '#7c3aed');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(W - stub, 0, stub, H);

  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W - stub, 0);
  ctx.lineTo(W - stub, H);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px Helvetica, Arial, sans-serif';
  ctx.fillText('SUMMER FEST', 60, 150);
  ctx.font = '40px Helvetica, Arial, sans-serif';
  ctx.fillText('Admit one · Saturday 8 PM', 60, 220);
  ctx.font = 'bold 36px Helvetica, Arial, sans-serif';
  ctx.fillText('Nº', 60, 370);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 32px Helvetica, Arial, sans-serif';
  ctx.fillText('STUB', W - stub + 40, 70);

  const src = c.toDataURL('image/png');
  const el = await loadImage(src);
  return { src, format: 'PNG', el, width: W, height: H, name: 'Sample ticket' };
}
