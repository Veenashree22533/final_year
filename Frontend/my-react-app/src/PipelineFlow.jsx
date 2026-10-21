import { useEffect, useMemo, useRef, useState } from 'react'
import './PipelineFlow.css'

/* ---------- Tunables (keep in sync with the backend) ---------- */

const THRESHOLD = 0.35 // rag_pipeline.py: abstain below this similarity
const BONUS = 0.15 // retriever.py: budget re-rank bonus
const TOP_K = 5 // rag_pipeline.py: products sent to the LLM
const DWELL = 800 // ms the query rests on a node
const TRAVEL = 1000 // ms the query takes to travel along a line

const money = (n) => '₹' + Number(n).toLocaleString('en-IN')

/* ---------- Device icons (phone / laptop / watch) ---------- */

const GLYPH = {
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.6" />
      <path d="M2 19.5h20" />
    </>
  ),
  smartwatch: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <path d="M9.5 7l.6-4h3.8l.6 4M9.5 17l.6 4h3.8l.6-4" />
      <path d="M12 10v2.2l1.4 1" />
    </>
  ),
}
const CAT_LABEL = { phone: 'Phone', laptop: 'Laptop', smartwatch: 'Watch' }

function DeviceIcon({ cat, size = 18 }) {
  return (
    <svg
      className="pf-dev"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPH[cat]}
    </svg>
  )
}

/* ---------- Diagram geometry ---------- */

const W = 150
const H = 70

const NODES = {
  fe: { n: 1, x: 60, y: 40, title: 'React frontend', sub: 'user query' },
  api: { n: 2, x: 245, y: 40, title: 'FastAPI', sub: 'POST /chat/' },
  parser: { n: 3, x: 430, y: 40, title: 'Query parser', sub: 'query_parser.py' },
  lookup: { n: 4, x: 615, y: 40, title: 'Name lookup', sub: 'retriever.py' },
  embed: { n: 5, x: 800, y: 40, title: 'Embed query', sub: 'Sentence Transformer' },
  rerank: { n: 7, x: 985, y: 40, title: 'Budget re-rank', sub: 'retriever.py' },
  pine: { n: 6, x: 870, y: 215, h: 80, kind: 'db', title: 'Pinecone', sub: 'vector search' },
  csv: { x: 615, y: 215, h: 80, kind: 'db', offline: true, title: 'Catalog CSV', sub: '2,554 products' },
  check: { n: 8, x: 985, y: 400, title: 'Abstain check', sub: 'score ≥ 0.35 ?' },
  mongo: { n: 9, x: 800, y: 395, h: 80, kind: 'db', title: 'MongoDB Atlas', sub: 'product records' },
  ctx: { n: 10, x: 615, y: 400, title: 'Build context', sub: 'top 5 products' },
  llm: { n: 11, x: 430, y: 400, title: 'Gemini', sub: 'llm.py' },
  repair: { n: 12, x: 245, y: 400, title: 'Repair IDs', sub: 'rag_pipeline.py' },
  resp: { n: 13, x: 60, y: 400, title: 'Respond', sub: 'answer + cards' },
  nocat: { n: '!', x: 985, y: 570, h: 50, title: 'Not in catalog', sub: 'abstain' },
}

const geo = (id) => ({ x: NODES[id].x, y: NODES[id].y, w: W, h: NODES[id].h || H })
const pt = (id, side, off = 0) => {
  const g = geo(id)
  if (side === 'top') return [g.x + g.w / 2 + off, g.y]
  if (side === 'bottom') return [g.x + g.w / 2 + off, g.y + g.h]
  if (side === 'left') return [g.x, g.y + g.h / 2 + off]
  return [g.x + g.w, g.y + g.h / 2 + off]
}
const line = (...pts) => 'M' + pts.map(([x, y]) => `${x} ${y}`).join(' L')
const elbow = (a, b) => line(a, [b[0], a[1]], b) // horizontal, then vertical

const EDGES = {
  'fe-api': line(pt('fe', 'right'), pt('api', 'left')),
  'api-parser': line(pt('api', 'right'), pt('parser', 'left')),
  'parser-lookup': line(pt('parser', 'right'), pt('lookup', 'left')),
  'lookup-embed': line(pt('lookup', 'right'), pt('embed', 'left')),
  // bypass over “Name lookup” for budget queries
  'parser-embed': line(pt('parser', 'top'), [pt('parser', 'top')[0], 18], [pt('embed', 'top')[0], 18], pt('embed', 'top')),
  'embed-pine': line(pt('embed', 'bottom', 25), pt('pine', 'top', -45)),
  'pine-rerank': elbow(pt('pine', 'right'), pt('rerank', 'bottom', -20)),
  'rerank-check': line(pt('rerank', 'bottom', 50), pt('check', 'top', 50)),
  'check-mongo': line(pt('check', 'left'), pt('mongo', 'right')),
  'mongo-ctx': line(pt('mongo', 'left'), pt('ctx', 'right')),
  'ctx-llm': line(pt('ctx', 'left'), pt('llm', 'right')),
  'llm-repair': line(pt('llm', 'left'), pt('repair', 'right')),
  'repair-resp': line(pt('repair', 'left'), pt('resp', 'right')),
  'check-nocat': line(pt('check', 'bottom'), pt('nocat', 'top')),
  'nocat-resp': elbow(pt('nocat', 'left'), pt('resp', 'bottom')),
  // built offline, not part of a query
  'csv-pine': line(pt('csv', 'right'), pt('pine', 'left')),
  'csv-mongo': line(pt('csv', 'bottom'), [pt('csv', 'bottom')[0], 350], [pt('mongo', 'top')[0], 350], pt('mongo', 'top')),
}
const OFFLINE = new Set(['csv-pine', 'csv-mongo'])

