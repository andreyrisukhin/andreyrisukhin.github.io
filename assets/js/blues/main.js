const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const BLUES_SCALE = [0, 3, 5, 6, 7, 10]; // 1, b3, 4, b5, 5, b7
const BLUE_NOTE_INDEX = 3; // b5 is at position 3 in the scale array

// Each progression is 12 bars: { deg: semitone offset, suf: chord suffix, roman: roman numeral label }
const PROGRESSIONS = {
  standard: [
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 7, suf: '7', roman: 'V7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 7, suf: '7', roman: 'V7' },
  ],
  quickChange: [
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 7, suf: '7', roman: 'V7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 7, suf: '7', roman: 'V7' },
  ],
  jazz: [
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 5, suf: '7', roman: 'IV7' },
    { deg: 6, suf: '\u00B07', roman: '#IV\u00B07' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 9, suf: '7', roman: 'VI7' },
    { deg: 2, suf: 'm7', roman: 'ii\u20137' },
    { deg: 7, suf: '7', roman: 'V7' },
    { deg: 0, suf: '7', roman: 'I7' },
    { deg: 7, suf: '7', roman: 'V7' },
  ],
};

function transposeNote(semitones, root) {
  return NOTE_NAMES[(semitones + root) % 12];
}

function getChordName(descriptor, root) {
  return transposeNote(descriptor.deg, root) + descriptor.suf;
}

function renderGrid(variant, root) {
  const grid = document.getElementById('blues-grid');
  grid.innerHTML = '';
  const bars = PROGRESSIONS[variant];

  bars.forEach((bar, i) => {
    const cell = document.createElement('div');
    cell.className = 'blues-cell';

    const chord = document.createElement('div');
    chord.className = 'blues-chord';
    chord.textContent = getChordName(bar, root);

    const degree = document.createElement('div');
    degree.className = 'blues-degree';
    degree.textContent = bar.roman;

    cell.appendChild(chord);
    cell.appendChild(degree);
    grid.appendChild(cell);
  });
}

function renderScale(root) {
  const container = document.getElementById('blues-scale-notes');
  container.innerHTML = '';

  BLUES_SCALE.forEach((interval, i) => {
    const pill = document.createElement('span');
    pill.className = 'blues-note';
    if (i === BLUE_NOTE_INDEX) pill.classList.add('blues-note--blue');
    pill.textContent = transposeNote(interval, root);
    container.appendChild(pill);
  });
}

function render() {
  const root = parseInt(document.getElementById('blues-key').value, 10);
  const activeBtn = document.querySelector('.blues-variant-btn.is-active');
  const variant = activeBtn ? activeBtn.dataset.variant : 'standard';

  renderGrid(variant, root);
  renderScale(root);
}

function init() {
  const select = document.getElementById('blues-key');
  NOTE_NAMES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    select.appendChild(opt);
  });

  select.addEventListener('change', render);

  document.querySelectorAll('.blues-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.blues-variant-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      render();
    });
  });

  render();
}

init();
