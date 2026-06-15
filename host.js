import { ensureGame, listenGame, listenPlayers, Q, roundFor, startQuestion, revealAnswer, showCheckpoint, finishGame, resetGame, sortedPlayers } from './app.js';

let game=null, players=[], timerHandle=null;
const checkpoints = [2,6,10];
const $ = id => document.getElementById(id);
const playerUrl = location.href.replace('host.html','player.html');
new QRCode($('qrcode'), { text: playerUrl, width: 220, height: 220 });
$('joinUrl').textContent = playerUrl;

await ensureGame();
listenPlayers(p => { players=p; renderPlayers(); renderLeaderboard(); });
listenGame(g => { game=g; render(); });

$('resetBtn').onclick = async()=>{ if(confirm('Reset this game? This clears the live game state.')) await resetGame(); };
$('startBtn').onclick = ()=> startQuestion(0);
$('revealBtn').onclick = ()=> revealAnswer();
$('nextBtn').onclick = async()=>{
  const i = game.questionIndex;
  if(i === Q.length-1) return finishGame();
  if(checkpoints.includes(i)) return showCheckpoint();
  return startQuestion(i+1);
};
$('continueBtn').onclick = ()=> startQuestion((game?.questionIndex||0)+1);

function show(id){ ['lobby','game','checkpoint','final'].forEach(x=>$(x).classList.toggle('hidden',x!==id)); }
function render(){
  if(!game) return;
  if(game.status==='lobby') show('lobby');
  if(game.status==='question'||game.status==='reveal') { show('game'); renderQuestion(); }
  if(game.status==='checkpoint') { show('checkpoint'); renderLeaderboard(); }
  if(game.status==='final') { show('final'); renderFinal(); }
}
function renderPlayers(){
  $('playersTitle').textContent = `Players Joined (${players.length})`;

  $('players').innerHTML = players.length
    ? players.map(p=>`<span class="player">${esc(p.name)}</span>`).join('')
    : '<p class="small">Waiting for players...</p>';
}
function renderQuestion(){
  const i = game.questionIndex; const q=Q[i]; const round=roundFor(i);
  $('roundName').textContent = round.name;
  $('qMeta').textContent = `Question ${i+1} of ${Q.length} • ${round.name} • ${round.base} points`;
  $('question').textContent = q.q;
  $('choices').innerHTML = q.choices.map((c,idx)=>`<div class="choice ${game.status==='reveal'&&idx===q.correct?'correct':''}">${String.fromCharCode(65+idx)}. ${esc(c)}</div>`).join('');
  $('revealBtn').disabled = game.status==='reveal';
  $('nextBtn').textContent = i===Q.length-1 ? 'Finish Game' : checkpoints.includes(i) ? 'Show Checkpoint' : 'Next Question';
  tick(); clearInterval(timerHandle); timerHandle=setInterval(tick,250);
}
function tick(){
  if(!game?.questionStartedAt || game.status!=='question') { if(game?.status==='reveal') $('timer').textContent='Answer'; return; }
  const left = Math.max(0, 20 - Math.floor((Date.now()-game.questionStartedAt)/1000));
  $('timer').textContent = left;
  if(left===0) revealAnswer();
}
function renderLeaderboard(){
  const top = sortedPlayers(players).slice(0,5);
  $('leaderboard').innerHTML = top.map((p,i)=>`<div class="leader-row"><span>${i+1}. ${esc(p.name)}</span><span>${p.score||0} pts</span></div>`).join('') || '<p>No players yet.</p>';
}
function renderFinal(){
  const sorted = sortedPlayers(players);
  const fastest = players.filter(p=>p.fastestCorrectMs!=null).sort((a,b)=>a.fastestCorrectMs-b.fastestCorrectMs)[0];
  const accuracy = players.slice().sort((a,b)=>(b.correct||0)-(a.correct||0)||(a.totalCorrectMs||999999999)-(b.totalCorrectMs||999999999))[0];
  $('finalAwards').innerHTML = `
    <div class="award">🥇 Patriot Champion: <b>${esc(sorted[0]?.name||'')}</b></div>
    <div class="award">🥈 Liberty Leader: <b>${esc(sorted[1]?.name||'')}</b></div>
    <div class="award">🥉 Stars & Stripes Award: <b>${esc(sorted[2]?.name||'')}</b></div>
    <div class="award">⚡ Paul Revere Award: <b>${esc(fastest?.name||'')}</b> ${fastest?`(${(fastest.fastestCorrectMs/1000).toFixed(2)} sec)`:''}</div>
    <div class="award">🎯 Constitution Award: <b>${esc(accuracy?.name||'')}</b> ${accuracy?`(${accuracy.correct}/${Q.length})`:''}</div>`;
  $('finalBoard').innerHTML = sorted.map((p,i)=>`<div class="leader-row"><span>${i+1}. ${esc(p.name)}</span><span>${p.score||0} pts • ${p.correct||0}/${Q.length}</span></div>`).join('');
}
function esc(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
