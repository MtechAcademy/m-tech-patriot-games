import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot, serverTimestamp, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.firebaseConfig);
export const db = getFirestore(app);
export const Q = window.MTECH_QUESTIONS;
export const ROUNDS = window.MTECH_ROUNDS;
export const GAME_ID = 'active-game';
export const gameRef = doc(db, 'games', GAME_ID);
export const playersRef = collection(db, 'games', GAME_ID, 'players');
export const answersRef = collection(db, 'games', GAME_ID, 'answers');

export function roundFor(i){ return ROUNDS.find(r => i >= r.start && i <= r.end) || ROUNDS[0]; }
export function scoreFor(base, elapsedMs, final=false){
  const maxBonus = final ? 200 : 100;
  const pct = Math.max(0, Math.min(1, 1 - elapsedMs / 20000));
  return base + Math.round(maxBonus * pct);
}
export function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
export async function getGame(){ const s = await getDoc(gameRef); return s.exists()?s.data():null; }
export async function ensureGame(){
  const g = await getGame();
  if(!g){ await setDoc(gameRef,{status:'lobby',questionIndex:-1,questionStartedAt:null,createdAt:serverTimestamp(),eventName:'M-Tech Patriot Games'}); }
}
export function listenGame(cb){ return onSnapshot(gameRef, s => cb(s.exists()?s.data():null)); }
export function listenPlayers(cb){ return onSnapshot(playersRef, snap => cb(snap.docs.map(d=>({id:d.id,...d.data()})))); }
export function listenAnswers(cb){ return onSnapshot(answersRef, snap => cb(snap.docs.map(d=>({id:d.id,...d.data()})))); }
export async function resetGame(){
  const playerDocs = await getDocs(playersRef);
  await Promise.all(playerDocs.docs.map(d => deleteDoc(d.ref)));

  const answerDocs = await getDocs(answersRef);
  await Promise.all(answerDocs.docs.map(d => deleteDoc(d.ref)));

  await setDoc(gameRef,{
    status:'lobby',
    questionIndex:-1,
    questionStartedAt:null,
    createdAt:serverTimestamp(),
    eventName:'M-Tech Patriot Games'
  });
}
export async function startQuestion(index){ await updateDoc(gameRef,{status:'question',questionIndex:index,questionStartedAt:Date.now()}); }
export async function revealAnswer(){ await updateDoc(gameRef,{status:'reveal'}); }
export async function showCheckpoint(){ await updateDoc(gameRef,{status:'checkpoint'}); }
export async function finishGame(){ await updateDoc(gameRef,{status:'final'}); await archiveFinal(); }
export async function joinPlayer(name){
  const clean = name.trim().slice(0,24);
  if(!clean) throw new Error('Enter a screen name.');
  const existing = await getDocs(query(playersRef, where('nameLower','==',clean.toLowerCase())));
  if(!existing.empty) throw new Error('That screen name is already taken.');
  const id = localStorage.getItem('mtechPlayerId') || uid();
  localStorage.setItem('mtechPlayerId', id);
  await setDoc(doc(playersRef,id),{name:clean,nameLower:clean.toLowerCase(),score:0,correct:0,totalCorrectMs:0,fastestCorrectMs:null,joinedAt:serverTimestamp()});
  localStorage.setItem('mtechPlayerName', clean);
  return id;
}
export async function submitAnswer(playerId, playerName, qIndex, selected, startedAt){
  const q = Q[qIndex]; const elapsedMs = Math.max(0, Date.now() - startedAt);
  const correct = selected === q.correct; const round = roundFor(qIndex); const final = qIndex === Q.length-1;
  const pts = correct ? scoreFor(round.base, elapsedMs, final) : 0;
  const ansId = `${playerId}_${qIndex}`;
  await setDoc(doc(answersRef, ansId),{playerId,playerName,qIndex,selected,correct,elapsedMs,points:pts,createdAt:serverTimestamp()});
  if(correct){
    const pRef = doc(playersRef, playerId); const pSnap = await getDoc(pRef); const p = pSnap.data() || {};
    await updateDoc(pRef,{score:(p.score||0)+pts,correct:(p.correct||0)+1,totalCorrectMs:(p.totalCorrectMs||0)+elapsedMs,fastestCorrectMs:p.fastestCorrectMs==null?elapsedMs:Math.min(p.fastestCorrectMs,elapsedMs)});
  }
}
export function sortedPlayers(players){
  return players.slice().sort((a,b)=> (b.score||0)-(a.score||0) || (b.correct||0)-(a.correct||0) || (a.totalCorrectMs||999999999)-(b.totalCorrectMs||999999999) || (a.name||'').localeCompare(b.name||''));
}
async function archiveFinal(){
  const ps = await getDocs(playersRef); const players = sortedPlayers(ps.docs.map(d=>({id:d.id,...d.data()})));
  if(!players.length) return;
  const fastest = players.filter(p=>p.fastestCorrectMs!=null).sort((a,b)=>a.fastestCorrectMs-b.fastestCorrectMs)[0] || null;
  const accuracy = players.slice().sort((a,b)=>(b.correct||0)-(a.correct||0)|| (a.totalCorrectMs||999999999)-(b.totalCorrectMs||999999999))[0] || null;
  await addDoc(collection(db,'archives'),{eventName:'M-Tech Patriot Games',theme:'Stars, Stripes & Service',date:new Date().toISOString(),players:players.map(p=>({name:p.name,score:p.score||0,correct:p.correct||0,totalCorrectMs:p.totalCorrectMs||0,accuracy:Math.round(((p.correct||0)/Q.length)*1000)/10})),awards:{champion:players[0]?.name||'',second:players[1]?.name||'',third:players[2]?.name||'',paulRevere:fastest?fastest.name:'',fastestMs:fastest?fastest.fastestCorrectMs:null,constitution:accuracy?accuracy.name:''},createdAt:serverTimestamp()});
}
