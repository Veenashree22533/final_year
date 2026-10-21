import { useEffect, useMemo, useRef, useState } from 'react'
import './PipelineFlow.css'

/* ---------- Tunables (keep in sync with the backend) ---------- */

const THRESHOLD = 0.35 // rag_pipeline.py: abstain below this similarity
const BONUS = 0.15 // retriever.py: budget re-rank bonus
const TOP_K = 5 // rag_pipeline.py: products sent to the LLM
const DWELL = 800 // ms the query rests on a node
const TRAVEL = 1000 // ms the query takes to travel along a line

// Live numbers shown on the database stickers. Change these to match your data.
const CATALOG = {
  csvRows: 2554, // rows in the catalog CSV
  pineconeCount: 2554, // vectors in the Pinecone index
  mongoCount: 2554, // documents in MongoDB Atlas
  dim: 384, // ASSUMPTION: embedding size of your Sentence Transformer
  metric: 'cosine', // ASSUMPTION: Pinecone index metric
  candidates: TOP_K * 4, // retriever asks Pinecone for 4x more than needed
}

const fmt = (n) => Number(n).toLocaleString('en-IN')
const money = (n) => '₹' + fmt(n)

/* ---------- Count-up hook for the live database numbers ---------- */

function useCountUp(target, ms = 1100) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    let start = null
    const tick = (now) => {
      if (start == null) start = now
      const p = Math.min(1, (now - start) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

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

/* ---------- Tech-stack stickers ----------
   Generic line icons (24x24 grid), not official logos. To use real logos,
   replace a glyph with the brand's SVG paths. */

const ICON = {
  react: (
    <>
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="1.6" fill="#fff" />
    </>
  ),
  bolt: <path d="M13 2L5 14h6l-1 8 8-12h-6z" />,
  braces: (
    <path d="M9 4c-2 0-3 1-3 3v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M15 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" />
    </>
  ),
  bars: <path d="M4 14v6M8 8v12M12 11v9M16 4v16M20 9v11" />,
  pine: <path d="M12 2l6 8h-3l5 7H4l5-7H6zM12 17v5" />,
  sort: <path d="M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />,
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M8.5 12l2.5 2.5L16 9.5" />
    </>
  ),
  leaf: <path d="M12 2c4 4 6 8 6 12a6 6 0 01-12 0c0-4 2-8 6-12zM12 14v8" />,
  layers: <path d="M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5" />,
  spark: <path d="M12 2c1 5 5 9 10 10-5 1-9 5-10 10-1-5-5-9-10-10 5-1 9-5 10-10z" />,
  link: <path d="M10 14l4-4M8 12l-2 2a3.5 3.5 0 005 5l2-2M16 12l2-2a3.5 3.5 0 00-5-5l-2 2" />,
  send: <path d="M21 3L3 11l7 3 3 7zM10 14L21 3" />,
  server: (
    <>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01M7 17h.01" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
}

const BLUE = '#3d6fb5'
// Which tech sticker sits on which diagram node
const TECH = {
  fe: { label: 'React', color: '#0e9ec2', icon: 'react' },
  api: { label: 'FastAPI', color: '#059488', icon: 'bolt' },
  parser: { label: 'Python regex', color: BLUE, icon: 'braces' },
  lookup: { label: 'Python', color: BLUE, icon: 'search' },
  embed: { label: 'Sentence-BERT', color: '#c9701f', icon: 'bars' },
  pine: { label: 'Pinecone', color: '#2b6fe0', icon: 'pine' },
  csv: { label: 'CSV · offline', color: '#6b7280', icon: 'table' },
  rerank: { label: 'Python', color: BLUE, icon: 'sort' },
  check: { label: 'Python', color: BLUE, icon: 'shield' },
  mongo: { label: 'MongoDB Atlas', color: '#13a04b', icon: 'leaf' },
  ctx: { label: 'Python', color: BLUE, icon: 'layers' },
  llm: { label: 'Gemini API', color: '#6b5ce7', icon: 'spark' },
  repair: { label: 'Python', color: BLUE, icon: 'link' },
  resp: { label: 'React', color: '#0e9ec2', icon: 'send' },
  nocat: { label: 'Abstain', color: '#d64545', icon: 'ban' },
}

function TechIcon({ id, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON[TECH[id].icon]}
    </svg>
  )
}

/* ---------- Diagram geometry ---------- */

const W = 160
const H = 80

const NODES = {
  fe: { n: 1, x: 40, y: 50, title: 'React frontend', sub: 'user query' },
  api: { n: 2, x: 240, y: 50, title: 'FastAPI', sub: 'POST /chat/' },
  parser: { n: 3, x: 440, y: 50, title: 'Query parser', sub: 'query_parser.py' },
  lookup: { n: 4, x: 640, y: 50, title: 'Name lookup', sub: 'retriever.py' },
  embed: { n: 5, x: 840, y: 50, title: 'Embed query', sub: 'embeddings.py' },
  rerank: { n: 7, x: 1040, y: 50, title: 'Budget re-rank', sub: 'retriever.py' },
  pine: { n: 6, x: 840, y: 215, h: 96, kind: 'db', title: 'Pinecone', sub: 'vector search' },
  csv: { x: 640, y: 215, h: 96, kind: 'db', offline: true, title: 'Catalog CSV', sub: 'source of truth' },
  check: { n: 8, x: 1040, y: 420, title: 'Abstain check', sub: 'score ≥ 0.35 ?' },
  mongo: { n: 9, x: 840, y: 412, h: 96, kind: 'db', title: 'MongoDB', sub: 'product records' },
  ctx: { n: 10, x: 640, y: 420, title: 'Build context', sub: 'top 5 products' },
  llm: { n: 11, x: 440, y: 420, title: 'Gemini', sub: 'llm.py' },
  repair: { n: 12, x: 240, y: 420, title: 'Repair IDs', sub: 'rag_pipeline.py' },
  resp: { n: 13, x: 40, y: 420, title: 'Respond', sub: 'answer + cards' },
  nocat: { n: '!', x: 1040, y: 590, h: 56, title: 'Not in catalog', sub: 'abstain' },
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
  'embed-pine': line(pt('embed', 'bottom'), pt('pine', 'top')),
  'pine-rerank': elbow(pt('pine', 'right'), pt('rerank', 'bottom', -20)),
  'rerank-check': line(pt('rerank', 'bottom', 30), pt('check', 'top', 30)),
  'check-mongo': line(pt('check', 'left'), pt('mongo', 'right')),
  'mongo-ctx': line(pt('mongo', 'left'), pt('ctx', 'right')),
  'ctx-llm': line(pt('ctx', 'left'), pt('llm', 'right')),
  'llm-repair': line(pt('llm', 'left'), pt('repair', 'right')),
  'repair-resp': line(pt('repair', 'left'), pt('resp', 'right')),
  'check-nocat': line(pt('check', 'bottom'), pt('nocat', 'top')),
  'nocat-resp': elbow(pt('nocat', 'left'), pt('resp', 'bottom')),
  // built offline, not part of a query
  'csv-pine': line(pt('csv', 'right'), pt('pine', 'left')),
  'csv-mongo': line(pt('csv', 'bottom', 50), [pt('csv', 'bottom', 50)[0], 380], [pt('mongo', 'top')[0], 380], pt('mongo', 'top')),
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

/* ---------- Pipeline stages (the big picture) ---------- */

const PHASES = [
  { key: 'request', label: 'Request', ids: ['fe', 'api'], what: 'Carry the shopper’s words from the browser to the server.' },
  { key: 'understand', label: 'Understand', ids: ['parser', 'lookup'], what: 'Turn free text (English or Hinglish) into structured filters and spot named products.' },
  { key: 'retrieve', label: 'Retrieve', ids: ['embed', 'pine'], what: 'Find the products whose meaning is closest to the query, inside the filters.' },
  { key: 'rank', label: 'Rank & verify', ids: ['rerank', 'check'], what: 'Re-order by budget fit, then decide whether the evidence is strong enough to answer.' },
  { key: 'generate', label: 'Fetch & generate', ids: ['mongo', 'ctx', 'llm', 'repair'], what: 'Pull full records, build the prompt context and let Gemini write a grounded answer.' },
  { key: 'respond', label: 'Respond', ids: ['resp', 'nocat'], what: 'Send the answer and product cards back, or an honest “not in our catalog”.' },
]
const phaseOf = (id) => PHASES.find((p) => p.ids.includes(id))

/* ---------- Step explanations ---------- */

const INFO = {
  fe: {
    title: 'User query',
    where: 'React frontend',
    text: 'The shopper types or speaks a query in English or Hinglish. The frontend sends it to the backend as POST /chat/ with { message }.',
    use: 'Starts every request. Nothing is understood yet; the raw words are just sent on.',
  },
  api: {
    title: 'API request',
    where: 'FastAPI · main.py',
    text: 'FastAPI receives POST /chat/ and hands the message to the RAG pipeline (answer_query in rag_pipeline.py).',
    use: 'The single door into the backend, so the browser never talks to Pinecone, MongoDB or Gemini directly.',
  },
  parser: {
    title: 'Parse the query',
    where: 'query_parser.py',
    text: 'Extracts category, brand, min/max price, RAM and storage. Understands Hinglish numbers (hazaar, lakh) and phrases (ke andar, tak, se upar). Durations such as “upto 21 days” are not read as budgets.',
    use: 'Hard rules like price, brand and category work far better as exact filters than as fuzzy text.',
  },
  lookup: {
    title: 'Look up named products',
    where: 'retriever.py',
    text: 'If the query names a product (full or partial), those catalog entries are placed first. Skipped for budget queries. A model number the product lacks rules the match out.',
    use: 'A product the shopper names must come first, even if its embedding is not the closest.',
  },
  embed: {
    title: 'Embed the query',
    where: 'embeddings.py · Sentence Transformer',
    text: 'The query text is turned into an embedding vector. Queries with similar meaning land near each other, which is what makes semantic search work.',
    use: 'Lets the system search by meaning: “sasta phone” and “budget phone” end up close together.',
  },
  pine: {
    title: 'Vector search + hard filters',
    where: 'vector_services.py · Pinecone',
    text: 'Pinecone compares the query vector with the stored product vectors. The parsed filters are applied as metadata filters, so products that break a rule never get scored. It returns product IDs with similarity scores; the retriever asks for 4× more candidates than needed.',
    use: `Finds the best matches among ${fmt(CATALOG.pineconeCount)} products without reading every record, and enforces the hard filters.`,
  },
  rerank: {
    title: 'Budget-aware re-rank',
    where: 'retriever.py',
    text: 'When there is a budget, products closer to the ceiling get a +0.15 style bonus so “phone under 50k” is not answered only with the cheapest phones. Skipped for “cheap” / “sasta” queries.',
    use: 'Similarity alone favours cheap items; the bonus surfaces products that actually use the budget.',
  },
  check: {
    title: 'Abstain check',
    where: 'rag_pipeline.py',
    text: 'If nothing was found, or the best similarity score is below 0.35, the system abstains with “Not in our catalog” instead of guessing.',
    use: 'Stops the bot from guessing when nothing in the catalog is a real match.',
  },
  mongo: {
    title: 'Fetch product records',
    where: 'MongoDB Atlas',
    text: 'MongoDB Atlas stores the structured product records. The top 5 IDs are looked up to get price, RAM, storage, screen, battery and description.',
    use: 'Pinecone only holds vectors and light metadata; MongoDB holds the full, authoritative product details.',
  },
  ctx: {
    title: 'Build context',
    where: 'rag_pipeline.py',
    text: 'Each of the top 5 products becomes a text block. Laptop prices converted from EUR are marked as estimates.',
    use: 'Gives Gemini only the facts it is allowed to use.',
  },
  llm: {
    title: 'Generate answer',
    where: 'llm.py · Gemini',
    text: 'Gemini writes the recommendation and explanation using only the retrieved context.',
    use: 'Turns raw product data into a natural, conversational recommendation.',
  },
  repair: {
    title: 'Repair product IDs',
    where: 'rag_pipeline.py',
    text: 'Any product ID in the answer that was not retrieved is mapped back to the closest retrieved ID.',
    use: 'Guards against a made-up product ID ever reaching the product cards.',
  },
  resp: {
    title: 'Respond',
    where: 'React frontend',
    text: 'The frontend shows the answer text and the matched products as cards you can open, wishlist or add to the cart.',
    use: 'The shopper reads the answer and can act on the cards.',
  },
  nocat: {
    title: 'Abstain',
    where: 'llm.py · abstain message',
    text: 'The LLM is not called. The user gets “Not in our catalog” instead of an invented product.',
    use: 'Honesty over invention: no real match means no made-up product.',
  },
}

/* ---------- Algorithms shown at each stage ----------
   Simplified illustrations of the logic. Check the backend files for the exact code. */

const ALGO = {
  fe: {
    name: 'HTTP request',
    inp: 'typed or spoken text',
    out: 'JSON { message }',
    code: `fetch('/chat/', {\n  method: 'POST',\n  body: JSON.stringify({ message })\n})`,
    cost: 'O(1)',
  },
  api: {
    name: 'Routing + request validation',
    inp: '{ message }',
    out: 'call to answer_query()',
    code: `@app.post("/chat/")\nasync def chat(req: ChatRequest):\n    return answer_query(req.message)`,
    cost: 'O(1)',
  },
  parser: {
    name: 'Rule-based extraction (regex + keyword maps)',
    inp: 'raw message',
    out: 'filters { category, brand, price, RAM, storage }',
    code: `text = normalise(msg)      # hazaar → 1000, lakh → 100000\nprice = PRICE_RE.search(text)  # "ke andar"/"tak" → max\n                               # "se upar" → min\nbrand = first_match(BRANDS, text)\ncategory = first_match(CATEGORIES, text)`,
    cost: 'O(length of query)',
  },
  lookup: {
    name: 'Name matching (token overlap)',
    inp: 'filters + query',
    out: 'pinned products',
    code: `for p in catalog:\n    if all(tok in p.name for tok in query_tokens) \\\n       and model_number_ok(p):\n        pinned.append(p)`,
    cost: `O(N × tokens), N = ${fmt(CATALOG.csvRows)}`,
  },
  embed: {
    name: 'Transformer sentence encoder',
    inp: 'query text',
    out: `vector of ${CATALOG.dim} numbers`,
    code: `h = transformer(tokenize(text))  # one vector per token\nv = mean_pool(h)                 # average into one vector\nv = v / norm(v)                  # unit length`,
    cost: 'one forward pass of the model',
  },
  pine: {
    name: `Approximate nearest-neighbour search (${CATALOG.metric}) + metadata filter`,
    inp: 'vector + filters',
    out: `${CATALOG.candidates} product IDs with scores`,
    code: `score(q, p) = q · p             # unit vectors = ${CATALOG.metric}\nkeep p where matches(p.metadata, filters)\nreturn best ${CATALOG.candidates} by score        # 4 × TOP_K`,
    cost: 'sub-linear: an index is used, not a full scan',
  },
  rerank: {
    name: 'Linear score boost',
    inp: 'IDs + similarity scores',
    out: 'ranked list',
    code: `final = sim + ${BONUS} × min(price ÷ budget, 1)\nsort candidates by final, highest first`,
    cost: `O(k log k), k = ${CATALOG.candidates}`,
  },
  check: {
    name: 'Threshold test',
    inp: 'ranked list',
    out: 'continue or abstain',
    code: `if not hits or max(sim) < ${THRESHOLD}:\n    return NOT_IN_CATALOG\ncontinue`,
    cost: 'O(1)',
  },
  mongo: {
    name: 'Indexed lookup by _id',
    inp: 'top 5 product IDs',
    out: '5 full product records',
    code: `db.products.find({\n  _id: { $in: top5_ids }\n})`,
    cost: 'O(5 · log N) using the _id index',
  },
  ctx: {
    name: 'Template formatting',
    inp: '5 product records',
    out: '5 text blocks',
    code: `for p in top5:\n    blocks.append(format_block(p))\n    # [id] category · brand · name, price, specs`,
    cost: 'O(5)',
  },
  llm: {
    name: 'LLM text generation (grounded prompt)',
    inp: 'rules + context blocks + question',
    out: 'answer text',
    code: `prompt = RULES + context_blocks + question\nanswer = gemini.generate(prompt)\n# instruction: use only the given context`,
    cost: 'the slowest step: one model call',
  },
  repair: {
    name: 'Closest-ID mapping',
    inp: 'answer text + retrieved IDs',
    out: 'answer with valid IDs only',
    code: `for pid in ids_in(answer):\n    if pid not in retrieved_ids:\n        pid = closest(pid, retrieved_ids)`,
    cost: 'O(IDs × 5)',
  },
  resp: {
    name: 'UI render',
    inp: 'answer + matched IDs',
    out: 'chat bubble + product cards',
    code: `setMessages(m => [...m, {\n  text: response,\n  products: matches\n}])`,
    cost: 'O(1)',
  },
  nocat: {
    name: 'Fallback response',
    inp: 'abstain signal',
    out: '“Not in our catalog”',
    code: `return {\n  response: "Not in our catalog",\n  matches: []\n}`,
    cost: 'O(1), the LLM is never called',
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

// Small rounded label hanging under a database node (live counts / status)
function Pill({ cx, y, text, tone = '', dot = false }) {
  const w = text.length * 6.2 + 20 + (dot ? 12 : 0)
  return (
    <g className={`pf-pill ${tone}`}>
      <rect x={cx - w / 2} y={y} width={w} height="22" rx="11" />
      {dot && <circle cx={cx - w / 2 + 12} cy={y + 11} r="3.5" className="pf-livedot" />}
      <text x={cx + (dot ? 6 : 0)} y={y + 15} textAnchor="middle">
        {text}
      </text>
    </g>
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
          {sc.parse.map(([tok, field, val], i) => (
            <div key={`${field}-${i}`} className="pf-map">
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
          <p className="pf-note">
            Query → vector of {CATALOG.dim} numbers (28 illustrative values drawn).
          </p>
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
            In the real system Pinecone searches all {fmt(CATALOG.pineconeCount)} vectors with these filters. The lane
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

/* ---------- Data stores: how Pinecone and MongoDB connect ---------- */

function StoreIcon({ id }) {
  return (
    <span className="pf-ds-ico" style={{ background: TECH[id].color }}>
      <TechIcon id={id} size={22} />
    </span>
  )
}

function DataStores({ pc, mc, data, top, st, best }) {
  const ex = top[0] || data.all[0]
  const synced = CATALOG.pineconeCount === CATALOG.mongoCount
  const sample = vector(ex.id)
    .slice(0, 3)
    .map((v) => v.toFixed(2))
    .join(', ')

  const pineLive =
    st.pine === 'on'
      ? `Scanning ${fmt(CATALOG.pineconeCount)} vectors with the filters → ${CATALOG.candidates} nearest candidates`
      : st.pine === 'done'
        ? `Returned ${CATALOG.candidates} candidates · best sample similarity ${best.toFixed(2)}`
        : 'Waiting for the embedded query'
  const mongoLive =
    st.mongo === 'skip'
      ? 'Not called: the query abstained before this step'
      : st.mongo === 'on'
        ? `Fetching ${top.length} full records by _id`
        : st.mongo === 'done'
          ? `Fetched ${top.length} records for the LLM context`
          : 'Waiting for the top IDs'

  const link = [
    ['Pinecone returns the best IDs', st.pine],
    [`Top ${TOP_K} IDs go to MongoDB`, st.mongo],
    ['Records become LLM context', st.ctx],
  ]

  return (
    <section className="pf-stores">
      <div className="pf-jhead">
        <h4>Data stores</h4>
        <span>How the two databases hold the same products and how a query moves between them</span>
      </div>
      <div className="pf-stores-grid">
        <div className={`pf-ds ${st.pine === 'on' ? 'active' : ''}`}>
          <div className="pf-ds-head">
            <StoreIcon id="pine" />
            <div>
              <b>Pinecone</b>
              <div className="pf-ds-stat">vector database · finds by meaning</div>
            </div>
          </div>
          <div className="pf-ds-count">
            {fmt(pc)} <small>vectors</small>
          </div>
          <div className="pf-ds-stat">
            {CATALOG.dim} dimensions · {CATALOG.metric} similarity
          </div>
          <pre className="pf-code">{`{ id: "${ex.id}",\n  values: [${sample}, … ${CATALOG.dim}],\n  metadata: { category: "${ex.category}",\n    brand: "${ex.brand}", price: ${ex.price} } }`}</pre>
          <p className="pf-ds-live">{pineLive}</p>
        </div>

        <div className="pf-link" aria-label="Connection between Pinecone and MongoDB">
          <span className="pf-link-key">product_id</span>
          <div className={`pf-link-line ${st.mongo === 'on' ? 'run' : ''}`} />
          <span className={`pf-sync ${synced ? 'ok' : 'bad'}`}>
            {synced ? `✓ same ${fmt(CATALOG.pineconeCount)} IDs in both` : '⚠ counts differ, re-sync the index'}
          </span>
          <ol className="pf-link-steps">
            {link.map(([label, s]) => (
              <li key={label} className={s === 'on' ? 'on' : s === 'done' ? 'done' : s === 'skip' ? 'skip' : ''}>
                {label}
              </li>
            ))}
          </ol>
        </div>

        <div className={`pf-ds ${st.mongo === 'on' ? 'active' : ''}`}>
          <div className="pf-ds-head">
            <StoreIcon id="mongo" />
            <div>
              <b>MongoDB Atlas</b>
              <div className="pf-ds-stat">document database · stores the details</div>
            </div>
          </div>
          <div className="pf-ds-count">
            {fmt(mc)} <small>documents</small>
          </div>
          <div className="pf-ds-stat">_id = product_id · looked up by index</div>
          <pre className="pf-code">{`{ _id: "${ex.id}",\n  name: "${ex.name}",\n  price: ${ex.price},\n  ram, storage, screen, battery,\n  description … }`}</pre>
          <p className="pf-ds-live">{mongoLive}</p>
        </div>
      </div>
    </section>
  )
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

export default function PipelineFlow({ onClose, onTry, query = '' }) {
  const liveQuery = typeof query === 'string' ? query.trim() : ''
  const [queryInput, setQueryInput] = useState(liveQuery)
  const [liveRun, setLiveRun] = useState({ status: 'idle', query: '', response: '', matches: [], error: '' })
  useEffect(() => {
    setQueryInput(liveQuery)
  }, [liveQuery])
  const [scKey, setScKey] = useState('budget')
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const packetRef = useRef(null)
  const payRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Live database totals (count up when the dialog opens)
  const pc = useCountUp(CATALOG.pineconeCount)
  const mc = useCountUp(CATALOG.mongoCount)
  const cc = useCountUp(CATALOG.csvRows)

  const sc = SCENARIOS[scKey]
  const data = useMemo(() => evaluate(sc), [sc])
  const path = sc.steps
  const last = path.length - 1
  const currentId = path[idx]
  const info = INFO[currentId]
  const algo = ALGO[currentId]
  const phase = phaseOf(currentId)
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

  // 'skip' = not on this query's path, 'on' = current, 'done' = passed, '' = still ahead
  const stOf = (id) => (path.indexOf(id) === -1 ? 'skip' : id === currentId ? 'on' : reached(id) ? 'done' : '')
  const st = { pine: stOf('pine'), mongo: stOf('mongo'), ctx: stOf('ctx') }

  // Status pills under the database nodes in the diagram
  const dbLive = {
    pine:
      st.pine === 'on'
        ? ['scanning…', 'live']
        : st.pine === 'done'
          ? [`${CATALOG.candidates} IDs returned`, 'ok']
          : null,
    mongo:
      st.mongo === 'on'
        ? [`fetching ${top.length} by _id`, 'live']
        : st.mongo === 'done'
          ? [`${top.length} records fetched`, 'ok']
          : st.mongo === 'skip'
            ? ['not called', 'off']
            : null,
  }
  const dbCount = {
    pine: `${fmt(pc)} vectors`,
    mongo: `${fmt(mc)} documents`,
    csv: `${fmt(cc)} rows`,
  }

  // Stage tracker
  const phases = PHASES.map((p) => {
    const ix = p.ids.map((i) => path.indexOf(i)).filter((i) => i >= 0)
    if (!ix.length) return { ...p, state: 'skip' }
    if (ix.includes(idx)) return { ...p, state: 'cur' }
    return { ...p, state: Math.max(...ix) < idx ? 'done' : 'todo' }
  })

  // The moving dot turns into the best product's device once it has been retrieved
  const carry = idx > path.indexOf('pine') && !(sc.kind === 'abstain' && idx >= path.indexOf('check'))
  const liveCategory = String(liveRun.matches?.[0]?.category || '').toLowerCase()
  const packetCategory = liveRun.status === 'success'
    ? (liveCategory.includes('watch') ? 'smartwatch' : liveCategory.includes('laptop') ? 'laptop' : liveCategory.includes('phone') ? 'phone' : top[0]?.category)
    : top[0]?.category

  // Escape to close + lock page scroll
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
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
      <div
        className="pf-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="How ConvoShop works"
        style={{
          width: 'min(1180px, calc(100vw - 36px))',
          height: 'min(900px, calc(100dvh - 36px))',
          maxHeight: 'calc(100dvh - 36px)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <header className="pf-head">
          <div>
            <h3>How ConvoShop works</h3>
            <p>Architecture walkthrough is illustrative; live backend status and results appear below</p>
          </div>
          <button className="pf-x" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div
          className="pf-body"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            height: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehaviorY: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            scrollbarGutter: 'stable',
          }}
        >
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
            <label htmlFor="pf-live-query">Query</label>
            <input
              id="pf-live-query"
              type="text"
              value={queryInput}
              onChange={(event) => {
                const nextQuery = event.target.value
                setQueryInput(nextQuery)
                const normalized = nextQuery.toLowerCase()
                const looksLikeNamedProduct =
                  /\\b(compare|versus|vs\\.?|price of|details of|specs of)\\b/.test(normalized) ||
                  /\\b(iphone|galaxy|forerunner|venu|pixel|thinkpad|macbook|vivobook|legion)\\b/.test(normalized)
                setScKey(looksLikeNamedProduct ? 'named' : 'budget')
                setIdx(0)
                setPlaying(true)
              }}
              placeholder={sc.query}
              aria-label="Edit query to send to the backend"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'inherit', font: 'inherit' }}
            />
          </div>

          <button
            className="pf-btn primary pf-wide"
            disabled={liveRun.status === 'loading' || !(queryInput.trim() || sc.query)}
            onClick={async () => {
              const submittedQuery = (queryInput.trim() || sc.query).trim()
              setLiveRun({ status: 'loading', query: submittedQuery, response: '', matches: [], error: '' })
              setIdx(0)
              setPlaying(true)
              try {
                if (typeof onTry !== 'function') throw new Error('Live search handler is not connected.')
                const result = await onTry(submittedQuery)
                if (!result || result.success !== true || !result.data) {
                  throw new Error(result?.error || 'The backend did not return a successful response.')
                }
                setLiveRun({
                  status: 'success',
                  query: result.data.query || submittedQuery,
                  response: result.data.response || 'The backend returned no text answer.',
                  matches: Array.isArray(result.data.matches) ? result.data.matches : [],
                  error: '',
                })
                // Replay the entire illustrative path after the real API response arrives.
                // Do not jump directly to the final node: doing so hides the moving packet
                // and makes it look as if the flow stopped at a database.
                setIdx(0)
                setPlaying(true)
              } catch (error) {
                setLiveRun({ status: 'error', query: submittedQuery, response: '', matches: [], error: error.message || 'Request failed.' })
              }
            }}
          >
            {liveRun.status === 'loading' ? 'Running backend…' : 'Run live query'}
          </button>

          <section className="pf-info" aria-live="polite" style={{ marginTop: 16, padding: 16, border: '1px solid var(--pf-border, #d8deeb)', borderRadius: 12 }}>
            <h4 style={{ marginTop: 0 }}>Live FastAPI result</h4>
            {liveRun.status === 'idle' && <p>Enter a query above and click <strong>Run live query</strong>. The modal stays open while the real backend request runs.</p>}
            {liveRun.status === 'loading' && <p>Sending <code>{liveRun.query}</code> to <code>POST {`/chat/`}</code>. Waiting for FastAPI and the RAG pipeline…</p>}
            {liveRun.status === 'error' && <p role="alert" style={{ color: '#b42318' }}>Request failed: {liveRun.error}. Check the browser console, FastAPI logs, backend URL, and CORS settings.</p>}
            {liveRun.status === 'success' && <>
              <p><strong>Status:</strong> Backend responded successfully. <strong>Query:</strong> <code>{liveRun.query}</code></p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{liveRun.response}</p>
              <p><strong>Products returned by backend:</strong> {liveRun.matches.length}</p>
              {liveRun.matches.length > 0 ? <ul style={{ paddingLeft: 20 }}>
                {liveRun.matches.slice(0, 5).map((product, index) => <li key={product.product_id || product.id || `${product.title || 'product'}-${index}`} style={{ marginBottom: 8 }}>
                  <strong>{product.title || product.name || 'Untitled product'}</strong>
                  {product.brand ? ` · ${product.brand}` : ''}
                  {product.price != null ? ` · ${money(Number(product.price))}` : ''}
                  {product.ram_gb != null ? ` · ${product.ram_gb} GB RAM` : ''}
                  {product.storage_gb != null ? ` · ${product.storage_gb} GB storage` : ''}
                </li>)}
              </ul> : <p>No product matches were returned by the backend for this query.</p>}
              <p style={{ fontSize: 12, opacity: 0.75 }}>This status confirms the HTTP response and returned data only. Internal stage timings and similarity scores are not supplied by the current chat API, so they are not fabricated here.</p>
            </>}
          </section>

          <ol className="pf-phases" aria-label="Pipeline stages">
            {phases.map((p) => (
              <li key={p.key} className={`pf-ph ${p.state}`} title={p.what}>
                {p.label}
              </li>
            ))}
          </ol>

          <div className="pf-now" aria-live="polite">
            <span className="pf-now-stage">{phase.label}</span>
            <b>
              {NODES[currentId].n}. {info.title}
            </b>
            <span>{info.use}</span>
          </div>

          <div className="pf-scroll">
            <svg className="pf-svg" viewBox="0 0 1280 680" role="img" aria-label="System architecture flow diagram">
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

              <text x="720" y="12" textAnchor="middle" className="pf-edge-label">
                budget query → skip name lookup
              </text>
              <text x="930" y="190" className="pf-edge-label">vector + filters</text>
              <text x="1092" y="200" textAnchor="end" className="pf-edge-label">IDs + scores</text>
              <text x="1160" y="320" className="pf-edge-label">re-ranked</text>
              <text x="1130" y="555" className="pf-edge-label">score &lt; 0.35</text>
              <text x="845" y="372" textAnchor="middle" className="pf-edge-label">built offline</text>

              {/* nodes */}
              {Object.keys(NODES).map((id) => {
                const g = geo(id)
                const nd = NODES[id]
                const tk = TECH[id]
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
                const titleY = isDb ? 38 : g.h >= 80 ? 26 : 24
                const subY = isDb ? 54 : g.h >= 80 ? 46 : 42
                const badgeY = isDb ? 70 : g.h - 18
                const chipY = isDb ? 62 : 54
                const chipW = tk.label.length * 6 + 16
                const live = dbLive[id]
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
                      </>
                    ) : (
                      <rect className="pf-shape" width={g.w} height={g.h} rx="14" />
                    )}

                    <text x="32" y={titleY} className="pf-title">{nd.title}</text>
                    <text x="14" y={subY} className={state === 'skipped' ? 'pf-skip' : 'pf-file'}>
                      {sub}
                    </text>

                    {g.h >= 80 && (
                      <g className="pf-chip-g">
                        <rect
                          x="14"
                          y={chipY}
                          width={chipW}
                          height="17"
                          rx="8.5"
                          fill={tk.color}
                          fillOpacity="0.16"
                          stroke={tk.color}
                          strokeOpacity="0.7"
                        />
                        <text x={14 + chipW / 2} y={chipY + 12} textAnchor="middle" className="pf-chip-t">
                          {tk.label}
                        </text>
                      </g>
                    )}

                    {nd.n != null && (
                      <>
                        <circle cx={g.w - 16} cy={badgeY} r="10" className="pf-badge" />
                        <text x={g.w - 16} y={badgeY + 4} className="pf-badge-t">{nd.n}</text>
                      </>
                    )}

                    {/* the tech sticker, slapped on the top-left corner */}
                    <g transform="translate(-12 -12) rotate(-6 18 18)">
                      <g className="pf-stk">
                        <rect width="36" height="36" rx="10" fill={tk.color} className="pf-stk-bg" />
                        <g transform="translate(7 7) scale(0.92)" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          {ICON[tk.icon]}
                        </g>
                      </g>
                    </g>

                    {/* live database numbers */}
                    {isDb && dbCount[id] && (
                      <Pill cx={g.w / 2} y={g.h + 6} text={dbCount[id]} tone="count" dot />
                    )}
                    {isDb && live && <Pill cx={g.w / 2} y={g.h + 32} text={live[0]} tone={live[1]} />}
                  </g>
                )
              })}

              {/* legend */}
              <g className="pf-legend" transform="translate(260 585)">
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
                      {GLYPH[packetCategory] || GLYPH.phone}
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

          {liveRun.status !== 'success' && (
            <DataStores pc={pc} mc={mc} data={data} top={top} st={st} best={best} />
          )}

          <section className="pf-journey">
            <div className="pf-jhead">
              <h4>{liveRun.status === 'success' ? 'Live backend product journey' : 'Product journey'}</h4>
              <span>{liveRun.status === 'success' ? `Actual products returned by FastAPI for “${liveRun.query}”` : 'Illustrative walkthrough — run a live query above to replace sample products with actual backend results.'}</span>
              {liveRun.status !== 'success' && <span className="pf-key">
                <i className="k-kept" /> kept <i className="k-removed" /> removed <i className="k-out" /> shown
              </span>}
            </div>
            {liveRun.status === 'success' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, padding: '12px 0' }}>
                {liveRun.matches.length ? liveRun.matches.slice(0, 10).map((product, index) => {
                  const price = product.price ?? product.price_inr ?? product.priceINR
                  return <article key={product.product_id || product.id || `${product.title || product.name || 'product'}-${index}`} style={{ border: '1px solid #cfe7dc', background: '#f4fbf7', borderRadius: 10, padding: 12, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#087f5b', fontWeight: 700, marginBottom: 6 }}>LIVE RESULT {index + 1}</div>
                    <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{product.title || product.name || 'Untitled product'}</strong>
                    <div style={{ fontSize: 13, color: '#667085', marginTop: 4 }}>{[product.brand, product.category].filter(Boolean).join(' · ')}</div>
                    {price != null && <div style={{ fontWeight: 700, marginTop: 8 }}>{money(Number(price))}</div>}
                    {product.description && <p style={{ fontSize: 12, marginBottom: 0, color: '#475467' }}>{String(product.description).slice(0, 180)}</p>}
                  </article>
                }) : <p>The backend completed successfully but returned no matching products.</p>}
              </div>
            ) : <>
              <Journey data={data} f={f} sc={sc} />
              <p className="pf-jnote" aria-live="polite">
                {journeyNote(currentId, sc, data, best, top)}
              </p>
            </>}
          </section>

          {liveRun.status === 'success' && <section className="pf-info" aria-live="polite" style={{ marginTop: 12 }}>
            <div className="pf-info-head"><span className="pf-no">LIVE</span><h4>Actual backend answer</h4><span className="pf-tag">FastAPI · /chat/</span></div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{liveRun.response || 'The backend returned no answer text.'}</p>
            <p style={{ fontSize: 12, opacity: 0.75 }}>These products and answer came from the successful API response. Similarity scores, timings, and intermediate stage counts are not available from this endpoint.</p>
          </section>}

          {liveRun.status !== 'success' && <div className="pf-panels">
            <section className="pf-info" aria-live="polite">
              <div className="pf-info-head">
                <span className="pf-no">{NODES[currentId].n}</span>
                <h4>{info.title}</h4>
                <span className="pf-tag">{info.where}</span>
              </div>
              <p>{info.text}</p>
              <StepVisual id={currentId} sc={sc} data={data} top={top} best={best} />

              <div className="pf-algo">
                <h5>Algorithm</h5>
                <div className="pf-algo-name">{algo.name}</div>
                <pre className="pf-code">{algo.code}</pre>
                <div className="pf-io">
                  <span>In: {algo.inp}</span>
                  <span>Out: {algo.out}</span>
                </div>
                <p className="pf-cost">Cost: {algo.cost}</p>
              </div>
            </section>

            <section className="pf-calc">
              <h4>How the remaining products are scored</h4>
              <Candidates rows={data.surv} f={f} sc={sc} />
            </section>
          </div>}

          <p className="pf-foot">
            {liveRun.status === 'success'
              ? 'Live result cards and the answer above are real data returned by FastAPI. The animated architecture, intermediate product journey when no live result is loaded, similarity scores, timings, and algorithm examples remain illustrative because the current API does not expose those execution details.'
              : `This is an illustrative architecture walkthrough, not a live trace. Products, prices, similarity scores, stage timings, and database counts shown in the sample panels are not produced by your query. Run a live query to view the actual FastAPI answer and products. The current API does not expose per-stage execution events.`}
          </p>


        </div>
      </div>
    </div>
  )
}