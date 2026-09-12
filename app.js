// Paletas dos Temas (conforme api/themes.ts)
const themes = {
  light:      { label: "Light",       bg: "#ffffff", border: "#d0d7de", text: "#1f2328", subtext: "#656d76", accent: "#0969da" },
  dark:       { label: "Dark",        bg: "#0d1117", border: "#30363d", text: "#e6edf3", subtext: "#8b949e", accent: "#58a6ff" },
  nord:       { label: "Nord",        bg: "#2e3440", border: "#434c5e", text: "#eceff4", subtext: "#81a1c1", accent: "#88c0d0" },
  gruvbox:    { label: "Gruvbox",     bg: "#282828", border: "#504945", text: "#ebdbb2", subtext: "#a89984", accent: "#fabd2f" },
  tokyonight: { label: "Tokyo Night", bg: "#1a1b26", border: "#292e42", text: "#c0caf5", subtext: "#565f89", accent: "#7aa2f7" },
  onedark:    { label: "One Dark",    bg: "#282c34", border: "#3e4451", text: "#abb2bf", subtext: "#5c6370", accent: "#61afef" },
  spotify:    { label: "Spotify",     bg: "#191414", border: "#282828", text: "#ffffff", subtext: "#b3b3b3", accent: "#1db954" },
  youtube:    { label: "YouTube",     bg: "#0f0f0f", border: "#282828", text: "#ffffff", subtext: "#aaaaaa", accent: "#ff0000" },
  cyberpunk:  { label: "Cyberpunk",   bg: "#0c0813", border: "#ff0055", text: "#ffe600", subtext: "#9d7cd8", accent: "#00f0ff" },
  twitch:     { label: "Twitch",      bg: "#0d0c0f", border: "#9146ff", text: "#f5f5f7", subtext: "#adadb8", accent: "#9146ff" },
};

const COLOR_KEYS = ['bg', 'border', 'text', 'subtext', 'accent'];
const HEX_REGEX = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

let selectedTheme = 'dark';
let debounceTimer;
let previewRequestId = 0;
let selectedCardType = 'github'; // 'github', 'stackoverflow' or 'twitch'

// Elementos DOM
const usernameInput = document.getElementById('username');
const themeSelect = document.getElementById('themeSelect');
const triggerText = document.getElementById('triggerText');
const triggerDots = document.getElementById('triggerDots');
const toggleColors = document.getElementById('toggleColors');
const customColorsSection = document.querySelector('.custom-colors-section');

const previewWrapper = document.getElementById('previewWrapper');
const previewImg = document.getElementById('previewImg');
const placeholder = document.getElementById('placeholder');
const loader = document.getElementById('loader');

const markdownCode = document.getElementById('markdownCode');
const htmlCode = document.getElementById('htmlCode');
const urlCode = document.getElementById('urlCode');

const toast = document.getElementById('toast');

// Inicialização do Custom Dropdown
function initDropdown() {
  Object.entries(themes).forEach(([key, info]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = info.label;
    option.selected = key === selectedTheme;
    themeSelect.appendChild(option);
  });

  updateTriggerContent(selectedTheme);

  themeSelect.addEventListener('change', () => selectTheme(themeSelect.value));
}

function updateTriggerContent(themeKey) {
  const info = themes[themeKey];
  triggerText.textContent = info.label;
  triggerDots.innerHTML = `
    <div class="theme-dot" style="background-color: ${info.bg}"></div>
    <div class="theme-dot" style="background-color: ${info.accent}"></div>
    <div class="theme-dot" style="background-color: ${info.text}"></div>
  `;
}

function selectTheme(themeKey) {
  selectedTheme = themeKey;

  updateTriggerContent(themeKey);

  syncColorInputs(themeKey);
  updatePreview();
}

// Sincroniza os inputs de texto e os pickers de cor com o tema atual se não forem customizados
function syncColorInputs(themeKey) {
  const info = themes[themeKey];
  COLOR_KEYS.forEach(key => {
    const textInput = document.getElementById(`color-${key}`);
    const pickerInput = document.getElementById(`color-${key}-picker`);
    if (textInput && pickerInput) {
      const val = textInput.value.trim();
      if (!val) {
        pickerInput.value = info[key];
      }
    }
  });
}

