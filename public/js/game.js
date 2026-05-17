// ============================================================
// AVÈNE PLATFORM - game.js  (version corrigée)
// ============================================================

const GameEngine = {

  // ── État global ───────────────────────────────────────────
  state: {
    phase: 'setup',
    level: 1,
    tournee: null,
    pharmacie: null,
    agent: null,
    stock: null,
    currentQuestion: null,
    usedQuestionIds: [],
    questionsData: [],
    answerWords: [],
    poolWords: [],
  },

  LEVELS: [
    { num:1, difficulte:'75%', label:'Niveau 1',  icon:'🟢', color:'#27AE60', bg:'rgba(39,174,96,0.12)',   gift:'Type 1',   nextLabel:'Niveau 2 — 50%' },
    { num:2, difficulte:'50%', label:'Niveau 2',  icon:'🟡', color:'#F39C12', bg:'rgba(243,156,18,0.12)', gift:'Type 2',   nextLabel:'Niveau 3 — 25%' },
    { num:3, difficulte:'25%', label:'Niveau 3',  icon:'🟠', color:'#E67E22', bg:'rgba(230,126,34,0.12)', gift:'Type 3',   nextLabel:'Super Lot — 1%' },
    { num:4, difficulte:'1%',  label:'Super Lot', icon:'🔴', color:'#E74C3C', bg:'rgba(231,76,60,0.12)',  gift:'Super Lot', nextLabel:null },
  ],

  // ── Init : remplir le select Tournées ─────────────────────
  async init() {
    console.log('[Game] init');
    const selT = document.getElementById('selTournee');
    selT.innerHTML = '<option value="">Chargement…</option>';
    selT.disabled = true;

    try {
      const tournees = await API.get('/api/tournees');
      console.log('[Game] tournees:', tournees);

      selT.innerHTML = '<option value="">— Choisir une tournée —</option>';
      if (!tournees || tournees.length === 0) {
        selT.innerHTML = '<option value="">Aucune tournée disponible</option>';
        Toast.warning('Aucune tournée trouvée. Créez-en une dans la section Tournées.');
        return;
      }

      tournees.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.region}  (${formatDate(t.date_debut)} → ${formatDate(t.date_fin)})`;
        opt.dataset.tournee = JSON.stringify(t);
        selT.appendChild(opt);
      });
      selT.disabled = false;

      // Pré-sélection via URL param ?agent_id=
      const params = new URLSearchParams(window.location.search);
      if (params.get('agent_id')) await this._preselectAgent(parseInt(params.get('agent_id')));

    } catch (err) {
      console.error('[Game] init error:', err);
      selT.innerHTML = '<option value="">Erreur de chargement</option>';
      Toast.error('Erreur chargement tournées : ' + err.message);
    }
  },

  // ── Pré-sélection depuis URL ──────────────────────────────
  async _preselectAgent(agentId) {
    try {
      const agents  = await API.get('/api/agents');
      const agent   = agents?.find(a => a.id === agentId);
      if (!agent) return;

      const pharms  = await API.get('/api/pharmacies');
      const pharm   = pharms?.find(p => p.id === agent.pharmacy_id);
      if (!pharm) return;

      const selT = document.getElementById('selTournee');
      selT.value = pharm.tournee_id;
      await this.onTourneeChange();

      document.getElementById('selPharmacie').value = pharm.id;
      await this.onPharmacieChange();

      document.getElementById('selAgent').value = agentId;
      this._checkAgentStatus();
    } catch(e) { console.warn('preselectAgent error:', e); }
  },

  // ── Sélection tournée ─────────────────────────────────────
  async onTourneeChange() {
    const selT    = document.getElementById('selTournee');
    const selP    = document.getElementById('selPharmacie');
    const selA    = document.getElementById('selAgent');
    const btnStart = document.getElementById('startGameBtn');

    // Reset downstream
    selP.innerHTML = '<option value="">— Choisir une pharmacie —</option>';
    selP.disabled  = true;
    selA.innerHTML = '<option value="">— Choisir un agent —</option>';
    selA.disabled  = true;
    btnStart.disabled = true;
    document.getElementById('stockPreview').style.display = 'none';
    document.getElementById('agentStatutAlert').style.display = 'none';

    const tourneeId = selT.value;
    if (!tourneeId) return;

    // Store tournee data
    const opt = selT.options[selT.selectedIndex];
    try { this.state.tournee = JSON.parse(opt.dataset.tournee); } catch { this.state.tournee = { id: tourneeId }; }

    try {
      // Load pharmacies
      const pharmacies = await API.get(`/api/pharmacies?tournee_id=${tourneeId}`);
      console.log('[Game] pharmacies:', pharmacies);

      if (!pharmacies || pharmacies.length === 0) {
        selP.innerHTML = '<option value="">Aucune pharmacie pour cette tournée</option>';
        Toast.info('Aucune pharmacie dans cette tournée.');
        return;
      }

      pharmacies.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nom}${p.est_visitee ? ' ✅' : ''}`;
        opt.dataset.pharm = JSON.stringify(p);
        selP.appendChild(opt);
      });
      selP.disabled = false;

      // Load stock
      const stock = await API.get(`/api/stock/${tourneeId}`);
      this.state.stock = stock;
      this._renderStockPreview(stock);
      document.getElementById('stockPreview').style.display = 'block';

    } catch (err) {
      Toast.error('Erreur chargement pharmacies : ' + err.message);
    }
  },

  // ── Sélection pharmacie ───────────────────────────────────
  async onPharmacieChange() {
    const selP    = document.getElementById('selPharmacie');
    const selA    = document.getElementById('selAgent');
    const btnStart = document.getElementById('startGameBtn');

    selA.innerHTML = '<option value="">— Choisir un agent —</option>';
    selA.disabled  = true;
    btnStart.disabled = true;
    document.getElementById('agentStatutAlert').style.display = 'none';

    const pharmId = selP.value;
    if (!pharmId) return;

    const opt = selP.options[selP.selectedIndex];
    try { this.state.pharmacie = JSON.parse(opt.dataset.pharm); } catch { this.state.pharmacie = { id: pharmId }; }

    try {
      const agents = await API.get(`/api/agents?pharmacy_id=${pharmId}`);
      console.log('[Game] agents:', agents);

      if (!agents || agents.length === 0) {
        selA.innerHTML = '<option value="">Aucun agent pour cette pharmacie</option>';
        Toast.info('Aucun agent dans cette pharmacie.');
        return;
      }

      agents.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.nom} — ${a.statut_jeu || 'Non Joué'}`;
        opt.dataset.agent = JSON.stringify(a);
        selA.appendChild(opt);
      });
      selA.disabled = false;

    } catch (err) {
      Toast.error('Erreur chargement agents : ' + err.message);
    }
  },

  // ── Vérification statut agent sélectionné ─────────────────
  _checkAgentStatus() {
    const selA = document.getElementById('selAgent');
    const btnStart = document.getElementById('startGameBtn');
    const alertEl  = document.getElementById('agentStatutAlert');

    btnStart.disabled = !selA.value;
    alertEl.style.display = 'none';

    if (!selA.value) return;

    const opt = selA.options[selA.selectedIndex];
    let agent;
    try { agent = JSON.parse(opt.dataset.agent); } catch { return; }

    this.state.agent = agent;

    if (agent.statut_jeu && agent.statut_jeu !== 'Non Joué') {
      alertEl.style.display = 'block';
      alertEl.innerHTML = `
        <div style="background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.3);
          border-radius:var(--radius-sm);padding:12px 16px;color:var(--warning);font-size:0.85rem;margin-top:8px;">
          ⚠️ Cet agent a déjà joué : <strong>${agent.statut_jeu}</strong>. 
          Vous pouvez relancer une nouvelle session.
        </div>`;
    }
  },

  // ── Stock preview ─────────────────────────────────────────
  _renderStockPreview(stock) {
    if (!stock) return;
    const s   = stock.stock_actuel  || {};
    const ini = stock.stock_initial || {};
    const items = [
      { key:'type1',    label:'Cadeau Type 1', icon:'🎁' },
      { key:'type2',    label:'Cadeau Type 2', icon:'🎀' },
      { key:'type3',    label:'Cadeau Type 3', icon:'🏆' },
      { key:'superlot', label:'Super Lot',      icon:'💎' },
    ];
    document.getElementById('stockDetails').innerHTML = items.map(item => {
      const cur  = s[item.key]   ?? 0;
      const ini_ = ini[item.key] ?? 0;
      const pct  = ini_ > 0 ? Math.round((cur / ini_) * 100) : 0;
      const cls  = pct === 0 ? 'low' : pct < 30 ? 'medium' : '';
      return `
        <div style="margin-bottom:14px;">
          <div class="flex justify-between mb-4">
            <span style="font-weight:500;">${item.icon} ${item.label}</span>
            <span class="badge ${cur === 0 ? 'badge-error' : cur < 5 ? 'badge-warning' : 'badge-success'}">${cur} / ${ini_}</span>
          </div>
          <div class="stock-bar"><div class="stock-bar-fill ${cls}" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
  },

  // ── Démarrer le jeu ───────────────────────────────────────
  async startGame() {
    const selA = document.getElementById('selAgent');
    const selP = document.getElementById('selPharmacie');
    const selT = document.getElementById('selTournee');

    if (!selT.value || !selP.value || !selA.value) {
      Toast.warning('Sélectionnez une tournée, une pharmacie et un agent.');
      return;
    }

    // Ensure state is set
    if (!this.state.agent) {
      const opt = selA.options[selA.selectedIndex];
      try { this.state.agent = JSON.parse(opt.dataset.agent); } catch { this.state.agent = { id: selA.value }; }
    }
    if (!this.state.pharmacie) {
      const opt = selP.options[selP.selectedIndex];
      try { this.state.pharmacie = JSON.parse(opt.dataset.pharm); } catch { this.state.pharmacie = { id: selP.value }; }
    }

    // Reset game state
    this.state.level           = 1;
    this.state.usedQuestionIds = [];
    this.state.questionsData   = [];
    this.state.answerWords     = [];
    this.state.poolWords       = [];
    this.state.phase           = 'playing';

    document.getElementById('setupScreen').style.display  = 'none';
    document.getElementById('gameScreen').style.display   = 'block';
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('gameSubtitle').textContent   =
      `${this.state.agent?.nom || '?'} — ${this.state.pharmacie?.nom || '?'}`;

    await this._loadQuestion();
  },

  // ── Charger une question ──────────────────────────────────
  async _loadQuestion() {
    const lvl = this.LEVELS[this.state.level - 1];
    this._updateLevelDots();

    // Reset bouton valider
    const btn = document.getElementById('validateBtn');
    btn.disabled = false;
    btn.textContent = '✅ Valider';

    // Vider zones
    this.state.answerWords = [];
    this.state.poolWords   = [];

    const card = document.getElementById('questionCard');
    card.style.animation  = 'none';
    card.style.borderColor = '';
    card.style.boxShadow  = '';
    card.classList.remove('wrong');

    try {
      const exclude = this.state.usedQuestionIds.join(',');
      const url = `/api/questions?difficulte=${encodeURIComponent(lvl.difficulte)}&exclude=${exclude}`;
      const question = await API.get(url);
      console.log('[Game] question loaded:', question?.id, question?.enonce?.substring(0,40));

      if (!question) throw new Error('Aucune question reçue');
      this.state.currentQuestion = question;
      this.state.usedQuestionIds.push(question.id);
      this._renderQuestion(question, lvl);

    } catch (err) {
      console.error('[Game] loadQuestion error:', err);
      Toast.error('Impossible de charger la question : ' + err.message + '. Vérifiez la banque de questions.');
    }
  },

  // ── Afficher la question ──────────────────────────────────
  _renderQuestion(question, lvl) {
    // Badge difficulté
    document.getElementById('difficultyBadge').innerHTML = `
      <span style="background:${lvl.bg};color:${lvl.color};padding:6px 16px;
        border-radius:20px;font-size:0.82rem;font-weight:700;letter-spacing:0.06em;display:inline-block;">
        ${lvl.icon} ${lvl.label} &mdash; ${lvl.difficulte} de réussite
      </span>`;

    document.getElementById('questionText').textContent = question.enonce;

    // Mélanger tous les mots
    const all = [...(question.blocs_corrects || []), ...(question.blocs_pieges || [])];
    this._shuffle(all);
    this.state.poolWords = [...all];

    this._renderPool();
    this._renderAnswerZone();
    this._updateWordCount();

    // Animation entrée
    void document.getElementById('questionCard').offsetWidth; // reflow
    document.getElementById('questionCard').style.animation = 'fadeIn 0.4s ease';
  },

  // ── Rendre la zone pool ───────────────────────────────────
  _renderPool() {
    const pool = document.getElementById('wordPool');
    pool.innerHTML = '';
    this.state.poolWords.forEach((word, i) => {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = word;
      chip.style.animationDelay = `${i * 0.06}s`;
      chip.addEventListener('click', () => this._poolToAnswer(word, chip));
      pool.appendChild(chip);
    });
  },

  // ── Rendre la zone réponse ────────────────────────────────
  _renderAnswerZone() {
    const zone = document.getElementById('answerZone');
    zone.innerHTML = '';
    this.state.answerWords.forEach((word, idx) => {
      const chip = document.createElement('span');
      chip.className = 'word-chip placed';
      chip.textContent = word;
      chip.addEventListener('click', () => this._answerToPool(idx));
      zone.appendChild(chip);
    });
  },

  // Pool → Réponse (quand on clique un mot dans le pool)
  _poolToAnswer(word, chip) {
    // Retirer du pool state
    const idx = this.state.poolWords.indexOf(word);
    if (idx !== -1) this.state.poolWords.splice(idx, 1);

    // Ajouter à la réponse
    this.state.answerWords.push(word);

    // Animation sortie du pool
    chip.style.opacity = '0';
    chip.style.transform = 'scale(0.8)';
    chip.style.transition = 'all 0.15s ease';
    setTimeout(() => chip.remove(), 150);

    // Ajouter dans la zone réponse
    const zone = document.getElementById('answerZone');
    const newChip = document.createElement('span');
    newChip.className = 'word-chip placed';
    newChip.textContent = word;
    const answerIdx = this.state.answerWords.length - 1;
    newChip.addEventListener('click', () => this._answerToPool(answerIdx));
    zone.appendChild(newChip);

    this._updateWordCount();
  },

  // Réponse → Pool (quand on clique un mot placé)
  _answerToPool(idx) {
    const word = this.state.answerWords[idx];
    if (word === undefined) return;

    // Retirer de answerWords
    this.state.answerWords.splice(idx, 1);

    // Remettre dans pool
    this.state.poolWords.push(word);

    // Re-render les deux zones proprement
    this._renderAnswerZone();
    this._renderPool();
    this._updateWordCount();
  },

  clearAnswer() {
    // Tout remettre dans le pool
    this.state.poolWords   = [...this.state.poolWords, ...this.state.answerWords];
    this.state.answerWords = [];
    this._renderAnswerZone();
    this._renderPool();
    this._updateWordCount();
  },

  _updateWordCount() {
    const n = this.state.answerWords.length;
    document.getElementById('wordsCount').textContent = `${n} mot${n > 1 ? 's' : ''} placé${n > 1 ? 's' : ''}`;
  },

  // ── Validation ────────────────────────────────────────────
  async validateAnswer() {
    if (!this.state.answerWords.length) {
      Toast.warning('Placez au moins un mot dans la zone de réponse');
      return;
    }

    const correct = this.state.currentQuestion?.blocs_corrects || [];
    const answer  = this.state.answerWords;

    const isCorrect =
      answer.length === correct.length &&
      answer.every((w, i) => w === correct[i]);

    const lvl = this.LEVELS[this.state.level - 1];

    document.getElementById('validateBtn').disabled = true;

    this.state.questionsData.push({
      question: this.state.currentQuestion.enonce,
      resultat: isCorrect
        ? `✅ Correct (${answer.join(' ')})`
        : `❌ Incorrect — réponse: ${answer.join(' ')} — attendu: ${correct.join(' ')}`
    });

    if (isCorrect) {
      await this._handleCorrect(lvl);
    } else {
      await this._handleWrong(lvl, correct);
    }
  },

  // ── Bonne réponse ─────────────────────────────────────────
  async _handleCorrect(lvl) {
    this._triggerSuccessBubbles();

    if (lvl.num === 4) {
      // Super Lot automatique
      await this._endGame(true, 'Super Lot');
      return;
    }
    this._showGiftModal(lvl);
  },

  _showGiftModal(lvl) {
    const stock   = this.state.stock?.stock_actuel || {};
    const giftKey = lvl.gift === 'Super Lot' ? 'superlot' : `type${lvl.gift.replace('Type ','')}`;
    const giftStock = stock[giftKey] ?? 0;
    const nextLvl = this.LEVELS[lvl.num]; // lvl.num est 1-based donc c'est l'index suivant

    document.getElementById('giftModalTitle').textContent = `${lvl.icon} Niveau ${lvl.num} réussi !`;
    document.getElementById('giftModalDesc').textContent  = 'Choisissez votre récompense ou tentez le niveau suivant.';

    const giftIcons = { 'Type 1':'🎁', 'Type 2':'🎀', 'Type 3':'🏆', 'Super Lot':'💎' };

    document.getElementById('giftChoices').innerHTML = `
      <button class="gift-btn primary-gift" onclick="GameEngine._takeGift('${lvl.gift}')">
        <span class="gift-icon">${giftIcons[lvl.gift] || '🎁'}</span>
        <strong>Prendre ${lvl.gift}</strong>
        <span class="gift-label">Fin de session</span>
        ${giftStock === 0
          ? `<span class="stock-warning">⚠️ Stock épuisé — signaler</span>`
          : `<span class="gift-label" style="color:var(--success);">${giftStock} dispo</span>`}
      </button>
      ${nextLvl ? `
      <button class="gift-btn continue-btn" onclick="GameEngine._goNextLevel()">
        <span class="gift-icon">${nextLvl.icon}</span>
        <strong>Tenter ${nextLvl.label}</strong>
        <span class="gift-label">${nextLvl.difficulte} de chances</span>
        <span class="gift-label" style="color:var(--primary);">Risque de tout perdre !</span>
      </button>` : ''}
    `;
    Modal.open('giftModal');
  },

  async _takeGift(giftType) {
    Modal.close('giftModal');
    await this._endGame(true, giftType);
  },

  async _goNextLevel() {
    Modal.close('giftModal');
    this.state.level++;
    await this._loadQuestion();
  },

  // ── Mauvaise réponse ──────────────────────────────────────
  async _handleWrong(lvl, correct) {
    const card = document.getElementById('questionCard');
    card.style.animation  = 'wrongAnswerShake 0.6s ease forwards';
    card.style.borderColor = 'var(--error)';
    card.style.boxShadow  = '0 0 30px rgba(231,76,60,0.3)';
    setTimeout(() => {
      card.style.borderColor = '';
      card.style.boxShadow   = '';
    }, 1800);

    Toast.error(`Mauvaise réponse ! Attendu : ${correct.join(' → ')}`);
    setTimeout(() => this._endGame(false, null), 1000);
  },

  // ── Fin de partie ─────────────────────────────────────────
  async _endGame(won, giftType) {
    this.state.phase = 'result';
    try {
      await API.post('/api/game/submit', {
        agent_id:      this.state.agent?.id,
        pharmacy_id:   this.state.pharmacie?.id,
        tournee_id:    this.state.tournee?.id,
        niveau:        this.state.level,
        reponse_correcte: won,
        cadeau_choisi: giftType,
        questions_data: this.state.questionsData
      });
    } catch (err) {
      Toast.warning('Bilan non enregistré : ' + err.message);
    }

    // Refresh stock
    if (this.state.tournee?.id) {
      try { this.state.stock = await API.get(`/api/stock/${this.state.tournee.id}`); } catch {}
    }

    document.getElementById('gameScreen').style.display   = 'none';
    document.getElementById('resultScreen').style.display = 'block';
    this._renderResult(won, giftType);
  },

  _renderResult(won, giftType) {
    let html = '';
    if (won && giftType === 'Super Lot') {
      this._triggerConfetti();
      html = `
        <span class="result-icon">💎</span>
        <h2 class="result-title" style="color:var(--primary);">SUPER LOT DÉCROCHÉ !</h2>
        <p class="result-subtitle">Performance extraordinaire — ${this.state.agent?.nom} est exceptionnel !</p>`;
    } else if (won && giftType) {
      const icons = { 'Type 1':'🎁', 'Type 2':'🎀', 'Type 3':'🏆' };
      html = `
        <span class="result-icon">${icons[giftType] || '🎁'}</span>
        <h2 class="result-title" style="color:var(--success);">Cadeau ${giftType} Gagné !</h2>
        <p class="result-subtitle">${this.state.agent?.nom} a brillamment réussi le défi Avène</p>
        <div class="thermal-badge" style="margin:16px auto;display:inline-flex;">✅ Bilan enregistré</div>`;
    } else {
      const correct = this.state.currentQuestion?.blocs_corrects || [];
      html = `
        <span class="result-icon">💧</span>
        <h2 class="result-title">À la prochaine !</h2>
        <p class="result-subtitle">La bonne réponse était :</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:16px 0;">
          ${correct.map(w => `<span class="chip-tag">${w}</span>`).join('')}
        </div>`;
    }

    html += `
      <hr class="divider">
      <div class="actions-bar" style="justify-content:center;flex-wrap:wrap;gap:12px;">
        <button class="btn btn-primary btn-lg" onclick="GameEngine.resetGame()">🎮 Nouvelle session</button>
        <a href="/reporting.html" class="btn btn-outline btn-lg">📊 Voir les bilans</a>
        <a href="/agents.html"    class="btn btn-outline btn-lg">👤 Retour agents</a>
      </div>`;

    document.getElementById('resultContent').innerHTML = html;
  },

  // ── Indicateur niveaux ────────────────────────────────────
  _updateLevelDots() {
    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById(`lvl${i}dot`);
      if (!dot) continue;
      dot.className = 'level-dot';
      if (i < this.state.level)  dot.classList.add('complete');
      if (i === this.state.level) dot.classList.add('active');
    }
  },

  // ── Animations ────────────────────────────────────────────
  _triggerSuccessBubbles() {
    const overlay = document.getElementById('bubbleOverlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    overlay.classList.add('active');
    for (let i = 0; i < 20; i++) {
      const b   = document.createElement('div');
      b.className = 'bubble';
      const sz  = 20 + Math.random() * 70;
      const dur = 1.5 + Math.random() * 2;
      b.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;--dur:${dur}s;animation-delay:${Math.random()*1.2}s;opacity:${0.3+Math.random()*0.5};`;
      overlay.appendChild(b);
    }
    setTimeout(() => { overlay.classList.remove('active'); overlay.innerHTML = ''; }, 3500);
  },

  _triggerConfetti() {
    const colors = ['#E37A5A','#A2D2DF','#27AE60','#F39C12','#9B59B6','#ffffff'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const dur = 2 + Math.random() * 2;
      p.style.cssText = `left:${Math.random()*100}vw;top:-10px;background:${colors[~~(Math.random()*colors.length)]};--dur:${dur}s;animation-delay:${Math.random()*1.5}s;transform:rotate(${Math.random()*360}deg);`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), (dur + 2) * 1000);
    }
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = ~~(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // ── Reset ─────────────────────────────────────────────────
  resetGame() {
    this.state = {
      phase:'setup', level:1, tournee:null, pharmacie:null,
      agent:null, stock:null, currentQuestion:null,
      usedQuestionIds:[], questionsData:[], answerWords:[], poolWords:[]
    };
    document.getElementById('setupScreen').style.display  = 'block';
    document.getElementById('gameScreen').style.display   = 'none';
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('gameSubtitle').textContent   = 'Configuration de la session';
    document.getElementById('agentStatutAlert').style.display = 'none';
    document.getElementById('stockPreview').style.display = 'none';

    // Reset selects
    const selP = document.getElementById('selPharmacie');
    const selA = document.getElementById('selAgent');
    const selT = document.getElementById('selTournee');
    selT.value = '';
    selP.innerHTML = '<option value="">— Choisir une pharmacie —</option>';
    selP.disabled  = true;
    selA.innerHTML = '<option value="">— Choisir un agent —</option>';
    selA.disabled  = true;
    document.getElementById('startGameBtn').disabled = true;

    // Recharger les tournées
    this.init();
  }
};

// ── Bridges HTML onchange/onclick ─────────────────────────────
function onTourneeChange()   { GameEngine.onTourneeChange(); }
function onPharmacieChange() { GameEngine.onPharmacieChange(); }
function onAgentChange()     { GameEngine._checkAgentStatus(); }
function startGame()         { GameEngine.startGame(); }
function resetGame()         { GameEngine.resetGame(); }
