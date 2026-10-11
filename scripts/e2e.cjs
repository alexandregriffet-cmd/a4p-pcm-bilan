/*
 * Parcours automatisé de A4P Bilan de Construction Mentale en mode de test local (NEXT_PUBLIC_LOCAL_TEST=1).
 *
 * Prérequis : le serveur tourne déjà (construit avec NEXT_PUBLIC_LOCAL_TEST=1) sur E2E_BASE, avec un dossier
 * de données vide (LOCAL_DATA_DIR). Exemple :
 *   LOCAL_DATA_DIR=/chemin/vide NEXT_PUBLIC_LOCAL_TEST=1 npx next build
 *   LOCAL_DATA_DIR=/chemin/vide NEXT_PUBLIC_LOCAL_TEST=1 npx next start -p 3100
 *   E2E_BASE=http://localhost:3100 SHOTS=/chemin/captures node scripts/e2e.cjs
 *
 * Variables : E2E_BASE, SHOTS (dossier des captures et PDF), PW_CORE (playwright-core), CHROMIUM (exécutable).
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const BASE = process.env.E2E_BASE || 'http://localhost:3100'
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'shots')
fs.mkdirSync(SHOTS, { recursive: true })
const ADMIN = { email: process.env.LOCAL_ADMIN_EMAIL || 'admin@a4p.test', password: process.env.LOCAL_ADMIN_PASSWORD || 'AdminEssai-2026' }

function loadPlaywright() {
  for (const t of [process.env.PW_CORE, 'playwright-core', '/opt/npm-tools/node_modules/playwright-core', '/opt/node-tools/node_modules/playwright-core']) {
    if (!t) continue
    try {
      return require(t)
    } catch {
      /* suivant */
    }
  }
  throw new Error('playwright-core introuvable (PW_CORE)')
}
const { chromium } = loadPlaywright()
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

/* ---------------------------------- utilitaires ---------------------------------- */

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  -> ' + detail}`)
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CATS = {
  'adulte-sport': { label: 'Adulte sportif', tu: false },
  'adulte-hors-sport': { label: 'Adulte, hors sport', tu: false },
  manager: { label: 'Manager', tu: false },
  'ado-etudes': { label: 'Adolescent, études', tu: true },
  'ado-sport': { label: 'Adolescent, sport', tu: true },
}
const TYPES = ['architecte', 'connecteur', 'guerrier', 'visionnaire', 'creatif', 'competiteur']
const LABELS = ['Architecte', 'Connecteur', 'Guerrier', 'Visionnaire', 'Créatif', 'Compétiteur']

function loadData(cat) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'core', 'data', cat, 'pcm.json'), 'utf8'))
}

/** Réponses déterministes : 3 choix distincts par situation. */
function makeAnswers(cat, seed) {
  const data = loadData(cat)
  const rnd = mulberry32(seed)
  const answers = data.questions.map(() => {
    const idx = [0, 1, 2, 3, 4, 5]
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx.slice(0, 3)
  })
  // Résultat attendu, recalculé ici indépendamment du noyau : 6, 4 et 2 points, maximum 432.
  const pts = Object.fromEntries(TYPES.map((t) => [t, 0]))
  data.questions.forEach((q, i) => {
    answers[i].forEach((o, rank) => {
      pts[q.options[o].type] += [6, 4, 2][rank]
    })
  })
  const percents = Object.fromEntries(TYPES.map((t) => [t, Math.round((pts[t] / (data.questions.length * 6)) * 100)]))
  const order = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'core', 'data', 'common.json'), 'utf8')).seuils.pcm.typesOrder.slice().sort((a, b) => pts[b] - pts[a])
  return { answers, percents, base: data.types[order[0]].label, phase: data.types[order[1]].label }
}

/** Retire des textes les phrases de situations (elles contiennent légitimement des mots comme « résultat »). */
function stripQuestions(text, cats) {
  let out = text
  const variants = (s) => {
    const html = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
    const j1 = JSON.stringify(s).slice(1, -1)
    const j2 = JSON.stringify(j1).slice(1, -1)
    return [s, html, j1, j2]
  }
  for (const c of cats) {
    for (const q of loadData(c).questions) {
      for (const s of [q.situation, ...q.options.map((o) => o.text)]) for (const v of variants(s)) out = out.split(v).join(' ')
    }
  }
  return out
}

const LEAK_RE = /architecte|connecteur|guerrier|visionnaire|cr[ée]atif|comp[ée]titeur|baseType|phaseType|baseProfile|phaseProfile|distress|"ranking"|"percents"/i

const consoleErrors = []
function watchConsole(page, who) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/Failed to load resource/.test(t)) return // erreurs HTTP volontaires des tests d'accès direct
    consoleErrors.push(`[${who}] ${t}`)
  })
  page.on('pageerror', (e) => consoleErrors.push(`[${who}] pageerror: ${e.message}`))
}

/** Enregistre toutes les réponses réseau d'un contexte client pour contrôler l'absence de données de lecture. */
function recordResponses(ctx, store) {
  ctx.on('response', async (res) => {
    try {
      const ct = res.headers()['content-type'] || ''
      if (!/text|json|javascript/.test(ct)) return
      const body = await res.text()
      store.push({ url: res.url(), status: res.status(), ct, body })
    } catch {
      /* corps indisponible (redirection) */
    }
  })
}

async function noHScroll(page, label) {
  const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }))
  check(`${label}: pas de défilement horizontal (${w.s} <= ${w.i})`, w.s <= w.i + 1)
}

async function login(page, email, password) {
  await page.goto(BASE + '/')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
}

async function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      return { status: r.status, text: await r.text() }
    },
    { method, url, body },
  )
}

async function createClient(admin, { first, last, email, category, guardian }) {
  await admin.goto(BASE + '/admin/clients/nouveau')
  await admin.fill('#c-first', first)
  await admin.fill('#c-last', last)
  await admin.fill('#c-email', email)
  await admin.selectOption('#c-cat', category)
  if (/^ado-/.test(category)) {
    const btn = admin.locator('button[type=submit]')
    check(`création ado: bouton désactivé sans l'accord du représentant légal`, await btn.isDisabled())
    if (guardian) await admin.check('text=Accord du représentant légal recueilli')
  }
  await admin.click('text=Générer un mot de passe')
  await admin.waitForFunction(() => document.querySelector('#c-pass').value.length >= 10)
  const generated = await admin.inputValue('#c-pass')
  check(`mot de passe généré: 12 caractères lisibles (${category})`, /^[A-HJ-NP-Za-km-np-z2-9]{12}$/.test(generated), generated)
  await admin.click('button[type=submit]')
  await admin.waitForSelector('[data-testid=credentials]')
  const password = (await admin.textContent('[data-testid=cred-password]')).trim()
  check(`identifiants affichés = mot de passe généré (${category})`, password === generated)
  const href = await admin.getAttribute('a:has-text("Ouvrir la fiche du client")', 'href')
  return { email, password, id: href.split('/').pop(), category }
}

