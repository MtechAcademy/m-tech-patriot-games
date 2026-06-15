import { listenGame, joinPlayer, submitAnswer, Q, roundFor } from './app.js';

let game = null;
let selected = null;
let submitted = false;
let timerHandle = null;
let currentQuestionIndex = null;

const $ = id => document.getElementById(id);

const ideas = [
  'Spring Slayer',
  'CAT5 Commander',
  'Uncle Slam',
  'Liberty Springs',
  'Dispatch Me Maybe',
  'WFC Warrior',
  'Stars & Struts',
  'Captain Closeout',
  'Door Whisperer',
  'The Torsion Patriot'
];

$('suggestions').innerHTML = ideas.map(x => `<button class="pill" type="button">${x}</button>`).join('');

document.querySelectorAll('.pill').forEach(b => {
  b.onclick = () => {
    $('name').value = b.textContent;
  };
});

const leaveBtn = document.getElementById('leaveBtn');

if (leaveBtn) {
  leaveBtn.onclick = () => {
    localStorage.removeItem('mtechPlayerId');
    localStorage.removeItem('mtechPlayerName');
    location.reload();
  };
}

$('joinBtn').onclick = async () => {
  try {
    await joinPlayer($('name').value);
    $('welcome').textContent = `Welcome, ${localStorage.getItem('mtechPlayerName')}`;
    render();
  } catch (e) {
    $('joinError').textContent = e.message;
  }
};

if (localStorage.getItem('mtechPlayerId')) {
  $('welcome').textContent = `Welcome back, ${localStorage.getItem('mtechPlayerName') || 'player'}`;
}

listenGame(g => {
  game = g;
  render();
});

function show(id) {
  ['join', 'waiting', 'questionBox', 'reveal', 'final'].forEach(x => {
    $(x).classList.toggle('hidden', x !== id);
  });
}

function render() {
  if (!localStorage.getItem('mtechPlayerId')) {
    show('join');
    return;
  }

  if (!game || game.status === 'lobby' || game.status === 'checkpoint') {
    show('waiting');
    return;
  }

  if (game.status === 'question') {
    renderQuestion();
    return;
  }

  if (game.status === 'reveal') {
    renderReveal();
    return;
  }

  if (game.status === 'final') {
    show('final');
  }
}

function renderQuestion() {
  const i = game.questionIndex;
  const q = Q[i];
  const round = roundFor(i);

  if (currentQuestionIndex !== i) {
    selected = null;
    submitted = false;
    currentQuestionIndex = i;
  }

  show('questionBox');

  $('qMeta').textContent = `Question ${i + 1} of ${Q.length} • ${round.name}`;
  $('question').textContent = q.q;
  $('answerStatus').textContent = submitted ? 'Answer locked.' : '';

  $('choices').innerHTML = q.choices.map((c, idx) => {
    const selectedClass = selected === idx ? ' selected' : '';
    return `<button class="choice${selectedClass}" data-i="${idx}" ${submitted ? 'disabled' : ''}>${String.fromCharCode(65 + idx)}. ${esc(c)}</button>`;
  }).join('');

  document.querySelectorAll('.choice').forEach(b => {
    b.onclick = async () => {
      if (submitted) return;

      submitted = true;
      selected = Number(b.dataset.i);
      $('answerStatus').textContent = 'Answer locked.';

      await submitAnswer(
        localStorage.getItem('mtechPlayerId'),
        localStorage.getItem('mtechPlayerName'),
        i,
        selected,
        game.questionStartedAt
      );

      renderQuestion();
    };
  });

  tick();
  clearInterval(timerHandle);
  timerHandle = setInterval(tick, 250);
}

function tick() {
  if (!game?.questionStartedAt) return;

  const left = Math.max(0, 20 - Math.floor((Date.now() - game.questionStartedAt) / 1000));
  $('timer').textContent = left;

  if (left === 0 && !submitted) {
    submitted = true;
    $('answerStatus').textContent = 'Time is up.';
    renderQuestion();
  }
}

function renderReveal() {
  const i = game.questionIndex;
  const q = Q[i];

  show('reveal');

  $('revealMsg').textContent =
    selected === q.correct ? 'Correct!' :
    selected == null ? 'Time is up.' :
    'Not this time.';

  $('correctText').textContent =
    `Correct answer: ${String.fromCharCode(65 + q.correct)}. ${q.choices[q.correct]}`;
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[c]));
}
