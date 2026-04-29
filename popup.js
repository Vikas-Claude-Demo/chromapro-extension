document.addEventListener('DOMContentLoaded', () => {
  const pickBtn = document.getElementById('pickBtn');
  const clearHistory = document.getElementById('clearHistory');
  const colorPreview = document.getElementById('colorPreview');
  const hexText = document.getElementById('hexText');
  const rgbText = document.getElementById('rgbText');
  const hslText = document.getElementById('hslText');
  const contrastBadge = document.getElementById('contrastBadge');
  const toast = document.getElementById('toast');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const historyGrid = document.getElementById('historyGrid');
  const paletteGrid = document.getElementById('paletteGrid');

  let currentHex = '#6366f1';
  let currentPaletteMode = 'tints';

  // Load history on start
  loadHistory();

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPaletteMode = btn.dataset.mode;
      generatePalette(currentHex);
    });
  });

  // EyeDropper API
  pickBtn.addEventListener('click', async () => {
    if (!window.EyeDropper) {
      alert("Your browser doesn't support the EyeDropper API");
      return;
    }

    const eyeDropper = new EyeDropper();
    try {
      const result = await eyeDropper.open();
      updateColor(result.sRGBHex);
      saveToHistory(result.sRGBHex);
    } catch (e) {
      console.error("Color picking failed", e);
    }
  });

  // Copy on row click
  document.querySelectorAll('.value-row').forEach(row => {
    row.addEventListener('click', () => {
      const value = row.querySelector('.value').textContent;
      copyToClipboard(value);
    });
  });

  clearHistory.addEventListener('click', () => {
    chrome.storage.local.set({ colorHistory: [] }, () => {
      loadHistory();
    });
  });

  function updateColor(color) {
    const parsed = parseColor(color);
    currentHex = parsed.hex;
    
    colorPreview.style.backgroundColor = `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`;
    
    hexText.textContent = parsed.hex.toUpperCase();
    rgbText.textContent = `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`;
    
    const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
    hslText.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    
    updateContrastBadge(parsed.r, parsed.g, parsed.b);
    generatePalette(parsed.hex);
  }

  function updateContrastBadge(r, g, b) {
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isDark = luminance < 0.5;
    contrastBadge.textContent = isDark ? 'White Text' : 'Black Text';
    contrastBadge.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    contrastBadge.style.color = isDark ? '#fff' : '#000';
  }

  function parseColor(color) {
    let r = 0, g = 0, b = 0, a = 1, hex = '#000000';

    if (color.startsWith('#')) {
      hex = color;
      if (color.length === 4) {
        r = parseInt(color[1] + color[1], 16);
        g = parseInt(color[2] + color[2], 16);
        b = parseInt(color[3] + color[3], 16);
      } else {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
      }
    } else if (color.startsWith('rgb')) {
      const values = color.match(/\d+/g);
      if (values) {
        r = parseInt(values[0]);
        g = parseInt(values[1]);
        b = parseInt(values[2]);
        hex = rgbToHex(r, g, b);
      }
    }
    return { r, g, b, a, hex };
  }

  function saveToHistory(color) {
    const parsed = parseColor(color);
    chrome.storage.local.get(['colorHistory'], (result) => {
      let history = result.colorHistory || [];
      if (!history.includes(parsed.hex)) {
        history.unshift(parsed.hex);
        history = history.slice(0, 12);
        chrome.storage.local.set({ colorHistory: history }, () => {
          loadHistory();
        });
      }
    });
  }

  function loadHistory() {
    chrome.storage.local.get(['colorHistory'], (result) => {
      const history = result.colorHistory || [];
      historyGrid.innerHTML = '';
      history.forEach(hex => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.style.backgroundColor = hex;
        item.title = hex;
        item.onclick = (e) => {
          if (e.shiftKey) copyToClipboard(hex);
          else updateColor(hex);
        };
        historyGrid.appendChild(item);
      });
    });
  }

  function generatePalette(hex) {
    paletteGrid.innerHTML = '';
    const parsed = parseColor(hex);
    let colors = [];

    if (currentPaletteMode === 'tints') {
      const variations = [0.4, 0.6, 0.8, 1, 1.2, 1.4];
      colors = variations.map(v => {
        const r = Math.min(255, Math.floor(parsed.r * v));
        const g = Math.min(255, Math.floor(parsed.g * v));
        const b = Math.min(255, Math.floor(parsed.b * v));
        return rgbToHex(r, g, b);
      });
    } else if (currentPaletteMode === 'complementary') {
      const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
      colors = [0, 180].map(deg => {
        const h = (hsl.h + deg) % 360;
        return hslToHex(h, hsl.s, hsl.l);
      });
    } else if (currentPaletteMode === 'analogous') {
      const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
      colors = [-30, -15, 0, 15, 30, 45].map(deg => {
        const h = (hsl.h + deg + 360) % 360;
        return hslToHex(h, hsl.s, hsl.l);
      });
    }
    
    colors.forEach(c => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.style.backgroundColor = c;
      item.onclick = () => updateColor(c);
      paletteGrid.appendChild(item);
    });
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
});