// What the moving dot is carrying on each line
const PAYLOAD = {
  'fe-api': 'query text',
  'api-parser': 'message',
  'parser-lookup': 'filters + query',
  'parser-embed': 'filters + query',
  'lookup-embed': 'pinned match',
  'embed-pine': 'vector + filters',
  'pine-rerank': 'IDs + scores',
  'rerank-check': 'ranked list',
  'check-mongo': 'top 5 IDs',
  'mongo-ctx': 'records',
  'ctx-llm': '5 context blocks',
  'llm-repair': 'answer text',
  'repair-resp': 'answer + IDs',
  'check-nocat': 'abstain',
  'nocat-resp': '“Not in our catalog”',
}

/* ---------- Step explanations ---------- */

const INFO = {
  fe: {
    title: 'User query',
    where: 'React frontend',
    text: 'The shopper types or speaks a query in English or Hinglish. The frontend sends it to the backend as POST /chat/ with { message }.',
  },
  api: {
    title: 'API request',
    where: 'FastAPI · main.py',
    text: 'FastAPI receives POST /chat/ and hands the message to the RAG pipeline (answer_query in rag_pipeline.py).',
  },
  parser: {
    title: 'Parse the query',
    where: 'query_parser.py',
    text: 'Extracts category, brand, min/max price, RAM and storage. Understands Hinglish numbers (hazaar, lakh) and phrases (ke andar, tak, se upar). Durations such as “upto 21 days” are not read as budgets.',
  },
  lookup: {
    title: 'Look up named products',
    where: 'retriever.py',
    text: 'If the query names a product (full or partial), those catalog entries are placed first. Skipped for budget queries. A model number the product lacks rules the match out.',
  },
  embed: {
    title: 'Embed the query',
    where: 'embeddings.py · Sentence Transformer',
    text: 'The query text is turned into an embedding vector. Queries with similar meaning land near each other, which is what makes semantic search work.',
  },
  pine: {
    title: 'Vector search + hard filters',
    where: 'vector_services.py · Pinecone',
    text: 'Pinecone compares the query vector with the stored product vectors. The parsed filters are applied as metadata filters, so products that break a rule never get scored. It returns product IDs with similarity scores; the retriever asks for 4× more candidates than needed.',
  },
  rerank: {
    title: 'Budget-aware re-rank',
    where: 'retriever.py',
    text: 'When there is a budget, products closer to the ceiling get a +0.15 style bonus so “phone under 50k” is not answered only with the cheapest phones. Skipped for “cheap” / “sasta” queries.',
  },
  check: {
    title: 'Abstain check',
    where: 'rag_pipeline.py',
    text: 'If nothing was found, or the best similarity score is below 0.35, the system abstains with “Not in our catalog” instead of guessing.',
  },
  mongo: {
    title: 'Fetch product records',
    where: 'MongoDB Atlas',
    text: 'MongoDB Atlas stores the structured product records. The top 5 IDs are looked up to get price, RAM, storage, screen, battery and description.',
  },
  ctx: {
    title: 'Build context',
    where: 'rag_pipeline.py',
    text: 'Each of the top 5 products becomes a text block. Laptop prices converted from EUR are marked as estimates.',
  },
  llm: {
    title: 'Generate answer',
    where: 'llm.py · Gemini',
    text: 'Gemini writes the recommendation and explanation using only the retrieved context.',
  },
  repair: {
    title: 'Repair product IDs',
    where: 'rag_pipeline.py',
    text: 'Any product ID in the answer that was not retrieved is mapped back to the closest retrieved ID.',
  },
  resp: {
    title: 'Respond',
    where: 'React frontend',
    text: 'The frontend shows the answer text and the matched products as cards you can open, wishlist or add to the cart.',
  },
  nocat: {
    title: 'Abstain',
    where: 'llm.py · abstain message',
    text: 'The LLM is not called. The user gets “Not in our catalog” instead of an invented product.',
  },
}

/* ---------- Example queries ----------
   Every product below is a made-up sample. Filtering is computed from the
   rules (category / brand / budget), not hard-coded, so the reasons stay true. */

