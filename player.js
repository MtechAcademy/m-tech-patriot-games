import { listenGame, joinPlayer, submitAnswer, Q, roundFor } from './app.js';
let game=null, selected=null, submitted=false, timerHandle=null;
const $ = id => document.getElementById(id);
const ideas = ['Spring Slayer','CAT5 Commander','Uncle Slam','Liberty Springs','Dispatch Me Maybe','WFC Warrior','Stars & Struts','Captain Closeout','Door Whisperer','The Torsion Patriot'];
$('suggestions').innerHTML = ideas.map(x=>`<button class="pill" type="button">${x}</button>`).join('');
document.querySelectorAll('.pill').forEach(b=>b.onclick=()=>{$('name').value=b.textContent});
$('joinBtn').onclick = async()=>{
  try{ await joinPlayer($('name').value); $('join').classList.add('hidden'); $('waiting').classList.remove('hidden'); $('welcome').textContent = `Welcome, ${localStorage.getItem('mtechPlayerName')}`; }
  catch(e){ $('joinError').textContent = e.message; }
};
if(localStorage.getItem('mtechPlayerId')){ $('join').classList.add('hidden'); $('waiting').classList.remove('hidden'); $('welcome').textContent = `Welcome back, ${localStorage.getItem('mtechPlayerName')||'player'}`; }
listenGame(g=>{ game=g; render(); });
function show(id){ ['waiting','questionBox','reveal','final'].forEach(x=>$(x).classList.toggle('hidden',x!==id)); }
function render(){
  if(!game) return;
  if(game.status==='lobby'||game.status==='checkpoint') show('waiting');
  if(game.status==='question') renderQuestion();
  if(game.status==='reveal') renderReveal();
  if(game.status==='final') show('final');
}
function renderQuestion(){
  const i=game.questionIndex, q=Q[i], round=roundFor(i);
  show('questionBox'); selected=null; submitted=false;
  $('qMeta').textContent = `Question ${i+1} of ${Q.length} • ${round.name}`;
  $('question').textContent = q.q;
  $('answerStatus').textContent = '';
  $('choices').innerHTML = q.choices.map((c,idx)=>`<button class="choice" data-i="${idx}">${String.fromCharCode(65+idx)}. ${esc(c)}</button>`).join('');
  document.querySelectorAll('.choice').forEach(b=>b.onclick=async()=>{
    if(submitted) return; submitted=true; selected=Number(b.dataset.i); b.classList.add('selected');
    $('answerStatus').textContent='Answer locked.';
    await submitAnswer(localStorage.getItem('mtechPlayerId'), localStorage.getItem('mtechPlayerName'), i, selected, game.questionStartedAt);
  });
  tick(); clearInterval(timerHandle); timerHandle=setInterval(tick,250);
}
function tick(){
  if(!game?.questionStartedAt) return;
  const left = Math.max(0, 20 - Math.floor((Date.now()-game.questionStartedAt)/1000));
  $('timer').textContent = left;
}
function renderReveal(){
  const i=game.questionIndex, q=Q[i]; show('reveal');
  $('revealMsg').textContent = selected===q.correct ? 'Correct!' : selected==null ? 'Time is up.' : 'Not this time.';
  $('correctText').textContent = `Correct answer: ${String.fromCharCode(65+q.correct)}. ${q.choices[q.correct]}`;
}
function esc(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
