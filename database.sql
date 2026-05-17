-- ============================================================
-- AVÈNE PLATFORM - SQL INITIALIZATION SCRIPT
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. User Profiles (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'delegue' CHECK (role IN ('admin', 'delegue', 'manager')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tournées
CREATE TABLE IF NOT EXISTS tournees (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    stock_initial JSONB NOT NULL DEFAULT '{"type1": 50, "type2": 30, "type3": 10, "superlot": 2}',
    stock_actuel JSONB NOT NULL DEFAULT '{"type1": 50, "type2": 30, "type3": 10, "superlot": 2}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Pharmacies
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    tournee_id INT REFERENCES tournees(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('pharmacie', 'para', 'fournisseur')),
    telephone VARCHAR(50),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    est_visitee BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Agents
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    pharmacy_id INT REFERENCES pharmacies(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telephone VARCHAR(50),
    statut_jeu VARCHAR(100) DEFAULT 'Non Joué',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Questions
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    difficulte VARCHAR(10) CHECK (difficulte IN ('75%', '50%', '25%', '1%')),
    enonce TEXT NOT NULL,
    blocs_corrects TEXT[] NOT NULL,
    blocs_pieges TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Bilans
CREATE TABLE IF NOT EXISTS bilans (
    id SERIAL PRIMARY KEY,
    nom_pharmacie VARCHAR(255),
    nom_agent VARCHAR(255),
    q1 TEXT, r1 TEXT,
    q2 TEXT, r2 TEXT,
    q3 TEXT, r3 TEXT,
    q4 TEXT, r4 TEXT,
    cadeau_assigne BOOLEAN DEFAULT FALSE,
    cadeau_description TEXT DEFAULT 'Aucun',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ── Sample Data ──────────────────────────────────────────────

INSERT INTO questions (difficulte, enonce, blocs_corrects, blocs_pieges) VALUES
('75%', 'Complétez la phrase : L''eau thermale Avène est connue pour ses propriétés...', 
 ARRAY['apaisantes', 'anti-irritantes', 'hydratantes'], 
 ARRAY['énergisantes', 'stimulantes', 'tonifiantes']),

('50%', 'Quelle est la durée de résidence de l''eau dans le massif ?', 
 ARRAY['40', 'à', '50', 'ans'], 
 ARRAY['10', '20', '30', 'jours', 'mois']),

('25%', 'Le Centre Thermal Avène traite principalement les maladies...', 
 ARRAY['dermatologiques', 'chroniques', 'résistantes', 'aux', 'traitements', 'classiques'], 
 ARRAY['respiratoires', 'cardiovasculaires', 'neurologiques', 'aiguës']),

('1%', 'Identifiez les éléments clés de la composition de l''eau thermale Avène dans l''ordre correct :', 
 ARRAY['Calcium', 'Magnésium', 'Bicarbonate', 'Silice', 'Strontium'], 
 ARRAY['Sodium', 'Potassium', 'Chlorure', 'Fluor', 'Zinc']);

-- RLS Policies (disable for dev, enable for prod)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournees ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bilans ENABLE ROW LEVEL SECURITY;

-- Allow all for service role (backend uses service key)
CREATE POLICY "Service role full access" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Service role full access" ON tournees FOR ALL USING (true);
CREATE POLICY "Service role full access" ON pharmacies FOR ALL USING (true);
CREATE POLICY "Service role full access" ON agents FOR ALL USING (true);
CREATE POLICY "Service role full access" ON questions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON bilans FOR ALL USING (true);