const SCENARIOS = {
  budget: {
    kind: 'budget',
    label: 'Budget (Hinglish)',
    query: 'mujhe 25 hazaar ke andar accha phone chahiye',
    category: 'phone',
    brand: null,
    maxPrice: 25000,
    steps: ['fe', 'api', 'parser', 'embed', 'pine', 'rerank', 'check', 'mongo', 'ctx', 'llm', 'repair', 'resp'],
    parse: [
      ['25 hazaar ke andar', 'max_price', '25000'],
      ['phone', 'category', 'phone'],
    ],
    lookupNote: 'Skipped: budget queries are shopping queries, not name lookups.',
    pool: [
      { id: 'ph_0012', name: 'Sample Phone A', brand: 'Brand A', category: 'phone', price: 24499, sim: 0.71 },
      { id: 'ph_0045', name: 'Sample Phone B', brand: 'Brand B', category: 'phone', price: 22999, sim: 0.74 },
      { id: 'lp_0310', name: 'Sample Laptop L', brand: 'Brand L', category: 'laptop', price: 54990, sim: 0.69 },
      { id: 'ph_0101', name: 'Sample Phone C', brand: 'Brand C', category: 'phone', price: 19999, sim: 0.78 },
      { id: 'ph_0077', name: 'Sample Phone D', brand: 'Brand D', category: 'phone', price: 16499, sim: 0.8 },
      { id: 'sw_0099', name: 'Sample Watch W', brand: 'Brand W', category: 'smartwatch', price: 8999, sim: 0.66 },
      { id: 'ph_0150', name: 'Sample Phone E', brand: 'Brand E', category: 'phone', price: 24999, sim: 0.72 },
      { id: 'ph_0210', name: 'Sample Phone G', brand: 'Brand G', category: 'phone', price: 31999, sim: 0.77 },
      { id: 'ph_0033', name: 'Sample Phone F', brand: 'Brand F', category: 'phone', price: 12999, sim: 0.76 },
      { id: 'ph_0310', name: 'Sample Phone H', brand: 'Brand H', category: 'phone', price: 27499, sim: 0.75 },
    ],
  },
  named: {
    kind: 'named',
    label: 'Named product',
    query: 'price of Garmin Instinct 2S Solar',
    category: null,
    brand: 'Garmin',
    maxPrice: null,
    steps: ['fe', 'api', 'parser', 'lookup', 'embed', 'pine', 'rerank', 'check', 'mongo', 'ctx', 'llm', 'repair', 'resp'],
    parse: [['Garmin Instinct 2S Solar', 'brand', 'Garmin']],
    lookupNote: 'Matched “Garmin Instinct 2S Solar” by name, so it is pinned to the top of the list.',
    pool: [
      { id: 'sw_0412', name: 'Garmin Instinct 2S Solar', brand: 'Garmin', category: 'smartwatch', price: 31990, sim: 0.92, pinned: true },
      { id: 'sw_0415', name: 'Garmin Sample Watch B', brand: 'Garmin', category: 'smartwatch', price: 28990, sim: 0.74 },
      { id: 'ph_0120', name: 'Sample Phone K', brand: 'Brand K', category: 'phone', price: 21999, sim: 0.41 },
      { id: 'sw_0230', name: 'Brand C Sample Watch', brand: 'Brand C', category: 'smartwatch', price: 24990, sim: 0.71 },
      { id: 'sw_0418', name: 'Garmin Sample Watch C', brand: 'Garmin', category: 'smartwatch', price: 24990, sim: 0.71 },
      { id: 'lp_0200', name: 'Sample Laptop M', brand: 'Brand M', category: 'laptop', price: 62990, sim: 0.22 },
      { id: 'sw_0188', name: 'Brand D Sample Watch', brand: 'Brand D', category: 'smartwatch', price: 19990, sim: 0.68 },
      { id: 'sw_0420', name: 'Garmin Sample Watch D', brand: 'Garmin', category: 'smartwatch', price: 19990, sim: 0.66 },
      { id: 'ph_0140', name: 'Sample Phone N', brand: 'Brand N', category: 'phone', price: 15999, sim: 0.38 },
      { id: 'lp_0222', name: 'Sample Laptop P', brand: 'Brand P', category: 'laptop', price: 45990, sim: 0.2 },
    ],
  },
  abstain: {
    kind: 'abstain',
    label: 'Not in catalog',
    query: 'iPhone 17 Pro Max 1TB',
    category: 'phone',
    brand: 'Apple',
    maxPrice: null,
    steps: ['fe', 'api', 'parser', 'lookup', 'embed', 'pine', 'rerank', 'check', 'nocat', 'resp'],
    parse: [
      ['iPhone', 'brand', 'Apple'],
      ['iPhone', 'category', 'phone'],
    ],
    lookupNote: 'No catalog product has this name, so nothing is pinned.',
    pool: [
      { id: 'ph_0160', name: 'Apple Sample Phone 1', brand: 'Apple', category: 'phone', price: 79999, sim: 0.31 },
      { id: 'ph_0170', name: 'Sample Phone R', brand: 'Brand R', category: 'phone', price: 69999, sim: 0.27 },
      { id: 'lp_0301', name: 'Apple Sample Laptop', brand: 'Apple', category: 'laptop', price: 119990, sim: 0.22 },
      { id: 'ph_0161', name: 'Apple Sample Phone 2', brand: 'Apple', category: 'phone', price: 89999, sim: 0.29 },
      { id: 'sw_0501', name: 'Apple Sample Watch', brand: 'Apple', category: 'smartwatch', price: 41999, sim: 0.21 },
      { id: 'ph_0185', name: 'Sample Phone S', brand: 'Brand S', category: 'phone', price: 59999, sim: 0.26 },
      { id: 'ph_0162', name: 'Apple Sample Phone 3', brand: 'Apple', category: 'phone', price: 99999, sim: 0.27 },
      { id: 'ph_0190', name: 'Sample Phone T', brand: 'Brand T', category: 'phone', price: 49999, sim: 0.24 },
      { id: 'ph_0195', name: 'Sample Phone U', brand: 'Brand U', category: 'phone', price: 44999, sim: 0.23 },
      { id: 'ph_0200', name: 'Sample Phone V', brand: 'Brand V', category: 'phone', price: 39999, sim: 0.22 },
    ],
  },
}

/* ---------- Filtering + scoring (the live calculation) ---------- */

