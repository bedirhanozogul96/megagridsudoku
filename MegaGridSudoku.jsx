import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Heart, Coins, TrendingUp, Crown, Search, HelpCircle,
  Skull, Grid3x3, Lock, Check, Zap, Swords, Shield, Eye, RefreshCw
} from "lucide-react";

/* ─────────────────────────────── SUDOKU ENGINE ─────────────────────────────── */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function isSafe(g, r, c, v) {
  for (let i = 0; i < 9; i++) {
    if (g[r][i] === v || g[i][c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) if (g[br + i][bc + j] === v) return false;
  return true;
}
function fillGrid(g) {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (g[r][c] === 0) {
        for (const v of shuffle([1,2,3,4,5,6,7,8,9])) {
          if (isSafe(g, r, c, v)) {
            g[r][c] = v;
            if (fillGrid(g)) return true;
            g[r][c] = 0;
          }
        }
        return false;
      }
  return true;
}
function generateSolution() {
  const g = Array.from({length:9}, () => Array(9).fill(0));
  fillGrid(g); return g;
}
function generateBoard(clueCount) {
  const solution = generateSolution();
  const positions = shuffle(Array.from({length:81}, (_,i) => [Math.floor(i/9), i%9]));
  const mask = Array.from({length:9}, () => Array(9).fill(false));
  for (let i = 0; i < clueCount; i++) { const [r,c] = positions[i]; mask[r][c] = true; }
  const cells = Array.from({length:9}, (_,r) =>
    Array.from({length:9}, (_,c) => ({ value: mask[r][c] ? solution[r][c] : 0, given: mask[r][c] }))
  );
  return { solution, cells };
}
function boxOf(r, c) { return Math.floor(r/3)*3 + Math.floor(c/3); }

const STAGE_CLUES = [50,45,40,36,32,28,24,20,17];
const BOSS_HP = 20000;
const TARGET_TIME_SEC = 120; // Hız bonusu için hedef süre (2 dakika)

function clueCountFor(n) { return STAGE_CLUES[Math.min(n, STAGE_CLUES.length-1)]; }
function stageLabel(n) { return Math.min(n+1, 9); }
function randBetween(lo, hi) { return lo + Math.random()*(hi-lo); }

/* ─────────────────────────────── CARD POOL (DÜKKAN SİSTEMİ) ─────────────────────────────── */

function generateShopCards() {
  return [1, 2, 3].map(i => {
    const rand = Math.random();
    let tier, color, pMin, pMax, mult;
    
    // Nadirlik Oranları: %60 Yaygın, %30 Nadir, %10 Efsanevi
    if (rand < 0.60) { tier = "Yaygın"; color = "#a1a1aa"; pMin = 10; pMax = 15; mult = 1.0; }
    else if (rand < 0.90) { tier = "Nadir"; color = "#4dd9e0"; pMin = 30; pMax = 45; mult = 2.0; }
    else { tier = "Efsanevi"; color = "#f5c842"; pMin = 80; pMax = 100; mult = 4.0; }

    const price = Math.floor(randBetween(pMin, pMax));
    const cat = Math.floor(Math.random() * 5);
    let card = { id: Math.random(), tier, color, price, sold: false };

    switch(cat) {
      case 0: // Anlık Hasar / Patlama
        card.type = "payout";
        card.title = tier === "Efsanevi" ? "İlk Kan Protokolü" : "Aşırı Yükleme";
        card.subtitle = "Anlık Hasar";
        card.value = Number((randBetween(1.2, 1.8) * mult).toFixed(2));
        card.icon = Swords;
        card.describe = (v) => `Bulmaca skorunu ×${v} ile çarpıp Boss'a anında saf hasar vurur.`;
        break;
      case 1: // Geçici Taktiksel Çarpan
        card.type = "invest";
        card.title = "Odaklanmış Işın";
        card.subtitle = "Taktiksel Çarpan";
        card.value = Number((randBetween(1.5, 2.5) * mult).toFixed(2));
        card.icon = TrendingUp;
        card.describe = (v) => `Sadece bir sonraki Sudoku tahtası için tüm puanlara devasa ×${v} çarpanı verir.`;
        break;
      case 2: // Sistemsel Kalıcı Çarpan
        card.type = "global";
        card.title = "Çekirdek Güncellemesi";
        card.subtitle = "Kalıcı Yükseltme";
        card.value = Number((randBetween(0.05, 0.15) * mult).toFixed(2));
        card.icon = Crown;
        card.describe = (v) => `Kalıcı Çarpan değerine oyun sonuna kadar +${v} ekler.`;
        break;
      case 3: // Hata Toleransı ve Savunma
        card.type = "heal";
        card.title = "Güvenlik Duvarı";
        card.subtitle = "Sistem Onarımı";
        card.value = Math.floor(15 * mult);
        card.icon = Shield;
        card.describe = (v) => `Hatalı rakam girişlerinin verdiği hasarı telafi ederek +${v} HP yeniler.`;
        break;
      case 4: // Mekanik Sinerji ve Alan
        card.type = "reveal";
        card.title = "Geometri Tarayıcı";
        card.subtitle = "Hücre Analizi";
        card.value = Math.max(1, Math.floor(1 * mult));
        card.icon = Search;
        card.describe = (v) => `Sonraki Sudoku tahtasında stratejik olarak ${v} doğru rakamı otomatik yerleştirir.`;
        break;
    }
    return card;
  });
}

/* ─────────────────────────────── PIXEL EYE COMPONENT ─────────────────────────────── */

function BossEye({ bossHpPct, hit }) {
  const pupilColor = bossHpPct > 0.6 ? "#e05cff" : bossHpPct > 0.3 ? "#ff9a3c" : "#ff3c3c";
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" style={{ imageRendering:"pixelated", flexShrink:0 }}>
      <rect x="4" y="1" width="16" height="2" fill="#4a3a6a"/>
      <rect x="2" y="3" width="2" height="2" fill="#4a3a6a"/>
      <rect x="20" y="3" width="2" height="2" fill="#4a3a6a"/>
      <rect x="1" y="5" width="1" height="14" fill="#4a3a6a"/>
      <rect x="22" y="5" width="1" height="14" fill="#4a3a6a"/>
      <rect x="2" y="19" width="2" height="2" fill="#4a3a6a"/>
      <rect x="20" y="19" width="2" height="2" fill="#4a3a6a"/>
      <rect x="4" y="21" width="16" height="2" fill="#4a3a6a"/>
      <rect x="2" y="5" width="20" height="14" fill="#1a0a2e"/>
      <rect x="8" y="7" width="8" height="10" fill="#2a1a4e"/>
      <rect x="9" y="8" width="6" height="8" fill={hit?"#ffffff": pupilColor} style={{transition:"fill 0.3s"}}/>
      <rect x="10" y="10" width="4" height="4" fill="#05010f"/>
      <rect x="11" y="11" width="1" height="1" fill="rgba(255,255,255,0.7)"/>
      <rect x="2" y="6" width="20" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="2" y="10" width="20" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="2" y="14" width="20" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="2" y="18" width="20" height="1" fill="rgba(0,0,0,0.18)"/>
    </svg>
  );
}

/* ─────────────────────────────── PARTICLES ─────────────────────────────── */

function Particles({ active, onDone }) {
  const particles = Array.from({length:24}, (_,i) => ({
    id: i,
    x: 36 + Math.cos((i/24)*Math.PI*2)*30,
    y: 36 + Math.sin((i/24)*Math.PI*2)*30,
    dx: (Math.random()-0.5)*80,
    dy: (Math.random()-0.5)*80,
    color: ["#4dd6e0","#ff70ef","#ffd166","#4ade9a","#fff"][Math.floor(Math.random()*5)],
    size: 3+Math.random()*5,
  }));
  if (!active) return null;
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:p.x, top:p.y,
          width:p.size, height:p.size, borderRadius:1,
          background:p.color, imageRendering:"pixelated",
          animation:"px-fly 0.7s ease-out forwards",
          "--dx": p.dx+"px", "--dy": p.dy+"px",
        }}/>
      ))}
      <style>{`
        @keyframes px-fly {
          0%   { transform: translate(0,0); opacity:1; }
          100% { transform: translate(var(--dx),var(--dy)); opacity:0; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────── DAMAGE FLOATER ─────────────────────────────── */

function DamageFloat({ value, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!value) return null;
  return (
    <div style={{
      position:"fixed", top:"18%", left:"50%", transform:"translateX(-50%)",
      fontSize:28, fontWeight:800, color:"#ff5c72", fontFamily:"monospace",
      textShadow:"0 0 12px #ff5c72", zIndex:200,
      animation:"dmg-rise 0.9s ease-out forwards", pointerEvents:"none",
    }}>
      -{value}
      <style>{`@keyframes dmg-rise { 0%{opacity:1;transform:translate(-50%,0)} 100%{opacity:0;transform:translate(-50%,-60px)} }`}</style>
    </div>
  );
}

/* ─────────────────────────────── MAIN COMPONENT ─────────────────────────────── */

const GRID_SIZE = 9;

export default function MegaGridSudoku() {
  /* ── Core stats ── */
  const [hp,           setHp]           = useState(100);
  const [bossHp,       setBossHp]       = useState(BOSS_HP);
  const [totalScore,   setTotalScore]   = useState(0);
  const [credits,      setCredits]      = useState(0); 
  const [curBoardScore,setCurBoardScore]= useState(0);
  const [pendingBase,  setPendingBase]  = useState(0);
  const [globalMult,   setGlobalMult]   = useState(1.0);
  const [nextBoardMult,setNextBoardMult]= useState(0);
  const [activeMultNow,setActiveMultNow]= useState(0);
  const [completedCount,setCompletedCount]=useState(0);
  const [revealedMeta, setRevealedMeta] = useState(false);
  const [revealCharges,setRevealCharges]= useState(0);
  const [mistakesNow,  setMistakesNow]  = useState(0);
  
  /* ── Timing & Rewards ── */
  const [boardStartTime, setBoardStartTime] = useState(0);
  const [lastReward, setLastReward] = useState({ base:0, flawless:0, speed:0, interest:0, total:0 });

  /* ── Boards ── */
  const [boards, setBoards] = useState(() => {
    const arr = Array.from({length:GRID_SIZE}, ()=>({status:"locked",cells:null,solution:null}));
    arr[0].status = "available";
    return arr;
  });
  const [activeBoardIdx, setActiveBoardIdx] = useState(null);

  /* ── UI ── */
  const [phase,    setPhase]   = useState("mega"); // mega|playing|reward|shop|win|gameover
  const [selected, setSelected]= useState(null);
  const [flash,    setFlash]   = useState(null);
  const [shake,    setShake]   = useState(false);
  const [toast,    setToast]   = useState(null);
  const [shopCards,setShopCards]=useState([]);
  const [bossHit,  setBossHit] = useState(false);
  const [bossParticles,setBossParticles]=useState(false);
  const [damageFloat,setDamageFloat]=useState(null);

  const toastTimer  = useRef(null);
  const draftScoreRef = useRef(0);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=>setToast(null), 2200);
  }, []);

  const dealBossDamage = useCallback((amount) => {
    setBossHp(prev => Math.max(prev - amount, 0));
    setBossHit(true);
    setDamageFloat(amount);
    setTimeout(()=>setBossHit(false), 320);
  }, []);

  /* ── Start board ── */
  const startBoard = useCallback((idx) => {
    setBoards(prev => {
      const arr = prev.slice();
      if (!arr[idx].cells) {
        const { solution, cells } = generateBoard(clueCountFor(completedCount));
        if (revealCharges > 0) {
          const empties = [];
          for (let r=0;r<9;r++) for (let c=0;c<9;c++) if (!cells[r][c].given) empties.push([r,c]);
          shuffle(empties).slice(0, revealCharges).forEach(([r,c])=>{
            cells[r][c] = { value: solution[r][c], given: true };
          });
          showToast(`Tarayıcı ${Math.min(revealCharges, empties.length)} hücreyi otomatik açtı!`);
        }
        arr[idx] = { ...arr[idx], solution, cells, status:"active" };
      } else {
        arr[idx] = { ...arr[idx], status:"active" };
      }
      return arr;
    });
    setRevealCharges(0);
    setMistakesNow(0);
    setBoardStartTime(Date.now());
    setActiveBoardIdx(idx);
    setCurBoardScore(0);
    setPendingBase(0);
    setActiveMultNow(globalMult + nextBoardMult);
    setPhase("playing");
    setSelected(null);
  }, [completedCount, revealCharges, globalMult, nextBoardMult, showToast]);

  const board = activeBoardIdx !== null ? boards[activeBoardIdx] : null;
  const groupComplete = (cells, list) => list.every(([r,c])=>cells[r][c].value!==0);

  /* ── Cell click ── */
  const cellClick = (r, c) => {
    if (phase !== "playing") return;
    if (board.cells[r][c].given || board.cells[r][c].value !== 0) return;
    setSelected({r,c});
  };

  /* ── Place number ── */
  const placeNumber = (num) => {
    if (!selected || phase !== "playing") return;
    const {r,c} = selected;
    const correct = board.solution[r][c] === num;
    if (!correct) {
      setFlash({r,c,num}); setShake(true);
      setTimeout(()=>setShake(false),300);
      setTimeout(()=>setFlash(null),450);
      setMistakesNow(m=>m+1);
      setHp(h=>{
        const n=Math.max(h-15,0);
        if(n===0) setTimeout(()=>setPhase("gameover"),500);
        return n;
      });
      setSelected(null); return;
    }

    setBoards(prev=>{
      const arr = prev.slice();
      const cells = arr[activeBoardIdx].cells.map(row=>row.slice());
      cells[r][c] = {value:num, given:false};
      arr[activeBoardIdx] = {...arr[activeBoardIdx], cells};

      const newPending = pendingBase + num;
      const rowCells = Array.from({length:9},(_,i)=>[r,i]);
      const colCells = Array.from({length:9},(_,i)=>[i,c]);
      const bi=boxOf(r,c), br2=Math.floor(bi/3)*3, bc2=(bi%3)*3;
      const bxCells=[];
      for(let i=0;i<3;i++) for(let j=0;j<3;j++) bxCells.push([br2+i,bc2+j]);

      const groups=[];
      if(groupComplete(cells,rowCells)) groups.push("Satır");
      if(groupComplete(cells,colCells)) groups.push("Sütun");
      if(groupComplete(cells,bxCells))  groups.push("Blok");

      if(groups.length){
        const mult = activeMultNow;
        const gained = Math.round(newPending*mult);
        setCurBoardScore(s=>s+gained);
        showToast(`${groups.join(" + ")} temizlendi! ${newPending} × ${mult.toFixed(2)} = +${gained}`);
        setPendingBase(0);
      } else {
        setPendingBase(newPending);
      }

      let full=true;
      for(let rr=0;rr<9;rr++) for(let cc=0;cc<9;cc++) if(cells[rr][cc].value===0){ full=false; break; }
      if(full){
        arr[activeBoardIdx]={...arr[activeBoardIdx],status:"complete"};
        setTimeout(()=>onBoardComplete(),500);
      }
      return arr;
    });
    setSelected(null);
  };

  /* ── Board complete & Economy ── */
  const onBoardComplete = () => {
    const elapsedSec = (Date.now() - boardStartTime) / 1000;
    
    // Ekonomi Hesaplamaları
    const baseReward = 50;
    const flawlessReward = mistakesNow === 0 ? 20 : 0;
    const speedReward = elapsedSec < TARGET_TIME_SEC ? 15 : 0;
    const interestReward = Math.min(25, Math.floor(credits / 50) * 5); // Max 25 faiz
    const totalEarned = baseReward + flawlessReward + speedReward + interestReward;
    
    setLastReward({
      base: baseReward,
      flawless: flawlessReward,
      speed: speedReward,
      interest: interestReward,
      total: totalEarned
    });
    
    setCredits(c => c + totalEarned);
    draftScoreRef.current = curBoardScore;
    setNextBoardMult(0);
    setPhase("reward");
  };
  
  const proceedToShop = () => {
    setShopCards(generateShopCards());
    setPhase("shop");
  };

  const handleReroll = () => {
    if (credits >= 5) {
      setCredits(c => c - 5);
      setShopCards(generateShopCards());
    } else {
      showToast("Sistemi Yeniden Başlatmak için Yetersiz Veri Kredisi!");
    }
  };

  /* ── Buy Card ── */
  const buyCard = (card) => {
    if (card.sold) return;
    if (credits < card.price) {
      showToast("Yetersiz Veri Kredisi!");
      return;
    }
    
    setCredits(c => c - card.price);
    
    if (card.type === "payout") {
      const gain = Math.round(curBoardScore * card.value);
      setTotalScore(s => s + gain);
      dealBossDamage(gain);
      showToast(`Anlık Hasar! Boss'a ${gain} hasar verildi!`);
    } else if (card.type === "invest") {
      setNextBoardMult(card.value);
      showToast(`Taktiksel Çarpan yüklendi: ×${card.value}`);
    } else if (card.type === "global") {
      setGlobalMult(g => Number((g + card.value).toFixed(2)));
      showToast(`Sistem Güncellendi! Kalıcı Çarpan +${card.value}`);
    } else if (card.type === "reveal") {
      setRevealCharges(r => r + card.value);
      showToast(`Tarayıcı aktif: Sonraki tahtada ${card.value} hücre açılacak.`);
    } else if (card.type === "heal") {
      setHp(h => Math.min(100, h + card.value));
      showToast(`Sistem Onarıldı: +${card.value} SAĞLIK`);
    }

    setShopCards(cards => cards.map(c => c.id === card.id ? { ...c, sold: true } : c));
  };

  const finishShopPhase = () => {
    const nextCompleted = completedCount + 1;
    setCompletedCount(nextCompleted);

    if (!revealedMeta) {
      setRevealedMeta(true);
      setBoards(prev=>prev.map(b=>b.status==="complete"?b:{...b,status:"available"}));
      showToast("Ana Ağ Açığa Çıktı! 8 yeni arena kilidi açıldı.");
    }

    const allDone = boards.filter(b=>b.status==="complete").length >= GRID_SIZE;
    if (allDone) {
      setTimeout(()=>{
        if (totalScore >= BOSS_HP) {
          setBossParticles(true);
          setTimeout(()=>setBossParticles(false),1200);
          setPhase("win");
        } else {
          setPhase("gameover");
        }
      }, 600);
      return;
    }

    setPhase("mega");
    setActiveBoardIdx(null);
  };

  /* ── Restart ── */
  const restart = () => {
    setHp(100); setBossHp(BOSS_HP); setTotalScore(0); setCredits(0); setCurBoardScore(0);
    setPendingBase(0); setGlobalMult(1.0); setNextBoardMult(0); setActiveMultNow(0);
    setCompletedCount(0); setRevealedMeta(false); setRevealCharges(0);
    setMistakesNow(0); setBossHit(false); setBossParticles(false);
    setBoards(()=>{
      const arr=Array.from({length:GRID_SIZE},()=>({status:"locked",cells:null,solution:null}));
      arr[0].status="available"; return arr;
    });
    setActiveBoardIdx(null); setPhase("mega"); setSelected(null);
  };

  /* ── Cell classes ── */
  const cellClasses = (r,c) => {
    const cell = board.cells[r][c];
    const isSel  = selected && selected.r===r && selected.c===c;
    const isFlsh = flash    && flash.r===r    && flash.c===c;
    let cls = "mg-cell";
    if      (cell.given)       cls += " mg-cell-given";
    else if (cell.value !== 0) cls += " mg-cell-filled";
    else                       cls += " mg-cell-empty";
    if (isSel)  cls += " mg-cell-selected";
    if (isFlsh) cls += " mg-cell-wrong";
    if (r%3===0) cls += " mg-border-top";
    if (c%3===0) cls += " mg-border-left";
    if (r===8)   cls += " mg-border-bottom";
    if (c===8)   cls += " mg-border-right";
    return cls;
  };

  const bossHpPct   = Math.max(bossHp / BOSS_HP, 0);
  const playerHpPct = hp;

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="mg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Press+Start+2P&display=swap');

        :root {
          --c-bg:      #0d0f1a;
          --c-panel:   #13172a;
          --c-panel2:  #181d33;
          --c-line:    #252d50;
          --c-line2:   #1e2440;
          --c-cyan:    #4dd9e0;
          --c-pink:    #e060c8;
          --c-purple:  #8070d4;
          --c-yellow:  #f5c842;
          --c-red:     #e84060;
          --c-green:   #42d68c;
          --c-text:    #cdd6f4;
          --c-dim:     #5c6490;
        }

        .mg-root {
          min-height: 100vh;
          width: 100%;
          background:
            repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 28px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 28px),
            radial-gradient(ellipse 900px 500px at 20% 0%,   rgba(128,112,212,0.12), transparent 60%),
            radial-gradient(ellipse 900px 500px at 80% 10%,  rgba(77,217,224,0.09),  transparent 60%),
            radial-gradient(ellipse 700px 600px at 50% 100%, rgba(224,96,200,0.07),  transparent 65%),
            var(--c-bg);
          background-size: 28px 28px, 28px 28px, 100% 100%, 100% 100%, 100% 100%;
          color: var(--c-text);
          font-family: 'Share Tech Mono', 'Courier New', monospace;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 12px 60px;
          box-sizing: border-box;
        }

        /* ── Title ── */
        .mg-title {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(10px,2.8vw,16px);
          letter-spacing: 2px;
          margin-bottom: 16px;
          background: linear-gradient(90deg, var(--c-cyan), var(--c-pink));
          -webkit-background-clip: text; background-clip: text; color: transparent;
          text-transform: uppercase;
          text-shadow: none;
          image-rendering: pixelated;
        }

        /* ── Boss Panel ── */
        .mg-boss-panel {
          width: min(92vw, 520px);
          background: var(--c-panel);
          border: 2px solid var(--c-purple);
          border-radius: 0;
          padding: 12px 16px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          image-rendering: pixelated;
          box-shadow: 0 0 16px rgba(128,112,212,0.25), inset 0 0 24px rgba(0,0,0,0.4);
          position: relative;
        }
        .mg-boss-panel.mg-boss-hit { animation: boss-hit 0.3s ease; }
        @keyframes boss-hit {
          0%,100% { border-color: var(--c-purple); box-shadow: 0 0 16px rgba(128,112,212,0.25); }
          50% { border-color: var(--c-red); box-shadow: 0 0 30px rgba(232,64,96,0.7); }
        }
        .mg-boss-info { flex:1; }
        .mg-boss-name {
          font-family: 'Press Start 2P', monospace;
          font-size: 10px; color: var(--c-pink); letter-spacing: 1px; margin-bottom: 6px;
        }
        .mg-boss-hp-track {
          width: 100%; height: 18px;
          background: #0a0510;
          border: 2px solid var(--c-purple);
          border-radius: 0;
          overflow: hidden;
          position: relative;
          image-rendering: pixelated;
        }
        .mg-boss-hp-fill {
          height: 100%;
          background: linear-gradient(90deg, #5a0020, var(--c-red));
          transition: width 0.4s ease;
          position: relative;
        }
        .mg-boss-hp-fill::after {
          content:'';
          position:absolute; inset:0;
          background: repeating-linear-gradient(90deg,transparent,transparent 6px,rgba(0,0,0,0.2) 6px,rgba(0,0,0,0.2) 7px);
        }
        .mg-boss-hp-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 8px; color: var(--c-dim); margin-top: 4px; text-align: right;
        }
        .mg-boss-score-vs {
          font-size: 10px; color: var(--c-yellow); margin-top: 3px;
          font-family: 'Press Start 2P', monospace;
        }

        /* ── HUD ── */
        .mg-hud { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:14px; }
        .mg-hud-card {
          background: var(--c-panel);
          border: 1px solid var(--c-line);
          border-radius: 0;
          padding: 7px 12px;
          display: flex; align-items: center; gap: 8px;
          min-width: 90px;
        }
        .mg-hud-label { font-size: 8px; color: var(--c-dim); text-transform: uppercase; letter-spacing: 1px; font-family: 'Press Start 2P', monospace; }
        .mg-hud-value { font-size: 14px; font-weight: 800; font-family: 'Share Tech Mono', monospace; }
        .mg-hp-track { width:84px; height:10px; background:#200a0a; border:1px solid #401010; border-radius:0; overflow:hidden; }
        .mg-hp-fill  { height:100%; background:linear-gradient(90deg,#8a1020,var(--c-red)); transition:width .3s; }

        /* ── Board ── */
        .mg-board-wrap { position:relative; }
        .mg-board-wrap.mg-shake { animation:mg-shake .3s; }
        @keyframes mg-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }

        .mg-board {
          display:grid; grid-template-columns:repeat(9,minmax(0,1fr)); grid-template-rows:repeat(9,minmax(0,1fr));
          width:min(92vw,468px); height:min(92vw,468px);
          background:var(--c-panel2);
          border: 3px solid var(--c-cyan);
          border-radius: 0;
          box-shadow: 0 0 6px rgba(77,217,224,0.4), 0 0 24px rgba(77,217,224,0.1), inset 0 0 28px rgba(0,0,0,0.6);
          image-rendering: pixelated;
        }
        .mg-cell {
          display:flex; align-items:center; justify-content:center;
          font-size: clamp(13px,3.4vw,19px);
          font-family: 'Press Start 2P', monospace;
          border-right: 1px solid var(--c-line2); border-bottom: 1px solid var(--c-line2);
          user-select:none; transition:background .12s;
        }
        .mg-border-top    { border-top:    3px solid var(--c-yellow); }
        .mg-border-left   { border-left:   3px solid var(--c-yellow); }
        .mg-border-bottom { border-bottom: 3px solid var(--c-yellow) !important; }
        .mg-border-right  { border-right:  3px solid var(--c-yellow) !important; }

        .mg-cell-given    { background:var(--c-panel);  color:var(--c-cyan); }
        .mg-cell-filled   { background:var(--c-panel);  color:var(--c-yellow); }
        .mg-cell-empty    { background:var(--c-panel2); cursor:pointer; }
        .mg-cell-empty:hover { background:#1e2550; }
        .mg-cell-selected { outline:3px solid var(--c-cyan); outline-offset:-3px; background:#0e2230; }
        .mg-cell-wrong    { background:rgba(232,64,96,0.5) !important; color:#fff !important; animation:mg-flash .45s; }
        @keyframes mg-flash { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* ── Numpad ── */
        .mg-numpad { margin-top:14px; display:grid; grid-template-columns:repeat(5,1fr); gap:6px; width:min(92vw,468px); }
        .mg-numpad-btn {
          background:var(--c-panel2); border:2px solid var(--c-line); color:var(--c-text);
          font-size:16px; font-family:'Press Start 2P',monospace;
          padding:11px 0; border-radius:0; cursor:pointer; transition:all .1s;
        }
        .mg-numpad-btn:hover { background:var(--c-cyan); color:#041018; border-color:var(--c-cyan); }
        .mg-hint { text-align:center; color:var(--c-dim); font-size:10px; margin-top:8px; height:16px; font-family:'Share Tech Mono',monospace; }

        /* ── Mega grid ── */
        .mg-megagrid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; width:min(92vw,420px); margin:8px 0; }
        .mg-megatile {
          aspect-ratio:1; border-radius:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:5px;
          border:2px solid var(--c-line); background:var(--c-panel2);
          font-size:9px; color:var(--c-dim); font-family:'Press Start 2P',monospace;
          image-rendering:pixelated;
        }
        .mg-megatile.mg-available { cursor:pointer; border-color:var(--c-cyan); box-shadow:0 0 12px rgba(77,217,224,0.3); color:var(--c-cyan); }
        .mg-megatile.mg-available:hover { background:#192040; transform:scale(1.04); }
        .mg-megatile.mg-complete  { color:var(--c-green);  border-color:var(--c-green); }
        .mg-megatile.mg-locked    { opacity:.4; }

        /* ── Modal ── */
        .mg-modal-backdrop { position:fixed; inset:0; background:rgba(5,4,16,0.88); display:flex; align-items:center; justify-content:center; z-index:100; padding:16px; }
        .mg-modal {
          background:var(--c-panel); border:2px solid var(--c-purple); border-radius:0;
          padding:24px; max-width:620px; width:100%; text-align:center;
          box-shadow:0 0 50px rgba(128,112,212,0.2);
          font-family:'Share Tech Mono',monospace;
        }
        .mg-modal h2 {
          font-family:'Press Start 2P',monospace; margin:0 0 6px;
          font-size:clamp(12px,3vw,16px); letter-spacing:2px;
          background:linear-gradient(90deg,var(--c-pink),var(--c-cyan));
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        .mg-modal .mg-sub { color:var(--c-dim); font-size:12px; margin:0 0 16px; }
        
        /* Reward Stats */
        .mg-reward-row { display:flex; justify-content:space-between; margin:8px 0; border-bottom:1px dashed var(--c-line); padding-bottom:4px;}
        .mg-reward-total { display:flex; justify-content:space-between; margin-top:12px; font-weight:bold; color:var(--c-yellow); font-size:18px;}

        /* ── Draft cards ── */
        .mg-cards { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; margin:16px 0; }
        .mg-card {
          width:170px; background:var(--c-panel2); border:2px solid var(--c-line);
          border-radius:0; padding:14px 10px; cursor:pointer; transition:all .15s;
          display:flex; flex-direction:column; align-items:center; gap:7px; text-align:center;
          font-family:'Share Tech Mono',monospace;
          image-rendering:pixelated; position:relative;
        }
        .mg-card:hover { transform:translateY(-5px); box-shadow:0 8px 24px rgba(128,112,212,0.3); }
        .mg-card.sold { opacity:0.4; pointer-events:none; filter:grayscale(1); }
        .mg-card-icon { width:40px; height:40px; border-radius:0; display:flex; align-items:center; justify-content:center; background:var(--c-panel); border:1px solid var(--c-line); }
        .mg-card-title    { font-family:'Press Start 2P',monospace; font-weight:800; font-size:10px; line-height:1.4; }
        .mg-card-subtitle { font-size:9px; color:var(--c-dim); text-transform:uppercase; letter-spacing:1px; }
        .mg-card-value    { font-size:22px; font-weight:800; }
        .mg-card-desc     { font-size:10px; color:var(--c-dim); line-height:1.5; min-height:44px; }
        .mg-card-price    { display:flex; align-items:center; gap:4px; margin-top:auto; font-family:'Press Start 2P', monospace; font-size:10px; color:var(--c-green); background:#0c1020; padding:4px 8px; border:1px solid var(--c-line); }

        /* ── Toast ── */
        .mg-toast {
          position:fixed; top:14px; left:50%; transform:translateX(-50%);
          background:var(--c-panel2); border:2px solid var(--c-yellow); color:var(--c-yellow);
          padding:9px 18px; border-radius:0; font-size:11px; z-index:50;
          box-shadow:0 4px 20px rgba(245,200,66,0.2); animation:mg-toast-in .25s ease;
          text-align:center; max-width:90vw; font-family:'Share Tech Mono',monospace;
        }
        @keyframes mg-toast-in { from{opacity:0;transform:translate(-50%,-10px)} to{opacity:1;transform:translate(-50%,0)} }

        /* ── Continue button ── */
        .mg-continue-btn {
          background:linear-gradient(90deg,var(--c-pink),var(--c-purple));
          border:none; color:#fff; font-family:'Press Start 2P',monospace;
          font-size:11px; letter-spacing:1px; padding:12px 24px;
          border-radius:0; cursor:pointer; text-transform:uppercase; margin-top:8px;
        }
        .mg-continue-btn:hover { filter:brightness(1.12); }
        
        .mg-reroll-btn {
           background:var(--c-panel2); border:1px solid var(--c-cyan); color:var(--c-cyan);
           padding:8px 16px; display:flex; align-items:center; gap:8px; margin:0 auto 16px;
           cursor:pointer; font-family:'Press Start 2P', monospace; font-size:9px; transition:all 0.2s;
        }
        .mg-reroll-btn:hover { background:var(--c-cyan); color:#000; }

        .mg-skull    { color:var(--c-red); margin-bottom:8px; }
        .mg-final-score { font-size:34px; font-weight:800; color:var(--c-yellow); margin:6px 0 2px; }

        /* ── Stage label ── */
        .mg-stage-label { font-family:'Press Start 2P',monospace; font-size:9px; color:var(--c-dim); margin-bottom:4px; }
        .mg-stage-clue  { font-family:'Press Start 2P',monospace; font-size:9px; color:var(--c-pink); margin-bottom:10px; }

        /* win glow */
        .mg-boss-panel.mg-boss-win { animation:boss-win 0.8s ease infinite alternate; }
        @keyframes boss-win {
          from { border-color:var(--c-green); box-shadow:0 0 20px rgba(66,214,140,0.4); }
          to   { border-color:var(--c-cyan);  box-shadow:0 0 40px rgba(77,217,224,0.6); }
        }
      `}</style>

      {/* ── TITLE ── */}
      <div className="mg-title">⚔ SİBER AI: SUDOKU KUŞATMASI</div>

      {/* ── BOSS PANEL ── */}
      <div className={`mg-boss-panel ${bossHit?"mg-boss-hit":""} ${phase==="win"?"mg-boss-win":""}`} style={{position:"relative"}}>
        <BossEye bossHpPct={bossHpPct} hit={bossHit}/>
        <Particles active={bossParticles} onDone={()=>setBossParticles(false)}/>
        <div className="mg-boss-info">
          <div className="mg-boss-name">◈ YAPAY ZEKA ÇEKİRDEĞİ — v{(bossHp/BOSS_HP*9.9).toFixed(1)}</div>
          <div className="mg-boss-hp-track">
            <div className="mg-boss-hp-fill" style={{width:`${bossHpPct*100}%`}}/>
          </div>
          <div className="mg-boss-hp-text">HP: {bossHp.toLocaleString()} / {BOSS_HP.toLocaleString()}</div>
          <div className="mg-boss-score-vs">◤ SKORUNUZ: {totalScore.toLocaleString()}</div>
        </div>
      </div>

      {/* DAMAGE FLOATER */}
      {damageFloat && <DamageFloat value={damageFloat} onDone={()=>setDamageFloat(null)}/>}

      {/* ── HUD ── */}
      <div className="mg-hud">
        <div className="mg-hud-card">
          <Heart size={16} color="var(--c-red)"/>
          <div>
            <div className="mg-hud-label">SAĞLIK</div>
            <div className="mg-hp-track"><div className="mg-hp-fill" style={{width:`${playerHpPct}%`}}/></div>
          </div>
        </div>
        <div className="mg-hud-card">
          <Coins size={16} color="var(--c-green)"/>
          <div>
            <div className="mg-hud-label">KREDİ</div>
            <div className="mg-hud-value" style={{color:"var(--c-green)"}}>{credits}</div>
          </div>
        </div>
        <div className="mg-hud-card">
          <div>
            <div className="mg-hud-label">KALICI ÇARPAN</div>
            <div className="mg-hud-value" style={{color:"var(--c-pink)"}}>×{globalMult.toFixed(2)}</div>
          </div>
        </div>
        {phase==="playing" && (
          <div className="mg-hud-card">
            <div>
              <div className="mg-hud-label">TAHTA SKORU</div>
              <div className="mg-hud-value">{curBoardScore}<span style={{fontSize:10,color:"var(--c-dim)"}}> +{pendingBase}</span></div>
            </div>
          </div>
        )}
        {nextBoardMult>0 && (
          <div className="mg-hud-card">
            <TrendingUp size={14} color="var(--c-cyan)"/>
            <div>
              <div className="mg-hud-label">SONRAKİ ÇARPAN</div>
              <div className="mg-hud-value" style={{color:"var(--c-cyan)"}}>×{nextBoardMult.toFixed(2)}</div>
            </div>
          </div>
        )}
        {revealCharges>0 && (
          <div className="mg-hud-card">
            <Eye size={14} color="var(--c-cyan)"/>
            <div>
              <div className="mg-hud-label">TARAYICI</div>
              <div className="mg-hud-value" style={{color:"var(--c-cyan)"}}>{revealCharges}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── MEGA GRID ── */}
      {phase==="mega" && (
        <div style={{textAlign:"center"}}>
          <div className="mg-stage-label">KADEME {stageLabel(completedCount)} / 9</div>
          <div className="mg-stage-clue">{clueCountFor(completedCount)} İPUCU</div>
          <div className="mg-megagrid">
            {boards.map((b,idx)=>{
              let cls="mg-megatile";
              if(b.status==="available") cls+=" mg-available";
              else if(b.status==="complete") cls+=" mg-complete";
              else cls+=" mg-locked";
              return (
                <div key={idx} className={cls} onClick={()=>b.status==="available"&&startBoard(idx)}>
                  {b.status==="complete"  ? <><Check size={18}/><span>TEMİZLENDİ</span></> :
                   b.status==="available" ? <><Grid3x3 size={18}/><span>ARENA {idx+1}</span></> :
                                            <><Lock size={16}/><span>KİLİTLİ</span></>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SUDOKU BOARD ── */}
      {phase==="playing" && board && (
        <>
          <div className={`mg-board-wrap ${shake?"mg-shake":""}`}>
            <div className="mg-board">
              {board.cells.map((row,r)=>
                row.map((cell,c)=>{
                  const isFlsh = flash&&flash.r===r&&flash.c===c;
                  const display = isFlsh ? flash.num : (cell.value!==0 ? cell.value : "");
                  return (
                    {/* 3x3 Sayı Tuş Takımı (Numpad) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '10px',                           
        padding: '15px',
        width: '100%',
        maxWidth: '300px',                     
        margin: '20px auto 0 auto' /* Üstten 20px boşluk, ortala */
      }}>
        
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num)} /* Sizin click fonksiyonunuzun adı neyse buraya o gelmeli */
            style={{
              aspectRatio: '1 / 1',            
              fontSize: '28px',
              fontWeight: 'bold',
              backgroundColor: '#1a1a1a',      
              color: '#00ffcc',                
              border: '2px solid #00ffcc',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 0 10px rgba(0, 255, 204, 0.2)' /* Hafif neon parlama */
            }}
          >
            {num}
          </button>
        ))}

      </div>
          ) : (
            <div className="mg-hint">▶ SEÇMEK İÇİN BOŞ BİR HÜCREYE TIKLAYIN</div>
          )}
        </>
      )}

      {toast && <div className="mg-toast">{toast}</div>}

      {/* ── REWARD MODAL ── */}
      {phase==="reward" && (
        <div className="mg-modal-backdrop">
          <div className="mg-modal" style={{maxWidth:400}}>
            <h2>ARENA TEMİZLENDİ</h2>
            <p className="mg-sub">Veri Kredisi Hesaplanıyor...</p>
            
            <div style={{textAlign:"left", background:"var(--c-panel2)", padding:"16px", border:"1px solid var(--c-line)", marginBottom:"16px"}}>
              <div className="mg-reward-row">
                <span>Temel Tamamlama</span>
                <span style={{color:"var(--c-cyan)"}}>+{lastReward.base}</span>
              </div>
              <div className="mg-reward-row">
                <span>Kusursuzluk Bonusu (Sıfır Hata)</span>
                <span style={{color: lastReward.flawless ? "var(--c-green)" : "var(--c-dim)"}}>
                  {lastReward.flawless ? `+${lastReward.flawless}` : "0"}
                </span>
              </div>
              <div className="mg-reward-row">
                <span>Hız Bonusu (Hedef Altında)</span>
                <span style={{color: lastReward.speed ? "var(--c-yellow)" : "var(--c-dim)"}}>
                  {lastReward.speed ? `+${lastReward.speed}` : "0"}
                </span>
              </div>
              <div className="mg-reward-row">
                <span>Birikim (Faiz) Bonusu</span>
                <span style={{color:"var(--c-pink)"}}>+{lastReward.interest}</span>
              </div>
              <div className="mg-reward-total">
                <span>TOPLAM KAZANÇ</span>
                <span>+{lastReward.total} KREDİ</span>
              </div>
            </div>
            
            <button className="mg-continue-btn" onClick={proceedToShop}>SİBER DÜKKANA GİR ▶</button>
          </div>
        </div>
      )}

      {/* ── SHOP MODAL ── */}
      {phase==="shop" && (
        <div className="mg-modal-backdrop">
          <div className="mg-modal">
            <h2>SİBER DÜKKAN</h2>
            <p className="mg-sub">
              Mevcut Kredi: <b style={{color:"var(--c-green)"}}>{credits}</b>
              {" · "}Tahta Skoru: <b style={{color:"var(--c-yellow)"}}>{draftScoreRef.current.toLocaleString()}</b>
            </p>
            
            <button className="mg-reroll-btn" onClick={handleReroll}>
              <RefreshCw size={14}/> YENİLE (5 KREDİ)
            </button>

            <div className="mg-cards">
              {shopCards.map((card,i)=>{
                const Icon=card.icon;
                return (
                  <div className={`mg-card ${card.sold ? 'sold' : ''}`} key={i} onClick={()=>buyCard(card)}
                       style={{borderColor:card.color}}>
                    <div className="mg-card-icon"><Icon size={18} color={card.color}/></div>
                    <div className="mg-card-title" style={{color:card.color}}>{card.title}</div>
                    <div className="mg-card-subtitle">{card.tier}</div>
                    <div className="mg-card-value" style={{color:card.color}}>
                      {card.type==="global"||card.type==="heal"||card.type==="reveal" ? `+${card.value}` : `×${card.value}`}
                    </div>
                    <div className="mg-card-desc">{card.describe(card.value)}</div>
                    
                    <div className="mg-card-price">
                       <Coins size={12}/> {card.price}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="mg-continue-btn" onClick={finishShopPhase}>SONRAKİ ARENAYA GEÇ ▶</button>
          </div>
        </div>
      )}

      {/* ── WIN MODAL ── */}
      {phase==="win" && (
        <div className="mg-modal-backdrop">
          <div className="mg-modal">
            <div style={{fontSize:32,marginBottom:8}}>🏆</div>
            <h2>SİSTEM BAŞARIYLA TEMİZLENDİ</h2>
            <p className="mg-sub">Yapay Zeka Çekirdeği devre dışı bırakıldı!</p>
            <div className="mg-final-score">{totalScore.toLocaleString()}</div>
            <p className="mg-sub" style={{marginTop:-6}}>SON SKOR / BOSS HP ({BOSS_HP.toLocaleString()})</p>
            <button className="mg-continue-btn" onClick={restart}>YENİDEN BAŞLAT ▶</button>
          </div>
        </div>
      )}

      {/* ── GAME OVER MODAL ── */}
      {phase==="gameover" && (
        <div className="mg-modal-backdrop">
          <div className="mg-modal">
            <Skull size={38} className="mg-skull"/>
            <h2>SİSTEM ELE GEÇİRİLDİ</h2>
            <p className="mg-sub">Yapay Zeka Çekirdeği hayatta kaldı.</p>
            <div className="mg-final-score">{totalScore.toLocaleString()}</div>
            <p className="mg-sub" style={{marginTop:-6}}>
              Skor: {totalScore.toLocaleString()} / Hedef: {BOSS_HP.toLocaleString()}
              {" · "}{completedCount} arena temizlendi
            </p>
            <button className="mg-continue-btn" onClick={restart}>TEKRAR DENE ▶</button>
          </div>
        </div>
      )}
    </div>
  );
}