// Gerador de URLs e Snippets
function getCardUrl(username, theme) {
  const host = window.location.origin;
  let urlStr = '';
  if (selectedCardType === 'github') {
    urlStr = `${host}/api?provider=github&username=${encodeURIComponent(username)}&theme=${encodeURIComponent(theme)}`;
  } else if (selectedCardType === 'stackoverflow') {
    urlStr = `${host}/api?provider=stackoverflow&id=${encodeURIComponent(username)}&theme=${encodeURIComponent(theme)}`;
  } else {
    urlStr = `${host}/api?provider=twitch&channel=${encodeURIComponent(username)}&theme=${encodeURIComponent(theme)}`;
  }

  // Apenas adiciona cores customizadas se o toggle estiver ativo
  if (toggleColors && toggleColors.checked) {
    COLOR_KEYS.forEach(key => {
      const textInput = document.getElementById(`color-${key}`);
      if (textInput) {
        const val = textInput.value.trim();
        if (val && HEX_REGEX.test(val)) {
          urlStr += `&${key}=${encodeURIComponent(val)}`;
        }
      }
    });
  }
  return urlStr;
}

function getCardUrlForSnippet(username, theme) {
  return getCardUrl(username, theme);
}

function getProfileUrl(username) {
  if (selectedCardType === 'github') {
    return `https://github.com/${encodeURIComponent(username)}`;
  } else if (selectedCardType === 'stackoverflow') {
    return `https://stackoverflow.com/users/${encodeURIComponent(username)}`;
  } else {
    return `https://twitch.tv/${encodeURIComponent(username)}`;
  }
}

function updateSnippets(username) {
  let cardTypeLabel = 'GitHub Card';
  if (selectedCardType === 'stackoverflow') {
    cardTypeLabel = 'Stack Overflow Card';
  } else if (selectedCardType === 'twitch') {
    cardTypeLabel = 'Twitch Status Card';
  }

  if (!username) {
    markdownCode.textContent = `[![${cardTypeLabel}](...)...`;
    htmlCode.textContent = '<a href="..."...';
    urlCode.textContent = 'https://...';
    return;
  }

  const cardUrl = getCardUrlForSnippet(username, selectedTheme);
  const profileUrl = getProfileUrl(username);

  const markdown = `[![${cardTypeLabel}](${cardUrl})](${profileUrl})`;
  const html = `<a href="${profileUrl}"><img src="${cardUrl}" alt="${cardTypeLabel}" /></a>`;

  markdownCode.textContent = markdown;
  htmlCode.textContent = html;
  urlCode.textContent = cardUrl;
}

// Controle de Preview e Loader
function updatePreview() {
  const requestId = ++previewRequestId;
  clearTimeout(debounceTimer);
  const username = usernameInput.value.trim();
  updateSnippets(username);

  if (!username) {
    previewImg.style.display = 'none';
    placeholder.style.display = 'flex';
    loader.style.display = 'none';
    previewWrapper.classList.remove('loading');
    return;
  }

  loader.style.display = 'block';
  placeholder.style.display = 'none';
  previewWrapper.classList.add('loading');

  const cardUrl = getCardUrl(username, selectedTheme);

  const tempImg = new Image();

  tempImg.onload = () => {
    if (requestId !== previewRequestId) return;
    previewImg.src = cardUrl;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
    loader.style.display = 'none';
    previewWrapper.classList.remove('loading');
  };

  tempImg.onerror = () => {
    if (requestId !== previewRequestId) return;
    previewImg.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.querySelector('.placeholder-text').textContent = 'Erro ao carregar o cartão. Tente novamente.';
    loader.style.display = 'none';
    previewWrapper.classList.remove('loading');
  };

  tempImg.src = cardUrl;
}

// Copiar Texto para Clipboard
function setupCopyBtn(btnId, codeElement) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', () => {
    const text = codeElement.textContent;
    if (!text || text.includes('...') || text === 'https://...') return;

    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" fill="currentColor"/>
        </svg>
      `;

      showToast();

      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
          </svg>
        `;
      }, 2000);
    });
  });
}