// Hard filters from the parsed query, applied in this order. A product is
// removed by the FIRST rule it breaks, and the reason is built from the rule.
function rulesFor(sc) {
  const rules = []
  if (sc.category) {
    rules.push({
      key: 'category',
      label: `category = ${sc.category}`,
      fail: (p) => p.category !== sc.category && `${CAT_LABEL[p.category]} — query asks for ${sc.category}`,
    })
  }
  if (sc.brand) {
    rules.push({
      key: 'brand',
      label: `brand = ${sc.brand}`,
      fail: (p) => p.brand !== sc.brand && `Made by ${p.brand}, not ${sc.brand}`,
    })
  }
  if (sc.maxPrice) {
    rules.push({
      key: 'price',
      label: `price ≤ ${money(sc.maxPrice)}`,
      fail: (p) => p.price > sc.maxPrice && `${money(p.price)} > ${money(sc.maxPrice)} budget`,
    })
  }
  return rules
}

// ASSUMPTION: bonus = BONUS × (price ÷ budget). Adjust to match retriever.py.
function evaluate(sc) {
  const rules = rulesFor(sc)
  const all = sc.pool.map((p, slot) => {
    let removedBy = null
    let reason = null
    for (const r of rules) {
      const why = r.fail(p)
      if (why) {
        removedBy = r.key
        reason = why
        break
      }
    }
    const bonus = !removedBy && sc.maxPrice ? +(BONUS * Math.min(p.price / sc.maxPrice, 1)).toFixed(3) : 0
    return { ...p, slot, removedBy, reason, bonus, final: +(p.sim + bonus).toFixed(3) }
  })
  const surv = all.filter((p) => !p.removedBy)
  const order = (key) => [...surv].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b[key] - a[key])
  const bySim = order('sim')
  const byFinal = order('final')
  surv.forEach((p) => {
    p.simRank = bySim.indexOf(p)
    p.finalRank = byFinal.indexOf(p)
  })
  return { all, surv, rules }
}

function answerText(sc, top) {
  if (sc.kind === 'named') {
    const more = top.slice(1, 3).map((r) => r.name)
    return `${top[0].name} is listed at ${money(top[0].price)}.${more.length ? ` Similar options: ${more.join(', ')}.` : ''}`
  }
  return `Best picks under ${money(sc.maxPrice)}: ${top
    .slice(0, 3)
    .map((r, i) => `${i + 1}. ${r.name} (${r.id}) at ${money(r.price)}`)
    .join('; ')}.`
}

const vector = (s) => {
  let h = 7
  return Array.from({ length: 28 }, (_, i) => {
    h = (h * 31 + s.charCodeAt(i % s.length) + i) % 997
    return (h % 100) / 100
  })
}

function journeyNote(id, sc, data, best, top) {
  const n = data.all.length
  const removed = data.all.filter((p) => p.removedBy).length
  switch (id) {
    case 'lookup':
      return sc.lookupNote
    case 'pine':
      return `Pinecone applied ${data.rules.map((r) => r.label).join(' and ')}: ${removed} of ${n} sample products removed, ${data.surv.length} left to rank.`
    case 'rerank': {
      if (!sc.maxPrice) return 'No budget in the query, so no bonus is added: the order stays by similarity.'
      const ent = data.surv.filter((p) => p.finalRank < TOP_K && p.simRank >= TOP_K)
      const drp = data.surv.filter((p) => p.finalRank >= TOP_K && p.simRank < TOP_K)
      if (!ent.length) return `The budget bonus re-orders the list; the top ${TOP_K} stay the same.`
      return `The budget bonus lifts ${ent.map((p) => p.name).join(', ')} into the top ${TOP_K}${
        drp.length ? ` and pushes ${drp.map((p) => p.name).join(', ')} out` : ''
      }.`
    }
    case 'check':
      return best >= THRESHOLD
        ? `Best similarity ${best.toFixed(2)} ≥ ${THRESHOLD}: enough evidence, so an answer is generated.`
        : `Best similarity ${best.toFixed(2)} < ${THRESHOLD}: all ${data.surv.length} candidates are rejected.`
    case 'mongo':
    case 'ctx':
    case 'llm':
    case 'repair': {
      const out = data.surv.length - top.length
      return `Only the top ${top.length} products are sent to Gemini${
        out > 0 ? `; ${out} lower-ranked ${out === 1 ? 'product is' : 'products are'} left out` : ''
      }.`
    }
    case 'nocat':
      return 'Nothing is sent to Gemini, so no product can be invented.'
    case 'resp':
      return sc.kind === 'abstain'
        ? 'No product cards are shown, only the abstain message.'
        : `${top.length} products travel into the output as cards.`
    default:
      return `${n} sample products from the catalog. The hard filters are applied at the Pinecone step.`
  }
}

/* ---------- Small pieces ---------- */

function Typewriter({ text }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), 20)
    return () => clearInterval(t)
  }, [text])
  return (
    <span>
      {text.slice(0, n)}
      <i className="pf-caret" />
    </span>
  )
}