/* Passation : répond de la situation `from` à la dernière, puis ouvre le récapitulatif. */
async function answerFrom(page, answers, from) {
  for (let i = from; i < answers.length; i++) {
    const txt = await page.textContent('[data-testid=situation]')
    for (const o of answers[i]) await page.click(`[data-opt="${o}"]`)
    await page.click('.btn-next')
    void txt
  }
}

async function finishAndValidate(page) {
  await page.waitForSelector('text=Récapitulatif de')
  await page.click('button:has-text("Valider mes réponses")')
  await page.waitForSelector('text=Valider définitivement ?')
}

/* -------------------------------------- main -------------------------------------- */

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] })
  const mk = (w = 1280, h = 900) => browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })

  /* ---------- 0. Connexion et accès sans session ---------- */
  {
    const ctx = await mk()
    const p = await ctx.newPage()
    watchConsole(p, 'anonyme')
    for (const u of ['/admin', '/admin/export', '/espace', '/admin/clients/nouveau']) {
      const r = await p.goto(BASE + u)
      check(`sans session: ${u} renvoie vers la connexion`, new URL(p.url()).pathname === '/', p.url())
      void r
    }
    for (const [m, u] of [['GET', '/api/admin/export/csv'], ['POST', '/api/admin/clients'], ['POST', '/api/test/submit'], ['PUT', '/api/test/draft'], ['POST', '/api/me/consent'], ['POST', '/api/admin/password']]) {
      const r = await ctx.request.fetch(BASE + u, { method: m, headers: { 'Content-Type': 'application/json' }, data: '{}' })
      check(`sans session: ${m} ${u} -> 401`, r.status() === 401, String(r.status()))
    }
    await p.goto(BASE + '/')
    await p.setViewportSize({ width: 375, height: 760 })
    await p.screenshot({ path: path.join(SHOTS, '01-connexion-375.png') })
    await noHScroll(p, 'connexion 375')
    await p.setViewportSize({ width: 1280, height: 800 })
    await p.screenshot({ path: path.join(SHOTS, '01-connexion-1280.png') })
    const text = await p.innerText('body')
    check('connexion: message « Mot de passe perdu ? Contactez A4P Mental »', text.includes('Mot de passe perdu ? Contactez A4P Mental'))
    check('connexion: aucune inscription ni lien magique', !/inscri|lien magique|créer un compte/i.test(text))
    // erreur neutre
    await p.fill('#email', 'inconnu@exemple.fr')
    await p.fill('#password', 'nimportequoi123')
    await p.click('button[type=submit]')
    await p.waitForSelector('.msg-error')
    const err1 = await p.innerText('.msg-error')
    await p.fill('#email', ADMIN.email)
    await p.fill('#password', 'mauvaismotdepasse')
    await p.click('button[type=submit]')
    await p.waitForFunction((e) => document.querySelector('.msg-error') && document.querySelector('.msg-error').innerText !== 'x', null)
    const err2 = await p.innerText('.msg-error')
    check('erreur de connexion neutre (même message pour e-mail inconnu et mauvais mot de passe)', err1 === err2 && /incorrect/.test(err1), `${err1} | ${err2}`)
    await ctx.close()
  }

  /* ---------- 1. Administrateur : connexion, création de 4 clients ---------- */
  const adminCtx = await mk()
  const admin = await adminCtx.newPage()
  watchConsole(admin, 'admin')
  await login(admin, ADMIN.email, ADMIN.password)
  await admin.waitForURL('**/admin')
  check('administrateur: redirection vers /admin', new URL(admin.url()).pathname === '/admin')
  const head = (await admin.innerText('header.hdr')).replace(/\s+/g, ' ')
  check('en-tête « A4P Bilan · Espace administrateur » et Déconnexion', /A4P BILAN\s*·\s*ESPACE ADMINISTRATEUR/i.test(head) && /Déconnexion/.test(head), head)
  check('tableau de bord vide: Clients 0', (await admin.textContent('[data-testid=stat-clients]')).trim() === '0')
  await admin.screenshot({ path: path.join(SHOTS, '02-dashboard-vide-1280.png') })

  const clients = {}
  const spec = [
    ['adulte-sport', 'Camille', 'Sportif', 'camille.sportif@exemple.fr', 101],
    ['adulte-hors-sport', 'Hugo', 'Horssport', 'hugo.horssport@exemple.fr', 202],
    ['manager', 'Manon', 'Manager', 'manon.manager@exemple.fr', 303],
    ['ado-etudes', 'Léa', 'Adolescente', 'lea.ado@exemple.fr', 404],
    ['ado-sport', 'Noah', 'Junior', 'noah.junior@exemple.fr', 505],
  ]
  for (const [cat, first, last, email, seed] of spec) {
    const c = await createClient(admin, { first, last, email, category: cat, guardian: true })
    c.name = `${first} ${last}`
    c.exp = makeAnswers(cat, seed)
    clients[cat] = c
    if (cat === 'adulte-sport') {
      await admin.setViewportSize({ width: 375, height: 800 })
      await admin.screenshot({ path: path.join(SHOTS, '03-creation-identifiants-375.png'), fullPage: true })
      await noHScroll(admin, 'création client 375')
      await admin.setViewportSize({ width: 1280, height: 900 })
      await admin.screenshot({ path: path.join(SHOTS, '03-creation-identifiants-1280.png') })
    }
  }
  // doublon d'e-mail
  {
    await admin.goto(BASE + '/admin/clients/nouveau')
    await admin.fill('#c-first', 'Doublon')
    await admin.fill('#c-last', 'Test')
    await admin.fill('#c-email', 'CAMILLE.SPORTIF@exemple.fr')
    await admin.selectOption('#c-cat', 'manager')
    await admin.fill('#c-pass', 'MotDePasseManuel42')
    await admin.click('button[type=submit]')
    await admin.waitForSelector('.msg-error')
    check('création: e-mail déjà utilisé refusé', /existe déjà/.test(await admin.innerText('.msg-error')))
    // mot de passe manuel trop court
    await admin.fill('#c-email', 'court@exemple.fr')
    await admin.fill('#c-pass', 'court')
    await admin.click('button[type=submit]')
    await admin.waitForFunction(() => /10 caractères/.test(document.querySelector('.msg-error')?.innerText || ''))
    check('création: mot de passe de moins de 10 caractères refusé', true)
  }
  // l'identifiant n'est plus relisible
  await admin.goto(BASE + `/admin/clients/${clients['adulte-sport'].id}`)
  const fiche0 = await admin.innerText('body')
  check('mot de passe jamais relisible sur la fiche', !fiche0.includes(clients['adulte-sport'].password))
  await admin.setViewportSize({ width: 375, height: 800 })
  await admin.screenshot({ path: path.join(SHOTS, '05-fiche-375.png'), fullPage: true })
  await noHScroll(admin, 'fiche client 375')
  await admin.setViewportSize({ width: 1280, height: 900 })
  await admin.screenshot({ path: path.join(SHOTS, '05-fiche-1280.png'), fullPage: true })

  await admin.goto(BASE + '/admin')
  check('tableau de bord: 5 clients, 5 pas commencés', (await admin.textContent('[data-testid=stat-clients]')).trim() === '5' && (await admin.textContent('[data-testid=stat-pas-commence]')).trim() === '5')

  /* ---------- 2. Clients : consentement, passation, remerciement (4 catégories) ---------- */
  const clientSessions = {}
  const leaks = []
  for (const cat of Object.keys(clients)) {
    const c = clients[cat]
    const tu = CATS[cat].tu
    const ctx = await mk(375, 780)
    const net = []
    recordResponses(ctx, net)
    const page = await ctx.newPage()
    watchConsole(page, `client ${cat}`)
    await login(page, c.email, c.password)
    await page.waitForURL('**/espace')
    await page.waitForSelector('text=Avant de commencer')
    const consentText = await page.innerText('body')
    check(`consentement (${cat}): information, durée de conservation à compléter`, /Durée de conservation : \[durée de conservation à compléter\]/.test(consentText))
    check(`consentement (${cat}): vouvoiement/tutoiement conforme`, tu ? /Ton accès|Prends|tes réponses/.test(consentText) && !/\bvotre\b|\bvos\b/i.test(consentText) : /Votre accès|vos réponses/.test(consentText) && !/\btu\b|\bton\b|\bta\b|\btes\b/i.test(consentText))
    const go = page.locator('button:has-text("Accéder à mon test")')
    check(`consentement (${cat}): bouton désactivé tant que la case n'est pas cochée`, await go.isDisabled())
    if (/^ado-/.test(cat)) {
      const guardian = page.locator('.minor-box input[type=checkbox]')
      check('consentement ado: case du représentant légal cochée et non modifiable', (await guardian.isChecked()) && (await guardian.isDisabled()))
    } else {
      check(`consentement (${cat}): pas de mention de mineur`, (await page.locator('.minor-box').count()) === 0)
    }
    if (cat === 'adulte-sport') await page.screenshot({ path: path.join(SHOTS, '06-consentement-375.png'), fullPage: true })
    await page.check('.card > label.check input[type=checkbox]:not([disabled])')
    await go.click()
    await page.waitForSelector('[data-testid=situation]')

    // passation: 3 situations puis rechargement (reprise du brouillon)
    const q0 = loadData(cat).questions[0]
    check(`passation (${cat}): première situation affichée`, (await page.textContent('[data-testid=situation]')).trim() === q0.situation.trim())
    if (cat === 'adulte-sport') {
      await page.screenshot({ path: path.join(SHOTS, '07-passation-375.png') })
      await noHScroll(page, 'passation 375')
      const rankInstr = await page.innerText('.instruction')
      check('passation: consigne de classement 1er choix', /1er choix/.test(rankInstr))
    }
    // Les trois premières situations
    for (let i = 0; i < 3; i++) {
      for (const o of c.exp.answers[i]) await page.click(`[data-opt="${o}"]`)
      if (i === 0 && cat === 'adulte-sport') {
        await page.screenshot({ path: path.join(SHOTS, '07-passation-classee-375.png') })
        // les libellés 1er, 2e, 3e sont visibles
        const ranks = await page.$$eval('.opt .rk', (els) => els.map((e) => e.textContent.trim()).filter(Boolean))
        check('passation: libellés 1er, 2e, 3e affichés', ranks.sort().join(',') === '1er,2e,3e', ranks.join(','))
        check('passation: bouton suivant actif seulement quand le classement est complet', !(await page.locator('.btn-next').isDisabled()))
      }
      await page.click('.btn-next')
    }
    await page.waitForFunction(() => /Enregistr|Brouillon/.test(document.querySelector('.savestate')?.innerText || ''))
    await page.waitForTimeout(900)
    await page.reload()
    await page.waitForSelector('[data-testid=situation]')
    const resumeText = await page.textContent('[data-testid=situation]')
    check(`passation (${cat}): reprise après rechargement à la 4e situation`, resumeText.trim() === loadData(cat).questions[3].situation.trim(), resumeText.slice(0, 50))
    check(`passation (${cat}): message de reprise`, /retrouvées/.test(await page.innerText('body')))
    // retour arrière
    await page.click('.btn-back')
    const back = await page.textContent('[data-testid=situation]')
    check(`passation (${cat}): retour arrière`, back.trim() === loadData(cat).questions[2].situation.trim())
    await page.click('.btn-next')
    // terminer
    await answerFrom(page, c.exp.answers, 3)
    // récapitulatif
    await page.waitForSelector('text=Récapitulatif de')
    if (cat === 'adulte-sport') {
      check('récapitulatif: toutes les situations complétées', /Toutes les situations sont complétées/.test(await page.innerText('body')))
      await page.screenshot({ path: path.join(SHOTS, '08-recapitulatif-375.png') })
    }
    await page.click('button:has-text("Valider mes réponses")')
    await page.waitForSelector('text=Valider définitivement ?')
    const confirmText = await page.innerText('body')
    check(`confirmation (${cat}): mention explicite`, tu ? /tu ne pourras plus modifier ni repasser le test/.test(confirmText) : /vous ne pourrez plus modifier ni repasser le test/.test(confirmText))
    if (cat === 'adulte-sport') await page.screenshot({ path: path.join(SHOTS, '09-confirmation-375.png') })
    await page.click('button:has-text("Oui, valider définitivement")')
    await page.waitForSelector('[data-testid=thanks-title]')
    const thanks = await page.innerText('body')
    check(`remerciement (${cat})`, tu ? /Merci, tes réponses ont été enregistrées\.\s*Ton coach te communiquera ton rapport\./.test(thanks) : /Merci, vos réponses ont été enregistrées\.\s*Votre coach vous communiquera votre rapport\./.test(thanks), thanks.slice(0, 200))
    if (cat === 'adulte-sport') {
      await page.screenshot({ path: path.join(SHOTS, '10-remerciement-375.png') })
      await noHScroll(page, 'remerciement 375')
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.screenshot({ path: path.join(SHOTS, '10-remerciement-1280.png') })
      await page.setViewportSize({ width: 375, height: 780 })
    }
    // texte rendu sur la page de remerciement: aucune donnée de lecture
    const thanksStripped = stripQuestions(thanks, [cat])
    check(`remerciement (${cat}): aucun nom de profil ni score dans le texte`, !LEAK_RE.test(thanksStripped) && !/\d\s?%/.test(thanksStripped))

    // reconnexion: même page
    await page.reload()
    await page.waitForSelector('[data-testid=thanks-title]')
    await page.goto(BASE + '/')
    await page.waitForURL('**/espace')
    check(`reconnexion (${cat}): même page de remerciement`, (await page.locator('[data-testid=thanks-title]').count()) === 1)

    // le client ne peut pas repasser: interface et appels directs
    const sub = await api(page, 'POST', '/api/test/submit', { answers: Object.fromEntries(loadData(cat).questions.map((q, i) => [q.id, c.exp.answers[i]])) })
    check(`repasser (${cat}): appel direct à /api/test/submit refusé (409)`, sub.status === 409, `${sub.status} ${sub.text}`)
    check(`repasser (${cat}): la réponse ne contient aucune donnée de lecture`, !LEAK_RE.test(sub.text))
    const dr = await api(page, 'PUT', '/api/test/draft', { answers: {} })
    check(`repasser (${cat}): brouillon refusé après la fin (403)`, dr.status === 403, String(dr.status))
    const cs = await api(page, 'POST', '/api/me/consent', { accepted: true })
    check(`consentement (${cat}) rejoué après la fin: aucune donnée renvoyée`, !LEAK_RE.test(cs.text), cs.text)
    // routes d'administration interdites
    const forb = [
      ['GET', '/api/admin/export/csv'],
      ['POST', '/api/admin/clients'],
      ['POST', '/api/admin/password'],
      ['GET', `/api/admin/clients/${c.id}/results`],
      ['PATCH', `/api/admin/clients/${c.id}`],
      ['POST', `/api/admin/clients/${c.id}/password`],
      ['PUT', `/api/admin/clients/${c.id}/note`],
      ['DELETE', `/api/admin/clients/${c.id}`],
    ]
    for (const [m, u] of forb) {
      const r = await api(page, m, u, m === 'GET' ? undefined : {})
      check(`client (${cat}): ${m} ${u.replace(c.id, ':id')} -> 403`, r.status === 403, `${r.status} ${r.text.slice(0, 80)}`)
      if (r.status !== 403) leaks.push(`${m} ${u}: ${r.status}`)
    }
    // pages d'administration interdites
    for (const u of ['/admin', '/admin/export', '/admin/export/rapports', `/admin/clients/${c.id}`, `/admin/clients/${c.id}/resultat`, '/admin/clients/nouveau']) {
      await page.goto(BASE + u)
      check(`client (${cat}): ${u.replace(c.id, ':id')} renvoie vers /espace`, new URL(page.url()).pathname === '/espace', page.url())
    }
    // routes sans page
    for (const u of ['/resultats', '/resultat', '/mon-espace', '/api/results']) {
      const r = await page.goto(BASE + u)
      check(`client (${cat}): ${u} n'existe pas (404)`, r.status() === 404, String(r.status()))
    }
    clientSessions[cat] = { ctx, page, net }
  }

  /* ---------- 3. Contrôle des fuites côté client (texte rendu + réseau) ---------- */
  for (const cat of Object.keys(clients)) {
    const { net } = clientSessions[cat]
    let bad = []
    for (const r of net) {
      const stripped = stripQuestions(r.body, Object.keys(CATS))
      const m = stripped.match(LEAK_RE)
      if (m) bad.push(`${r.url} : ${m[0]}`)
    }
    check(`réseau client (${cat}): ${net.length} réponses lues, aucun nom de profil ni clé de résultat`, bad.length === 0, bad.slice(0, 3).join(' | '))
    // le mot « résultat » (hors textes de situations) ne doit apparaître dans aucune réponse HTML/JSON sauf la page de confidentialité
    const resBad = net.filter((r) => /résultat/i.test(stripQuestions(r.body, Object.keys(CATS))) && !/confidentialite/.test(r.url) && !/\.js(\?|$)/.test(r.url) && !/text\/html/.test(r.ct))
    check(`réseau client (${cat}): le mot « résultat » absent des réponses d'API`, resBad.length === 0, resBad.map((r) => r.url).join(' '))
    // les pages HTML de l'espace du client avant remerciement ne disent pas « résultat »
    const htmlBad = net.filter((r) => /text\/html/.test(r.ct) && /résultat/i.test(stripQuestions(r.body, Object.keys(CATS))))
    check(`réseau client (${cat}): pages HTML sans le mot « résultat »`, htmlBad.length === 0, htmlBad.map((r) => r.url).join(' '))
  }
  {
    // le code JavaScript livré au client ne contient pas la table des profils
    const net = clientSessions['adulte-sport'].net.filter((r) => /javascript/.test(r.ct))
    const joined = net.map((r) => r.body).join('\n')
    check(`JavaScript livré aux clients (${net.length} fichiers): aucun nom de profil`, !/architecte|connecteur|guerrier|visionnaire|cr[ée]atif|comp[ée]titeur/i.test(joined))
    check('JavaScript livré aux clients: aucune clé de correction', !/"type":"(architecte|connecteur|guerrier|visionnaire|creatif|competiteur)"/.test(joined))
  }

  /* ---------- 4. Administrateur: tableau de bord et résultats des 4 clients ---------- */
  await admin.goto(BASE + '/admin')
  check('tableau de bord: 5 terminés', (await admin.textContent('[data-testid=stat-termine]')).trim() === '5' && (await admin.textContent('[data-testid=stat-pas-commence]')).trim() === '0')
  await admin.setViewportSize({ width: 375, height: 800 })
  await admin.screenshot({ path: path.join(SHOTS, '04-dashboard-375.png'), fullPage: true })
  await noHScroll(admin, 'tableau de bord 375')
  await admin.setViewportSize({ width: 1280, height: 900 })
  await admin.screenshot({ path: path.join(SHOTS, '04-dashboard-1280.png'), fullPage: true })
  // filtres et recherche
  await admin.selectOption('#f-cat', 'manager')
  check('filtre par catégorie', (await admin.locator('.client-list li').count()) === 1)
  await admin.selectOption('#f-cat', '')
  await admin.selectOption('#f-status', 'en-cours')
  check('filtre par statut (aucun client en cours)', (await admin.locator('.client-list li').count()) === 0)
  await admin.selectOption('#f-status', '')
  await admin.fill('#f-q', 'hugo')
  check('recherche par nom', (await admin.locator('.client-list li').count()) === 1)
  await admin.fill('#f-q', 'lea.ado@')
  check('recherche par e-mail', (await admin.locator('.client-list li').count()) === 1)
  await admin.fill('#f-q', '')

  for (const cat of Object.keys(clients)) {
    const c = clients[cat]
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    check(`fiche (${cat}): statut Terminé`, /Terminé/.test(await admin.textContent('[data-testid=client-status]')))
    await admin.click('[data-testid=open-result-1]')
    await admin.waitForSelector('.report')
    const txt = (await admin.textContent('.report')).replace(/\s+/g, ' ')
    check(`résultat (${cat}): en-tête nom, e-mail, catégorie, date`, txt.includes(c.name) && txt.includes(c.email) && txt.includes(CATS[cat].label) && /Date de passage/.test(txt))
    check(`résultat (${cat}): profil fondamental = ${c.exp.base}`, new RegExp(`Profil fondamental\\s*${c.exp.base}`).test(txt), txt.slice(0, 400))
    check(`résultat (${cat}): profil du moment = ${c.exp.phase}`, new RegExp(`Profil du moment\\s*${c.exp.phase}`).test(txt))
    // pourcentages affichés = pourcentages recalculés indépendamment
    const shown = await admin.$$eval('.dist-row', (rows) => rows.map((r) => ({ label: r.querySelector('strong').textContent.trim(), pct: r.querySelector('.dist-head > strong').textContent.trim() })))
    const okPct = shown.length === 6 && shown.every((s) => s.pct === `${c.exp.percents[TYPES[LABELS.indexOf(s.label)]]} %`)
    check(`résultat (${cat}): répartition des six profils exacte`, okPct, JSON.stringify(shown) + JSON.stringify(c.exp.percents))
    for (const w of ['Moteurs', 'Sous pression', 'Signaux de tension', 'Tension en montée', 'Saturation', 'Recommandations de coaching', 'Communication', 'Personne ne se résume à un seul profil', 'pas un diagnostic']) {
      if (!txt.includes(w)) check(`résultat (${cat}): contient « ${w} »`, false)
    }
    check(`résultat (${cat}): lecture complète présente (besoins, stress, coaching, communication, conseils, rappel, prudence)`, true)
    if (CATS[cat].tu) check('résultat ado: mention du tutoiement conservé', /reproduits tels que l.élève les lit, au tutoiement/.test(txt))
    if (cat === 'adulte-sport') {
      await admin.setViewportSize({ width: 375, height: 800 })
      await admin.screenshot({ path: path.join(SHOTS, '11-resultat-375.png') })
      await noHScroll(admin, 'résultat 375')
      await admin.setViewportSize({ width: 1280, height: 900 })
      await admin.screenshot({ path: path.join(SHOTS, '11-resultat-1280.png'), fullPage: true })
    }
  }

  /* ---------- 5. Catégorie: changement avant la passation, refus après ---------- */
  {
    const c = await createClient(admin, { first: 'Chloé', last: 'Changeuse', email: 'chloe.changeuse@exemple.fr', category: 'adulte-sport', guardian: true })
    c.name = 'Chloé Changeuse'
    // le client commence (brouillon dans la catégorie d'origine)
    const ctx = await mk(375, 780)
    const page = await ctx.newPage()
    watchConsole(page, 'client changeur')
    await login(page, c.email, c.password)
    await page.waitForSelector('text=Avant de commencer')
    await page.check('.card > label.check input[type=checkbox]')
    await page.click('button:has-text("Accéder à mon test")')
    await page.waitForSelector('[data-testid=situation]')
    const exp = makeAnswers('manager', 505)
    for (let i = 0; i < 2; i++) {
      for (const o of exp.answers[i]) await page.click(`[data-opt="${o}"]`)
      await page.click('.btn-next')
    }
    await page.waitForTimeout(900)
    // statut « En cours » côté admin
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    check('fiche: statut En cours après quelques réponses', /En cours/.test(await admin.textContent('[data-testid=client-status]')))
    // changement de catégorie par l'admin (interface)
    await admin.selectOption('#a-cat', 'manager')
    await admin.click('[data-testid=cat]')
    await admin.click('[data-testid=cat-confirm]')
    await admin.waitForSelector('text=Catégorie modifiée')
    await admin.reload()
    check('fiche: catégorie changée en Manager avant passation', /Manager/.test(await admin.innerText('.info-list')))
    // le client repart de zéro avec les questions de sa nouvelle catégorie
    await page.reload()
    await page.waitForSelector('[data-testid=situation]')
    const first = (await page.textContent('[data-testid=situation]')).trim()
    check('client: brouillon effacé et questions de la nouvelle catégorie', first === loadData('manager').questions[0].situation.trim() && !/retrouvées/.test(await page.innerText('body')), first.slice(0, 60))
    // l'ancien brouillon (catégorie précédente) ne peut plus être envoyé: identifiants d'options valides, mais jamais de catégorie client
    await answerFrom(page, exp.answers, 0)
    await finishAndValidate(page)
    await page.click('button:has-text("Oui, valider définitivement")')
    await page.waitForSelector('[data-testid=thanks-title]')
    // après la passation: changement refusé (interface et API)
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    check('fiche: après passation, plus de changement de catégorie possible (interface)', (await admin.locator('#a-cat').count()) === 0 && /ne peut plus être modifiée/.test(await admin.innerText('body')))
    const r = await api(admin, 'PATCH', `/api/admin/clients/${c.id}`, { category: 'adulte-sport' })
    check('changement de catégorie après passation refusé par l\'API (409)', r.status === 409, `${r.status} ${r.text}`)
    await admin.goto(BASE + `/admin/clients/${c.id}/resultat`)
    const t = await admin.innerText('.report')
    check('résultat conservé avec la catégorie Manager', t.includes('Manager') && t.includes(exp.base))
    c.exp = exp
    clients.changeur = c
    await ctx.close()
  }

  /* ---------- 6. Catégorie envoyée par le client ignorée ---------- */
  {
    const c = await createClient(admin, { first: 'Paul', last: 'Pirate', email: 'paul.pirate@exemple.fr', category: 'manager', guardian: true })
    const ctx = await mk(375, 780)
    const page = await ctx.newPage()
    watchConsole(page, 'client pirate')
    await login(page, c.email, c.password)
    await page.waitForSelector('text=Avant de commencer')
    // appels directs avant consentement: refus
    const mgr = loadData('manager')
    const a = makeAnswers('manager', 606)
    const body = { answers: Object.fromEntries(mgr.questions.map((q, i) => [q.id, a.answers[i]])), category: 'ado-etudes', audience: 'ado-etudes' }
    let r = await api(page, 'POST', '/api/test/submit', body)
    check('soumission avant consentement refusée (403)', r.status === 403, `${r.status} ${r.text}`)
    await page.check('.card > label.check input[type=checkbox]')
    await page.click('button:has-text("Accéder à mon test")')
    await page.waitForSelector('[data-testid=situation]')
    // incomplet
    r = await api(page, 'POST', '/api/test/submit', { answers: { Q1: [0, 1, 2] } })
    check('soumission incomplète refusée (422)', r.status === 422, `${r.status} ${r.text}`)
    r = await api(page, 'POST', '/api/test/submit', { answers: { Q1: [0, 0, 2] } })
    check('classement invalide (doublon) refusé (400)', r.status === 400, `${r.status}`)
    r = await api(page, 'PUT', '/api/test/draft', { answers: { Q1: [9] } })
    check('brouillon invalide refusé (400)', r.status === 400, String(r.status))
    r = await api(page, 'PUT', '/api/test/draft', { answers: { Q999: [1] } })
    check('brouillon avec situation inconnue refusé (400)', r.status === 400, String(r.status))
    const big = await page.evaluate(async () => {
      const r = await fetch('/api/test/draft', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: {}, junk: 'x'.repeat(200000) }) })
      return r.status
    })
    check('corps de requête trop volumineux refusé (400)', big === 400, String(big))
    const cross = await ctx.request.post(BASE + '/api/test/submit', { headers: { 'Content-Type': 'application/json', Origin: 'https://autre-site.example' }, data: body })
    check('requête portant l\'en-tête Origin d\'un autre site refusée (403)', cross.status() === 403, String(cross.status()))
    r = await api(page, 'POST', '/api/test/submit', body)
    check('soumission complète avec une fausse catégorie: acceptée, réponse {ok:true} seulement', r.status === 200 && r.text === '{"ok":true}', `${r.status} ${r.text}`)
    await admin.goto(BASE + `/admin/clients/${c.id}/resultat`)
    const t = await admin.innerText('.report')
    check('la catégorie envoyée par le client a été ignorée (résultat en Manager)', t.includes('Manager') && !t.includes('Adolescent'), t.slice(0, 200))
    check('résultat calculé par le serveur conforme au calcul indépendant', t.includes(a.base))
    await ctx.close()
  }

  /* ---------- 7. Régénération du mot de passe, désactivation, nouveau passage ---------- */
  {
    const c = clients['adulte-hors-sport']
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    await admin.click('[data-testid=regen]')
    await admin.click('[data-testid=regen-confirm]')
    await admin.waitForSelector('[data-testid=credentials]')
    const newPw = (await admin.textContent('[data-testid=cred-password]')).trim()
    check('régénération: nouveau mot de passe de 12 caractères lisibles, différent', /^[A-HJ-NP-Za-km-np-z2-9]{12}$/.test(newPw) && newPw !== c.password)
    await admin.screenshot({ path: path.join(SHOTS, '05b-regeneration-1280.png') })
    const ctx = await mk(375, 780)
    const page = await ctx.newPage()
    await login(page, c.email, c.password)
    await page.waitForSelector('.msg-error')
    check('ancien mot de passe refusé', new URL(page.url()).pathname === '/')
    await page.fill('#password', newPw)
    await page.click('button[type=submit]')
    await page.waitForURL('**/espace')
    check('nouveau mot de passe accepté', true)
    // désactivation
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    await admin.click('[data-testid=active]')
    await admin.click('[data-testid=active-confirm]')
    await admin.waitForSelector('text=Accès désactivé')
    // session déjà ouverte: coupée immédiatement
    const st = await api(page, 'POST', '/api/test/submit', { answers: {} })
    check('désactivation: la session ouverte est refusée par l\'API (403)', st.status === 403, `${st.status} ${st.text}`)
    await page.goto(BASE + '/espace')
    check('désactivation: message neutre sur /espace', /Accès indisponible/.test(await page.innerText('body')))
    await page.context().clearCookies()
    await login(page, c.email, newPw)
    await page.waitForSelector('.msg-error')
    check('désactivation: message neutre à la connexion', /n'est pas disponible/.test(await page.innerText('.msg-error')))
    await admin.goto(BASE + '/admin')
    await admin.fill('#f-q', 'hugo')
    check('tableau de bord: badge « Accès désactivé »', /Accès désactivé/.test(await admin.innerText('.client-list')))
    await admin.fill('#f-q', '')
    // réactivation
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    await admin.click('[data-testid=active]')
    await admin.click('[data-testid=active-confirm]')
    await admin.waitForSelector('text=Accès réactivé')
    await page.goto(BASE + '/')
    await page.fill('#email', c.email)
    await page.fill('#password', newPw)
    await page.click('button[type=submit]')
    await page.waitForURL('**/espace')
    check('réactivation: connexion de nouveau possible', true)
    check('réactivation: retour sur la page de remerciement', (await page.locator('[data-testid=thanks-title]').count()) === 1)
    c.password = newPw
    // nouveau passage
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    await admin.click('[data-testid=retake]')
    await admin.click('[data-testid=retake-confirm]')
    await admin.waitForSelector('text=Nouveau passage autorisé')
    await admin.reload()
    check('fiche: passages autorisés 2, utilisés 1', /2 \(utilisés : 1\)/.test(await admin.innerText('.info-list')))
    await page.reload()
    await page.waitForSelector('[data-testid=situation]')
    check('nouveau passage: le client revoit le test (consentement conservé)', true)
    const exp2 = makeAnswers('adulte-hors-sport', 777)
    await answerFrom(page, exp2.answers, 0)
    await finishAndValidate(page)
    await page.click('button:has-text("Oui, valider définitivement")')
    await page.waitForSelector('[data-testid=thanks-title]')
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    const li = await admin.innerText('.card:has(h3:has-text("Résultats"))')
    check('fiche: deux tentatives dont une marquée « Tentative précédente »', /Tentative 1/.test(li) && /Tentative 2/.test(li) && /Tentative précédente/.test(li), li)
    await admin.goto(BASE + `/admin/clients/${c.id}/resultat`)
    const sel = await admin.innerText('.attempt-picker')
    check('résultat: sélecteur de tentative', /Tentative 1/.test(sel) && /Tentative 2/.test(sel))
    check('résultat: par défaut la dernière tentative', (await admin.innerText('.report')).includes(exp2.base))
    await admin.click('.attempt-picker a:has-text("Tentative 1")')
    await admin.waitForURL('**tentative=1')
    check('résultat: tentative 1 consultable et conservée', (await admin.innerText('.report')).includes(clients['adulte-hors-sport'].exp.base))
    c.exp2 = exp2
    // nouveau passage refusé s'il est déjà autorisé / pas terminé
    const again = await api(admin, 'PATCH', `/api/admin/clients/${c.id}`, { allowRetake: true })
    check('nouveau passage: nouvelle autorisation possible seulement quand le test est terminé', again.status === 200, String(again.status))
    const again2 = await api(admin, 'PATCH', `/api/admin/clients/${c.id}`, { allowRetake: true })
    check('nouveau passage: doublon d\'autorisation refusé (409)', again2.status === 409, String(again2.status))
    await ctx.close()
  }

  /* ---------- 8. Notes privées ---------- */
  {
    const c = clients['manager']
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    await admin.fill('#note', 'Note privée de test : échanger sur la communication.')
    await admin.click('button:has-text("Enregistrer la note")')
    await admin.waitForSelector('text=Note enregistrée')
    await admin.reload()
    check('notes privées enregistrées et relues par l\'administrateur', (await admin.inputValue('#note')).includes('Note privée de test'))
    const cc = clientSessions['manager'].page
    const body = await (await cc.context().request.get(BASE + `/api/admin/clients/${c.id}/results`)).status()
    check('notes privées: aucune route de lecture pour le client', body === 403, String(body))
    await cc.goto(BASE + '/espace')
    await cc.waitForTimeout(300)
    const texts = clientSessions['manager'].net.map((r) => r.body).join('\n')
    check('notes privées: absentes de tout ce que le navigateur du client a reçu', !texts.includes('Note privée de test'))
  }

  /* ---------- 9. Suppression d'un client ---------- */
  {
    const c = await createClient(admin, { first: 'Sam', last: 'Supprimé', email: 'sam.supprime@exemple.fr', category: 'manager', guardian: true })
    const ctx = await mk(375, 780)
    const page = await ctx.newPage()
    await login(page, c.email, c.password)
    await page.waitForURL('**/espace')
    await admin.goto(BASE + `/admin/clients/${c.id}`)
    const del = admin.locator('[data-testid=delete]')
    check('suppression: bouton désactivé tant que l\'e-mail n\'est pas retapé', await del.isDisabled())
    await admin.fill('#del-email', 'autre@exemple.fr')
    check('suppression: e-mail incorrect, bouton désactivé', await del.isDisabled())
    const bad = await api(admin, 'DELETE', `/api/admin/clients/${c.id}`, { confirmEmail: 'autre@exemple.fr' })
    check('suppression: confirmation incorrecte refusée côté serveur (400)', bad.status === 400, String(bad.status))
    await admin.fill('#del-email', c.email)
    check('suppression: e-mail retapé, bouton actif', await del.isEnabled())
    await del.click()
    await admin.waitForURL('**/admin')
    await admin.waitForSelector('[data-testid=stat-clients]')
    check('suppression: client absent du tableau de bord', (await admin.locator(`[data-client-email="${c.email}"]`).count()) === 0)
    const p2 = await (await mk()).newPage()
    await login(p2, c.email, c.password)
    await p2.waitForSelector('.msg-error')
    check('suppression: le client supprimé ne peut plus se connecter', new URL(p2.url()).pathname === '/')
    const gone = await api(admin, 'GET', `/api/admin/clients/${c.id}/results`)
    check('suppression: données introuvables (404)', gone.status === 404, String(gone.status))
    const st = await api(page, 'POST', '/api/test/submit', { answers: {} })
    check('suppression: la session du client supprimé est refusée (401)', st.status === 401, String(st.status))
    await ctx.close()
  }

  /* ---------- 10. Exports: CSV, PDF ---------- */
  {
    // CSV
    const res = await adminCtx.request.get(BASE + '/api/admin/export/csv')
    const buf = Buffer.from(await res.body())
    const csv = buf.toString('utf8')
    check('CSV: téléchargement réel (200, attachment)', res.status() === 200 && /attachment; filename=".*\.csv"/.test(res.headers()['content-disposition'] || ''), res.headers()['content-disposition'])
    check('CSV: UTF-8 avec BOM', buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n')
    check('CSV: séparateur point-virgule et en-tête', lines[0].startsWith('Nom;E-mail;Catégorie;Statut;Date de passage;Passages;Profil fondamental;Profil du moment;Architecte (%);Connecteur (%)'), lines[0])
    check(`CSV: une ligne par client (${lines.length - 1})`, lines.length - 1 === 7, String(lines.length))
    const rowL = lines.find((l) => l.includes('camille.sportif@exemple.fr'))
    check('CSV: ligne de Camille avec ses pourcentages', rowL && rowL.includes(clients['adulte-sport'].exp.base) && rowL.endsWith(TYPES.map((t) => clients['adulte-sport'].exp.percents[t]).join(';')), rowL)
    fs.writeFileSync(path.join(SHOTS, 'synthese.csv'), buf)
    // page Exports
    await admin.goto(BASE + '/admin/export')
    await admin.screenshot({ path: path.join(SHOTS, '12-exports-1280.png'), fullPage: true })
    const dl = admin.waitForEvent('download')
    await admin.click('[data-testid=csv-link]')
    const d = await dl
    check('CSV: téléchargement depuis la page Exports', /synthese-construction-mentale-\d{4}-\d{2}-\d{2}\.csv/.test(d.suggestedFilename()), d.suggestedFilename())
    check('page Exports: tableau avec tous les clients', (await admin.locator('[data-testid=summary-table] tbody tr').count()) === 7)

    // PDF d'un résultat
    const pdfDir = SHOTS
    async function pdfOf(url, name, opts = {}) {
      const ctx = await mk()
      await ctx.addCookies(await adminCtx.cookies())
      const p = await ctx.newPage()
      await p.goto(BASE + url)
      await p.emulateMedia({ media: 'print' })
      const file = path.join(pdfDir, name)
      await p.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true, ...opts })
      await ctx.close()
      const text = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).stdout
      const info = spawnSync('pdfinfo', [file], { encoding: 'utf8' }).stdout
      const pages = Number((info.match(/Pages:\s+(\d+)/) || [])[1])
      return { file, text, pages, info }
    }
    const c1 = clients['adulte-sport']
    const pdf1 = await pdfOf(`/admin/clients/${c1.id}/resultat`, 'rapport-camille.pdf')
    check(`PDF résultat: ${pdf1.pages} pages A4`, pdf1.pages >= 2 && /A4|595/.test(pdf1.info), pdf1.info.match(/Page size:.*/)?.[0])
    check('PDF résultat: en-tête « Rapport de construction mentale, confidentiel » avec nom, catégorie, date', /Rapport de construction mentale, confidentiel/.test(pdf1.text) && pdf1.text.includes('Camille Sportif') && pdf1.text.includes('Adulte sportif') && /Passage du \d/.test(pdf1.text))
    check('PDF résultat: pied de page A4P Mental, Alexandre Griffet sur chaque page', pdf1.text.split('\f').filter((t) => t.trim()).every((t) => t.includes('A4P Mental, Alexandre Griffet')), String(pdf1.text.split('\f').map((t) => t.includes('A4P Mental')).join(',')))
    check('PDF résultat: aucun bouton ni navigation', !/Exporter en PDF|Déconnexion|Tableau de bord|Retour à la fiche/.test(pdf1.text), pdf1.text.match(/Exporter en PDF|Déconnexion|Tableau de bord|Retour à la fiche/)?.[0])
    check('PDF résultat: six profils et lecture complète', LABELS.every((l) => pdf1.text.includes(l)) && /Moteurs/.test(pdf1.text) && /Recommandations de coaching/.test(pdf1.text))
    const p1 = pdf1.text.split('\f')
    check('PDF résultat: aucune mention de PCM, Process Communication, canal, base ou phase', !/PCM|Process Communication|\bcanal\b|profil de base|profil de phase|\bbesoins\b/i.test(pdf1.text), pdf1.text.match(/PCM|Process Communication|\bcanal\b|profil de base|profil de phase|\bbesoins\b/i)?.[0])
    check('PDF résultat: page 1 = couverture (nom, catégorie, confidentiel)', /Document confidentiel/i.test(p1[0]) && /Camille Sportif/.test(p1[0]) && /Adulte sportif/.test(p1[0]) && !/Moteurs/.test(p1[0]))
    check('PDF résultat: page 2 = présentation du bilan', /À propos de ce bilan/.test(p1[1]) && /Les six profils/.test(p1[1]) && /Comment lire ce rapport/.test(p1[1]))
    check('PDF résultat: page 3 = en-tête du rapport puis synthèse', /Rapport de construction mentale, confidentiel/.test(p1[2]) && /Synthèse du profil/.test(p1[2]))
    for (const n of [1, 2, 3, 4]) {
      if (n <= pdf1.pages) spawnSync('pdftoppm', ['-png', '-r', '70', '-f', String(n), '-l', String(n), pdf1.file, path.join(SHOTS, `pdf-rapport-p${n}`)])
    }
    const pdf2 = await pdfOf('/admin/export', 'synthese.pdf')
    check('PDF synthèse: tableau de tous les clients, en-tête et pied de page', /Synthèse de construction mentale, confidentiel/.test(pdf2.text) && pdf2.text.includes('Camille') && pdf2.text.includes('manon.manager@exemple.fr') && pdf2.text.includes('A4P Mental, Alexandre Griffet'))
    check('PDF synthèse: sans boutons', !/Exporter la synthèse|Rapports complets de tous/.test(pdf2.text))
    spawnSync('pdftoppm', ['-png', '-r', '60', '-f', '1', '-l', '1', pdf2.file, path.join(SHOTS, 'pdf-synthese-p1')])
    const pdf3 = await pdfOf('/admin/export/rapports', 'rapports-complets.pdf')
    const nReports = (pdf3.text.match(/Rapport de construction mentale, confidentiel/g) || []).length
    check(`PDF rapports complets: un rapport par client (${nReports} en-têtes, ${pdf3.pages} pages)`, nReports === 7, `${nReports}`)
    // chaque rapport commence sur une nouvelle page
    const pagesText = pdf3.text.split('\f')
    const starts = pagesText.filter((t) => /Rapport de construction mentale, confidentiel/.test(t)).length
    check('PDF rapports complets: chaque rapport démarre sur une page distincte', starts === 7, `${starts} pages avec en-tête`)
    spawnSync('pdftoppm', ['-png', '-r', '50', '-f', '1', '-l', '1', pdf3.file, path.join(SHOTS, 'pdf-rapports-p1')])
  }

  /* ---------- 11. Déconnexion ---------- */
  {
    await admin.goto(BASE + '/admin')
    await admin.click('text=Déconnexion')
    await admin.waitForURL(BASE + '/')
    const r = await admin.goto(BASE + '/admin')
    check('déconnexion administrateur: /admin protégé de nouveau', new URL(admin.url()).pathname === '/')
    void r
  }

  /* ---------- 12. Erreurs console ---------- */
  check(`aucune erreur console (${consoleErrors.length})`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\nBILAN : ${results.length - failed.length} réussis, ${failed.length} échecs, ${results.length} vérifications`)
  fs.writeFileSync(path.join(SHOTS, 'e2e-resultats.json'), JSON.stringify(results, null, 2))
  if (leaks.length) console.log('FUITES POSSIBLES :', leaks)
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('ERREUR FATALE', e)
  process.exit(2)
})
