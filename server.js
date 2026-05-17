require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── HTTP helper (appelle Supabase REST depuis le serveur) ─────
function sbRequest(method, endpoint, body, userToken) {
  return new Promise((resolve, reject) => {
    const url      = new URL(SUPABASE_URL + endpoint);
    const isAuth   = endpoint.startsWith('/auth/v1');
    const apiKey   = SUPABASE_SERVICE_KEY;
    const authHdr  = userToken ? `Bearer ${userToken}` : `Bearer ${apiKey}`;
    const payload  = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':  'application/json',
        'apikey':        apiKey,
        'Authorization': authHdr,
        'Prefer':        'return=representation',
      }
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
        if (res.statusCode >= 400) {
          const msg = parsed?.message || parsed?.error_description || parsed?.error || parsed?.msg || `HTTP ${res.statusCode}`;
          reject(new Error(msg));
        } else {
          resolve(parsed);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Shortcuts
const db = {
  select : (table, qs='')    => sbRequest('GET',    `/rest/v1/${table}${qs}`),
  insert : (table, body)     => sbRequest('POST',   `/rest/v1/${table}`, body),
  update : (table, filter, body) => sbRequest('PATCH', `/rest/v1/${table}?${filter}`, body),
  delete : (table, filter)   => sbRequest('DELETE', `/rest/v1/${table}?${filter}`),
  single : async (table, qs) => {
    const rows = await sbRequest('GET', `/rest/v1/${table}${qs}`);
    return Array.isArray(rows) ? rows[0] : rows;
  }
};
const first = d => Array.isArray(d) ? d[0] : d;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware : valide le JWT Supabase ──────────────────
async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  const token = hdr.split(' ')[1];
  try {
    // Vérifie le token auprès de Supabase Auth
    const user = await sbRequest('GET', '/auth/v1/user', null, token);
    if (!user?.id) return res.status(401).json({ error: 'Token invalide' });
    req.user  = user;
    req.token = token;
    // Charge le profil (rôle)
    const rows = await db.select('user_profiles', `?id=eq.${user.id}&limit=1`);
    req.profile = Array.isArray(rows) ? rows[0] : rows;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expirée — reconnectez-vous' });
  }
}

function requireAdmin(req, res, next) {
  if (req.profile?.role === 'admin') return next();
  res.status(403).json({ error: 'Accès réservé aux administrateurs' });
}

// ── AUTH ──────────────────────────────────────────────────────
app.get('/api/auth/profile', requireAuth, (req, res) => {
  res.json({
    id:    req.user.id,
    email: req.user.email,
    nom:   req.profile?.nom  || req.user.email,
    role:  req.profile?.role || 'delegue'
  });
});

// Créer ou retourner le profil (appelé juste après l'inscription)
app.post('/api/auth/setup-profile', requireAuth, async (req, res) => {
  const { nom, role } = req.body;
  try {
    // Vérifier si le profil existe déjà
    const existing = await db.single('user_profiles', `?id=eq.${req.user.id}`);
    if (existing) return res.json(existing);

    const created = await db.insert('user_profiles', {
      id:    req.user.id,
      email: req.user.email,
      nom:   nom  || req.user.email,
      role:  role || 'delegue'
    });
    res.json(first(created));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── USERS ─────────────────────────────────────────────────────
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await db.select('user_profiles', '?order=created_at.desc') || []); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, nom, role } = req.body;
  try {
    const authUser = await sbRequest('POST', '/auth/v1/admin/users', {
      email, password, email_confirm: true
    });
    const profile = await db.insert('user_profiles', {
      id: authUser.id, email, nom, role: role || 'delegue'
    });
    res.json(first(profile));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { nom, role } = req.body;
  try {
    const data = await db.update('user_profiles', `id=eq.${req.params.id}`, { nom, role });
    res.json(first(data) || { success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await sbRequest('DELETE', `/auth/v1/admin/users/${req.params.id}`);
    await db.delete('user_profiles', `id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TOURNÉES ──────────────────────────────────────────────────
app.get('/api/tournees', requireAuth, async (req, res) => {
  try { res.json(await db.select('tournees', '?order=date_debut.desc') || []); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tournees', requireAuth, async (req, res) => {
  const { region, date_debut, date_fin, stock_initial } = req.body;
  try {
    const data = await db.insert('tournees', {
      region, date_debut, date_fin, stock_initial,
      stock_actuel: { ...stock_initial }
    });
    res.json(first(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tournees/:id', requireAuth, async (req, res) => {
  try {
    const data = await db.update('tournees', `id=eq.${req.params.id}`, req.body);
    res.json(first(data) || req.body);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tournees/:id', requireAuth, requireAdmin, async (req, res) => {
  try { await db.delete('tournees', `id=eq.${req.params.id}`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PHARMACIES ────────────────────────────────────────────────
app.get('/api/pharmacies', requireAuth, async (req, res) => {
  const { tournee_id } = req.query;
  try {
    let qs = '?order=nom';
    if (tournee_id) qs += `&tournee_id=eq.${tournee_id}`;
    res.json(await db.select('pharmacies', qs) || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/pharmacies', requireAuth, async (req, res) => {
  try { res.json(first(await db.insert('pharmacies', req.body))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/pharmacies/:id', requireAuth, async (req, res) => {
  try { res.json(first(await db.update('pharmacies', `id=eq.${req.params.id}`, req.body)) || req.body); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/pharmacies/:id', requireAuth, requireAdmin, async (req, res) => {
  try { await db.delete('pharmacies', `id=eq.${req.params.id}`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AGENTS ───────────────────────────────────────────────────
app.get('/api/agents', requireAuth, async (req, res) => {
  const { pharmacy_id } = req.query;
  try {
    let qs = '?order=nom';
    if (pharmacy_id) qs += `&pharmacy_id=eq.${pharmacy_id}`;
    res.json(await db.select('agents', qs) || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agents', requireAuth, async (req, res) => {
  try { res.json(first(await db.insert('agents', req.body))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/agents/:id', requireAuth, async (req, res) => {
  try { res.json(first(await db.update('agents', `id=eq.${req.params.id}`, req.body)) || req.body); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/agents/:id', requireAuth, requireAdmin, async (req, res) => {
  try { await db.delete('agents', `id=eq.${req.params.id}`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── QUESTIONS ────────────────────────────────────────────────
app.get('/api/questions/all', requireAuth, async (req, res) => {
  try { res.json(await db.select('questions', '?order=difficulte') || []); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/questions', requireAuth, async (req, res) => {
  const { difficulte, exclude } = req.query;
  try {
    let qs = '?order=id';
    if (difficulte) qs += `&difficulte=eq.${encodeURIComponent(difficulte)}`;
    let rows = await db.select('questions', qs) || [];
    if (exclude) {
      const ids = exclude.split(',').map(Number).filter(Boolean);
      rows = rows.filter(q => !ids.includes(q.id));
    }
    if (!rows.length) return res.status(404).json({ error: 'Aucune question disponible pour ce niveau' });
    res.json(rows[Math.floor(Math.random() * rows.length)]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/questions', requireAuth, requireAdmin, async (req, res) => {
  try { res.json(first(await db.insert('questions', req.body))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/questions/:id', requireAuth, requireAdmin, async (req, res) => {
  try { res.json(first(await db.update('questions', `id=eq.${req.params.id}`, req.body)) || req.body); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/questions/:id', requireAuth, requireAdmin, async (req, res) => {
  try { await db.delete('questions', `id=eq.${req.params.id}`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GAME SUBMIT ──────────────────────────────────────────────
app.post('/api/game/submit', requireAuth, async (req, res) => {
  const { agent_id, pharmacy_id, tournee_id, niveau, reponse_correcte, cadeau_choisi, questions_data } = req.body;
  try {
    const statut = reponse_correcte && cadeau_choisi ? `Gagné ${cadeau_choisi}`
                 : reponse_correcte ? `Niveau ${niveau} Réussi` : 'Perdu';

    await db.update('agents', `id=eq.${agent_id}`, { statut_jeu: statut });

    if (reponse_correcte && cadeau_choisi) {
      const tournee = await db.single('tournees', `?id=eq.${tournee_id}`);
      if (tournee) {
        const stock = { ...tournee.stock_actuel };
        const key   = cadeau_choisi === 'Super Lot' ? 'superlot' : `type${cadeau_choisi.replace('Type ','')}`;
        if (stock[key] > 0) stock[key]--;
        await db.update('tournees', `id=eq.${tournee_id}`, { stock_actuel: stock });
      }
    }

    const agent = await db.single('agents',    `?id=eq.${agent_id}`);
    const pharm = await db.single('pharmacies', `?id=eq.${pharmacy_id}`);

    const bilan = await db.insert('bilans', {
      nom_pharmacie: pharm?.nom || '',
      nom_agent:     agent?.nom || '',
      q1: questions_data?.[0]?.question || null, r1: questions_data?.[0]?.resultat || null,
      q2: questions_data?.[1]?.question || null, r2: questions_data?.[1]?.resultat || null,
      q3: questions_data?.[2]?.question || null, r3: questions_data?.[2]?.resultat || null,
      q4: questions_data?.[3]?.question || null, r4: questions_data?.[3]?.resultat || null,
      cadeau_assigne:     !!(reponse_correcte && cadeau_choisi),
      cadeau_description: cadeau_choisi || 'Aucun'
    });

    await db.update('pharmacies', `id=eq.${pharmacy_id}`, { est_visitee: true });
    res.json({ success: true, bilan: first(bilan), statut });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REPORTING ────────────────────────────────────────────────
app.get('/api/reporting', requireAuth, async (req, res) => {
  try { res.json(await db.select('bilans', '?order=created_at.desc') || []); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bilans/:id', requireAuth, requireAdmin, async (req, res) => {
  try { await db.delete('bilans', `id=eq.${req.params.id}`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── STOCK ────────────────────────────────────────────────────
app.get('/api/stock/:tournee_id', requireAuth, async (req, res) => {
  try {
    const data = await db.single('tournees', `?id=eq.${req.params.tournee_id}&select=stock_actuel,stock_initial,region`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ROOT ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/login.html'));

app.listen(PORT, () => console.log(`\n🌊 Avène Platform → http://localhost:${PORT}\n`));