function StepVisual({ id, sc, data, top, best }) {
  const rows = data.surv
  switch (id) {
    case 'fe':
      return <pre className="pf-code">{`POST /chat/\n{ "message": "${sc.query}" }`}</pre>
    case 'api':
      return (
        <pre className="pf-code">{`answer_query("${sc.query}")\n  parse → retrieve → generate\n  returns { response, matches[] }`}</pre>
      )
    case 'parser':
      return (
        <div className="pf-maps">
          {sc.parse.map(([tok, field, val]) => (
            <div key={field} className="pf-map">
              <code>{tok}</code>
              <span>→</span>
              <b>{field}</b> = {val}
            </div>
          ))}
        </div>
      )
    case 'lookup':
      return <p className="pf-note">{sc.lookupNote}</p>
    case 'embed':
      return (
        <>
          <div className="pf-vec" aria-hidden="true">
            {vector(sc.query).map((v, i) => (
              <i key={i} style={{ height: 4 + v * 40 }} />
            ))}
          </div>
          <p className="pf-note">Query → vector of numbers (values shown are illustrative).</p>
        </>
      )
    case 'pine': {
      const n = data.all.length
      let left = n
      return (
        <>
          <ul className="pf-rules">
            <li>
              <span>Sample catalog</span>
              <b>{n} products</b>
            </li>
            {data.rules.map((r) => {
              const c = data.all.filter((p) => p.removedBy === r.key).length
              left -= c
              return (
                <li key={r.key}>
                  <span>
                    <code>{r.label}</code>
                  </span>
                  <b className="neg">removes {c}</b>
                </li>
              )
            })}
            <li className="sum">
              <span>Left to rank</span>
              <b>{left}</b>
            </li>
          </ul>
          <p className="pf-note">
            In the real system Pinecone applies these filters across the full catalog (2,554 products). The lane
            below shows {n} sample products.
          </p>
        </>
      )
    }
    case 'rerank': {
      if (!sc.maxPrice) {
        return <p className="pf-note">No budget in the query, so no bonus is added. Order = similarity.</p>
      }
      const lead = rows.find((r) => r.finalRank === 0)
      const entered = rows.filter((r) => r.finalRank < TOP_K && r.simRank >= TOP_K)
      const dropped = rows.filter((r) => r.finalRank >= TOP_K && r.simRank < TOP_K)
      return (
        <>
          <pre className="pf-code">{`final = similarity + ${BONUS} × (price ÷ budget)\n${lead.name}:\n${lead.sim.toFixed(2)} + ${BONUS} × (${money(lead.price)} ÷ ${money(sc.maxPrice)}) = ${lead.final.toFixed(3)}`}</pre>
          {(entered.length > 0 || dropped.length > 0) && (
            <p className="pf-note">
              {entered.map((r) => `▲ ${r.name} enters the top ${TOP_K}`).join(' · ')}
              {entered.length > 0 && dropped.length > 0 ? ' · ' : ''}
              {dropped.map((r) => `▼ ${r.name} drops out`).join(' · ')}
            </p>
          )}
        </>
      )
    }
    case 'check': {
      const pass = best >= THRESHOLD
      return (
        <>
          <div className="pf-gauge" aria-hidden="true">
            <div className={`pf-gauge-fill ${pass ? 'ok' : 'bad'}`} style={{ width: best * 100 + '%' }} />
            <span className="pf-gauge-mark" style={{ left: THRESHOLD * 100 + '%' }} />
          </div>
          <p className="pf-note">
            Best similarity {best.toFixed(2)} {pass ? '≥' : '<'} {THRESHOLD} →{' '}
            <b>{pass ? 'continue' : 'abstain'}</b>
          </p>
        </>
      )
    }
    case 'mongo':
      return (
        <ul className="pf-recs">
          {top.map((r) => (
            <li key={r.id}>
              <code>{r.id}</code> → {r.brand} · {money(r.price)}
            </li>
          ))}
        </ul>
      )
    case 'ctx': {
      const r = top[0]
      return (
        <pre className="pf-code">{`[${r.id}] ${r.category} · ${r.brand} · ${r.name}\nPrice ${money(r.price)}\n(+ ${top.length - 1} more blocks)`}</pre>
      )
    }
    case 'llm':
      return (
        <p className="pf-answer">
          <Typewriter text={answerText(sc, top)} />
        </p>
      )
    case 'repair': {
      const real = top[0].id
      const bad = real.replace(/_0+/, '_')
      return (
        <p className="pf-note">
          <code className="pf-bad">{bad === real ? real + 'x' : bad}</code> → <code className="pf-good">{real}</code>
          <br />
          Every ID in the answer must be one of the retrieved IDs.
        </p>
      )
    }
    case 'resp':
      return sc.kind === 'abstain' ? (
        <p className="pf-answer">“Not in our catalog.” No product cards are shown.</p>
      ) : (
        <div className="pf-cards">
          {top.map((r) => (
            <div key={r.id} className="pf-card">
              <span className="pf-card-img">
                <DeviceIcon cat={r.category} size={22} />
              </span>
              <b>{r.name}</b>
              <small>{money(r.price)}</small>
            </div>
          ))}
        </div>
      )
    case 'nocat':
      return <p className="pf-answer">“Not in our catalog.” Gemini is never called.</p>
    default:
      return null
  }
}

/* ---------- Product journey lane ---------- */

const COLX = { a1: 0, a2: 208, b: 450, c: 660, d: 870 }
const PITCH = 44
const TOP0 = 32