function showToast() {
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Event Listeners
const btnTypeGithub = document.getElementById('btnTypeGithub');
const btnTypeStackoverflow = document.getElementById('btnTypeStackoverflow');
const btnTypeTwitch = document.getElementById('btnTypeTwitch');
const inputLabel = document.getElementById('inputLabel');
const inputIconGithub = document.getElementById('inputIconGithub');
const inputIconStackoverflow = document.getElementById('inputIconStackoverflow');
const inputIconTwitch = document.getElementById('inputIconTwitch');
const subtitleText = document.getElementById('subtitleText');
const placeholderText = placeholder.querySelector('.placeholder-text');

btnTypeGithub.addEventListener('click', () => {
  if (selectedCardType === 'github') return;
  selectedCardType = 'github';
  btnTypeGithub.classList.add('active');
  btnTypeStackoverflow.classList.remove('active');
  btnTypeTwitch.classList.remove('active');

  inputLabel.textContent = 'Usuário do GitHub';
  usernameInput.placeholder = 'Digite seu username (ex: octocat)';
  inputIconGithub.style.display = 'flex';
  inputIconStackoverflow.style.display = 'none';
  inputIconTwitch.style.display = 'none';
  subtitleText.textContent = 'Gere cartões dinâmicos e elegantes das suas estatísticas do GitHub';
  placeholderText.textContent = 'Digite um username para carregar o preview.';
  previewImg.alt = 'GitHub Profile Card';

  usernameInput.value = '';
  updatePreview();
});

btnTypeStackoverflow.addEventListener('click', () => {
  if (selectedCardType === 'stackoverflow') return;
  selectedCardType = 'stackoverflow';
  btnTypeStackoverflow.classList.add('active');
  btnTypeGithub.classList.remove('active');
  btnTypeTwitch.classList.remove('active');

  inputLabel.textContent = 'User ID do Stack Overflow';
  usernameInput.placeholder = 'Digite seu ID numérico (ex: 1)';
  inputIconGithub.style.display = 'none';
  inputIconStackoverflow.style.display = 'flex';
  inputIconTwitch.style.display = 'none';
  subtitleText.textContent = 'Gere cartões dinâmicos e elegantes da sua reputação do Stack Overflow';
  placeholderText.textContent = 'Digite um ID numérico para carregar o preview.';
  previewImg.alt = 'Stack Overflow Profile Card';

  usernameInput.value = '';
  updatePreview();
});

btnTypeTwitch.addEventListener('click', () => {
  if (selectedCardType === 'twitch') return;
  selectedCardType = 'twitch';
  btnTypeTwitch.classList.add('active');
  btnTypeGithub.classList.remove('active');
  btnTypeStackoverflow.classList.remove('active');

  inputLabel.textContent = 'Canal da Twitch';
  usernameInput.placeholder = 'Digite o nome do canal (ex: jerma985)';
  inputIconGithub.style.display = 'none';
  inputIconStackoverflow.style.display = 'none';
  inputIconTwitch.style.display = 'flex';
  subtitleText.textContent = 'Gere cartões dinâmicos e elegantes do status da sua stream na Twitch';
  placeholderText.textContent = 'Digite o nome do canal para carregar o preview.';
  previewImg.alt = 'Twitch Status Card';

  usernameInput.value = '';
  updatePreview();
});

usernameInput.addEventListener('input', () => {
  ++previewRequestId;
  clearTimeout(debounceTimer);
  if (!usernameInput.value.trim()) {
    updatePreview();
    return;
  }

  debounceTimer = setTimeout(updatePreview, 400);
});

toggleColors.addEventListener('change', () => {
  if (toggleColors.checked) {
    customColorsSection.classList.add('visible');
  } else {
    customColorsSection.classList.remove('visible');
  }
  updatePreview();
});

const btnClearColors = document.getElementById('btnClearColors');
if (btnClearColors) {
  btnClearColors.addEventListener('click', () => {
    COLOR_KEYS.forEach(key => {
      const textInput = document.getElementById(`color-${key}`);
      const pickerInput = document.getElementById(`color-${key}-picker`);
      if (textInput && pickerInput) {
        textInput.value = '';
        pickerInput.value = themes[selectedTheme][key];
      }
    });
    updatePreview();
  });
}

COLOR_KEYS.forEach(key => {
  const textInput = document.getElementById(`color-${key}`);
  const pickerInput = document.getElementById(`color-${key}-picker`);

  if (textInput && pickerInput) {
    pickerInput.addEventListener('input', () => {
      const val = pickerInput.value.replace('#', '');
      textInput.value = val;
      updatePreview();
    });

    textInput.addEventListener('input', () => {
      ++previewRequestId;
      const val = textInput.value.trim();
      if (val && HEX_REGEX.test(val)) {
        let hexColor = val;
        if (hexColor.length === 3) {
          hexColor = hexColor.split('').map(c => c + c).join('');
        }
        pickerInput.value = `#${hexColor}`;
      } else {
        pickerInput.value = themes[selectedTheme][key];
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 400);
    });
  }
});

// Inicialização
initDropdown();
syncColorInputs(selectedTheme);
setupCopyBtn('btnCopyMarkdown', markdownCode);
setupCopyBtn('btnCopyHtml', htmlCode);
setupCopyBtn('btnCopyUrl', urlCode);