// Where each product is, and why, at the current step.
function placeToken(p, f, sc) {
  const slotX = p.slot < 5 ? COLX.a1 : COLX.a2
  const slotY = TOP0 + (p.slot % 5) * PITCH
  const idle = { x: slotX, y: slotY, tone: 'idle', sub: `${p.category} · ${p.brand}`, delay: 0 }
  if (!f.sim) return idle
  if (p.removedBy) return { ...idle, tone: 'removed', sub: p.reason }

  const abstain = sc.kind === 'abstain'
  const rank = f.bonus ? p.finalRank : p.simRank
  const calc =
    f.bonus && sc.maxPrice
      ? `${p.sim.toFixed(2)} + ${p.bonus.toFixed(3)} = ${p.final.toFixed(3)}`
      : `similarity ${p.sim.toFixed(2)}`
  const inB = {
    x: COLX.b,
    y: TOP0 + rank * PITCH,
    tone: 'kept',
    sub: p.pinned ? `name match · ${calc}` : calc,
    delay: p.simRank * 60,
  }
  if (abstain && f.check) return { ...inB, tone: 'removed', sub: `${p.sim.toFixed(2)} < ${THRESHOLD} cutoff` }
  if (!f.cut) return inB
  if (p.finalRank >= TOP_K) return { ...inB, tone: 'removed', sub: `Rank ${p.finalRank + 1}, outside top ${TOP_K}` }

  const y = TOP0 + p.finalRank * PITCH
  if (!f.resp) {
    return { x: COLX.c, y, tone: 'kept', sub: `final ${p.final.toFixed(3)} → Gemini`, delay: p.finalRank * 80 }
  }
  return { x: COLX.d, y, tone: 'out', sub: '✓ shown to the user', delay: p.finalRank * 80 }
}

function Journey({ data, f, sc }) {
  const rowsNeeded = Math.max(5, data.surv.length)
  const height = TOP0 + rowsNeeded * PITCH + 4
  const abstain = sc.kind === 'abstain'
  const colBg = (x, w) => ({ left: 12 + x - 6, width: w + 12 })

  return (
    <div className="pf-lane-scroll">
      <div className="pf-lane" style={{ height }} role="group" aria-label="Product journey">
        <i className="pf-lane-col" style={colBg(COLX.a1, 408)} />
        <i className="pf-lane-col" style={colBg(COLX.b, 200)} />
        <i className="pf-lane-col" style={colBg(COLX.c, 200)} />
        <i className="pf-lane-col" style={colBg(COLX.d, 200)} />

        <span className="pf-lane-h" style={{ left: 12 + COLX.a1 }}>
          Catalog sample · {data.all.length}
        </span>
        <span className="pf-lane-h" style={{ left: 12 + COLX.b }}>
          Passed filters{f.sim ? ` · ${data.surv.length}` : ''}
        </span>
        <span className="pf-lane-h" style={{ left: 12 + COLX.c }}>Top {TOP_K} → Gemini</span>
        <span className="pf-lane-h" style={{ left: 12 + COLX.d }}>Shown to user</span>

        {data.all.map((p) => {
          const t = placeToken(p, f, sc)
          const best = f.sim && !p.removedBy && p.finalRank === 0 && t.tone !== 'removed'
          return (
            <div
              key={p.id}
              className={`pf-tok ${t.tone} ${best ? 'best' : ''}`}
              style={{ transform: `translate(${t.x}px, ${t.y}px)`, transitionDelay: `${t.delay}ms` }}
              title={`${p.name} — ${t.sub}`}
            >
              <DeviceIcon cat={p.category} size={20} />
              <span className="nm">{p.name}</span>
              <span className="pr">{money(p.price)}</span>
              <span className="sb">{t.sub}</span>
            </div>
          )
        })}

        {abstain && (
          <div
            className={`pf-nocat ${f.resp ? 'on' : ''}`}
            style={{ transform: `translate(${COLX.d}px, ${TOP0}px)` }}
          >
            <b>“Not in our catalog.”</b>
            <br />
            No product is shown.
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Candidates table ---------- */

const ROW_H = 42

function Candidates({ rows, f, sc }) {
  if (!f.sim) {
    return <div className="pf-wait">Candidates appear after the Pinecone search.</div>
  }
  const abstain = sc.kind === 'abstain'
  return (
    <div className="pf-tbl" role="table" aria-label="Candidate products">
      <div className="pf-tbl-in">
        <div className="pf-tr pf-th" role="row">
          <span>#</span>
          <span>Product</span>
          <span>Price</span>
          <span>Similarity</span>
          <span>Bonus</span>
          <span>Final</span>
          <span />
        </div>
        <div className="pf-rows" style={{ height: rows.length * ROW_H }}>
          {rows.map((r) => {
            const pos = f.bonus ? r.finalRank : r.simRank
            const isTop = f.bonus && !abstain && r.finalRank < TOP_K
            const entered = f.bonus && !abstain && r.finalRank < TOP_K && r.simRank >= TOP_K
            const dropped = f.bonus && !abstain && r.finalRank >= TOP_K && r.simRank < TOP_K
            const dim = f.cut && (abstain || r.finalRank >= TOP_K)
            let chip = null
            if (r.pinned) chip = ['name match', 'top']
            else if (entered) chip = ['▲ entered top 5', 'up']
            else if (dropped) chip = ['▼ dropped', 'down']
            else if (f.check && abstain && r.sim < THRESHOLD) chip = ['below 0.35', 'down']
            else if (f.cut && isTop) chip = ['top 5', 'top']
            return (
              <div
                key={r.id}
                role="row"
                className={`pf-tr pf-row ${isTop ? 'top' : ''} ${dim ? 'dim' : ''}`}
                style={{ transform: `translateY(${pos * ROW_H}px)` }}
              >
                <span>{pos + 1}</span>
                <span className="pf-name" title={r.id}>
                  <DeviceIcon cat={r.category} size={15} /> {r.name}
                </span>
                <span>{money(r.price)}</span>
                <span className="pf-sim">
                  <span className="pf-bar">
                    <i className={r.sim < THRESHOLD ? 'low' : ''} style={{ width: r.sim * 100 + '%' }} />
                    <u style={{ left: THRESHOLD * 100 + '%' }} />
                  </span>
                  <em>{r.sim.toFixed(2)}</em>
                </span>
                <span>{f.bonus ? (sc.maxPrice ? '+' + r.bonus.toFixed(3) : '0') : '–'}</span>
                <span>
                  <b>{f.bonus ? r.final.toFixed(3) : '–'}</b>
                </span>
                <span>{chip && <em className={`pf-chip ${chip[1]}`}>{chip[0]}</em>}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------- Main component ---------- */

export default function PipelineFlow({ onClose, onTry }) {
  const [scKey, setScKey] = useState('budget')
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const packetRef = useRef(null)
  const payRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const sc = SCENARIOS[scKey]
  const data = useMemo(() => evaluate(sc), [sc])
  const path = sc.steps
  const last = path.length - 1
  const currentId = path[idx]
  const info = INFO[currentId]
  const pathEdges = path.slice(0, -1).map((a, i) => `${a}-${path[i + 1]}`)
  const reached = (id) => {
    const i = path.indexOf(id)
    return i !== -1 && i <= idx
  }
  const f = {
    sim: reached('pine'),
    bonus: reached('rerank'),
    check: reached('check'),
    cut: reached('mongo') || reached('nocat'),
    resp: reached('resp'),
  }
  const best = Math.max(...data.surv.map((r) => r.sim))
  const top = [...data.surv].sort((a, b) => a.finalRank - b.finalRank).slice(0, TOP_K)
  const dwell = DWELL / speed
  const travel = TRAVEL / speed

  // The moving dot turns into the best product's device once it has been retrieved
  const carry = idx > path.indexOf('pine') && !(sc.kind === 'abstain' && idx >= path.indexOf('check'))

  // Escape to close + lock page scroll
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  // Autoplay: advance one step per tick
  useEffect(() => {
    if (!playing) return
    if (idx >= last) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setIdx((i) => i + 1), dwell + travel)
    return () => clearTimeout(t)
  }, [playing, idx, last, dwell, travel])

  // Move the packet along the current line
  useEffect(() => {
    const el = packetRef.current
    if (!el) return
    el.style.opacity = '0'
    if (!playing || idx >= last) return
    const key = `${path[idx]}-${path[idx + 1]}`
    const pathEl = document.getElementById(`pf-edge-${key}`)
    if (!pathEl) return
    if (payRef.current) payRef.current.textContent = PAYLOAD[key] || ''
    const len = pathEl.getTotalLength()
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    const place = (p) => {
      const pnt = pathEl.getPointAtLength(len * p)
      el.setAttribute('transform', `translate(${pnt.x} ${pnt.y})`)
    }
    place(0)
    let raf
    let start = null
    const tick = (now) => {
      if (start == null) start = now
      const elapsed = now - start - dwell
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      el.style.opacity = '1'
      const p = Math.min(1, elapsed / travel)
      place(ease(p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, idx, scKey, dwell, travel])

  const pick = (key) => {
    setScKey(key)
    setIdx(0)
    setPlaying(true)
  }
  const jump = (i) => {
    setIdx(Math.max(0, Math.min(last, i)))
    setPlaying(false)
  }
  const togglePlay = () => {
    if (idx >= last) {
      setIdx(0)
      setPlaying(true)
    } else {
      setPlaying((p) => !p)
    }
  }

  return (
    <div className="pf-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pf-sheet" role="dialog" aria-modal="true" aria-label="How ConvoShop works">
        <header className="pf-head">
          <div>
            <h3>How ConvoShop works</h3>
            <p>Live view of one query moving through the RAG system</p>
          </div>
          <button className="pf-x" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="pf-body">
          <div className="pf-tabs" role="tablist">
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <button
                key={key}
                role="tab"
                aria-selected={key === scKey}
                className={key === scKey ? 'active' : ''}
                onClick={() => pick(key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="pf-query">
            <span>Query</span>
            <code>{sc.query}</code>
          </div>

          <div className="pf-scroll">
            <svg className="pf-svg" viewBox="0 0 1180 650" role="img" aria-label="System architecture flow diagram">
              <defs>
                <marker id="pf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0L10 5L0 10z" className="pf-arrow" />
                </marker>
                <marker id="pf-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0L10 5L0 10z" className="pf-arrow-on" />
                </marker>
              </defs>

              {/* connecting lines */}
              {Object.entries(EDGES).map(([key, d]) => {
                const i = pathEdges.indexOf(key)
                const state = OFFLINE.has(key)
                  ? 'offline'
                  : i === -1
                    ? 'off'
                    : i < idx
                      ? 'done'
                      : i === idx
                        ? 'active'
                        : 'next'
                return <path key={key} id={`pf-edge-${key}`} d={d} className={`pf-edge ${state}`} />
              })}

              <text x="690" y="12" textAnchor="middle" className="pf-edge-label">
                budget query → skip name lookup
              </text>
              <text x="906" y="185" className="pf-edge-label">vector + filters</text>
              <text x="1034" y="150" textAnchor="end" className="pf-edge-label">IDs + scores</text>
              <text x="1118" y="260" className="pf-edge-label">re-ranked</text>
              <text x="1068" y="525" className="pf-edge-label">score &lt; 0.35</text>
              <text x="810" y="247" textAnchor="middle" className="pf-edge-label">built offline</text>

              {/* nodes */}
              {Object.keys(NODES).map((id) => {
                const g = geo(id)
                const nd = NODES[id]
                const pi = path.indexOf(id)
                const state = nd.offline
                  ? 'offline'
                  : pi === -1
                    ? 'skipped'
                    : pi === idx
                      ? 'current'
                      : pi < idx
                        ? 'visited'
                        : 'next'
                const clickable = pi !== -1
                const sub = state === 'skipped' ? (id === 'nocat' ? 'not taken' : 'skipped for this query') : nd.sub
                const isDb = nd.kind === 'db'
                return (
                  <g
                    key={id}
                    className={`pf-node ${state}`}
                    transform={`translate(${g.x} ${g.y})`}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : -1}
                    aria-label={`${nd.title}${clickable || nd.offline ? '' : ' (not used for this query)'}`}
                    onClick={() => clickable && jump(pi)}
                    onKeyDown={(e) => {
                      if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        jump(pi)
                      }
                    }}
                  >
                    {isDb ? (
                      <>
                        <path
                          className="pf-shape"
                          d={`M0 12 L0 ${g.h - 12} A${W / 2} 12 0 0 0 ${W} ${g.h - 12} L${W} 12 Z`}
                        />
                        <ellipse className="pf-shape" cx={W / 2} cy="12" rx={W / 2} ry="12" />
                        <text x={W / 2} y={g.h / 2 + 4} textAnchor="middle" className="pf-title">
                          {nd.n ? `${nd.n} · ` : ''}
                          {nd.title}
                        </text>
                        <text x={W / 2} y={g.h / 2 + 20} textAnchor="middle" className="pf-file">
                          {sub}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect className="pf-shape" width={g.w} height={g.h} rx="14" />
                        <circle cx="20" cy="20" r="11" className="pf-badge" />
                        <text x="20" y="24" className="pf-badge-t">{nd.n}</text>
                        <text x="38" y="25" className="pf-title">{nd.title}</text>
                        <text x="14" y={g.h - 14} className={state === 'skipped' ? 'pf-skip' : 'pf-file'}>
                          {sub}
                        </text>
                      </>
                    )}
                  </g>
                )
              })}

              {/* legend */}
              <g className="pf-legend" transform="translate(220 560)">
                <circle cx="6" cy="6" r="5" className="pf-packet" />
                <text x="18" y="10">query / data moving</text>
                <line x1="170" y1="6" x2="200" y2="6" className="pf-edge off" />
                <text x="208" y="10">not used for this query</text>
                <line x1="380" y1="6" x2="410" y2="6" className="pf-edge offline" />
                <text x="418" y="10">built offline from the CSV</text>
              </g>

              {/* the moving query / best product */}
              <g ref={packetRef} className="pf-packet-g">
                <circle r="15" className="pf-halo" />
                {carry ? (
                  <>
                    <circle r="12" className="pf-pk-bg" />
                    <svg
                      x="-9"
                      y="-9"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="pf-pk-ico"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {GLYPH[top[0].category]}
                    </svg>
                  </>
                ) : (
                  <circle r="6" className="pf-packet" />
                )}
                <text ref={payRef} x="19" y="4" className="pf-pay" />
              </g>
            </svg>
          </div>

          <div className="pf-controls">
            <button className="pf-btn" disabled={idx === 0} onClick={() => jump(idx - 1)}>
              Back
            </button>
            <button className="pf-btn primary" onClick={togglePlay}>
              {idx >= last ? 'Replay' : playing ? 'Pause' : 'Play'}
            </button>
            <button className="pf-btn" disabled={idx >= last} onClick={() => jump(idx + 1)}>
              Next
            </button>
            <label className="pf-speed">
              Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.6}>0.6×</option>
                <option value={1}>1×</option>
                <option value={1.6}>1.6×</option>
                <option value={2.5}>2.5×</option>
              </select>
            </label>
            <span className="pf-progress">
              Step {idx + 1} of {path.length}
            </span>
          </div>

          <section className="pf-journey">
            <div className="pf-jhead">
              <h4>Product journey</h4>
              <span>Which products are removed, why, and which ones reach the output</span>
              <span className="pf-key">
                <i className="k-kept" /> kept <i className="k-removed" /> removed <i className="k-out" /> shown
              </span>
            </div>
            <Journey data={data} f={f} sc={sc} />
            <p className="pf-jnote" aria-live="polite">
              {journeyNote(currentId, sc, data, best, top)}
            </p>
          </section>

          <div className="pf-panels">
            <section className="pf-info" aria-live="polite">
              <div className="pf-info-head">
                <span className="pf-no">{NODES[currentId].n}</span>
                <h4>{info.title}</h4>
                <span className="pf-tag">{info.where}</span>
              </div>
              <p>{info.text}</p>
              <StepVisual id={currentId} sc={sc} data={data} top={top} best={best} />
            </section>

            <section className="pf-calc">
              <h4>How the remaining products are scored</h4>
              <Candidates rows={data.surv} f={f} sc={sc} />
            </section>
          </div>

          <p className="pf-foot">
            Products, prices and similarity scores are made-up samples, not real catalog rows
            {sc.kind === 'abstain' ? ', and the parsed filters for this query are an assumption' : ''}. Which products
            are removed, and why, is computed from the parsed filters. The re-rank formula assumes bonus = {BONUS} ×
            price ÷ budget; check retriever.py for the exact one.
          </p>

          <button
            className="pf-btn primary pf-wide"
            onClick={() => {
              onClose()
              onTry?.(sc.query)
            }}
          >
            Try this query live
          </button>
        </div>
      </div>
    </div>
  )
}