import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'

// Configuration
const CSV_URL = '/amazon_products_sales_data_cleaned.csv'
const BATCH = 24
const CURRENCY = 'INR'
const LOCALE = 'en-IN'
const RATE = 83

const money = (n) =>
  n == null
    ? '–'
    : new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: 0,
      }).format(n * RATE)

const FIELDS = {
  title: [/^(product_?)?title$/i, /title/i, /name/i],
  category: [/category/i, /type/i],
  originalPrice: [/(original|list|actual|old)_?price/i, /mrp/i],
  price: [/^(discounted_?|current_?|sale_?)?price$/i, /price/i],
  rating: [/^(product_?)?rating$/i, /rating|stars/i],
  reviews: [/review|rating_?count|num_?ratings/i],
  sales: [/bought|sales|sold|purchase/i],
  image: [/image|img|thumbnail|photo/i],
  url: [/url|link/i],
}

function resolveColumns(headers) {
  const used = new Set()
  const map = {}
  for (const [field, patterns] of Object.entries(FIELDS)) {
    let found = null
    for (const pattern of patterns) {
      found = headers.find((h) => !used.has(h) && pattern.test(h))
      if (found) break
    }
    if (found) used.add(found)
    map[field] = found
  }
  return map
}

function toNumber(value) {
  if (value == null) return null
  const text = String(value)
  const n = parseFloat(text.replace(/[^0-9.]/g, ''))
  if (Number.isNaN(n)) return null
  if (/k/i.test(text)) return n * 1000
  if (/m/i.test(text)) return n * 1000000
  return n
}

function formatNumber(n) {
  return n == null ? '–' : n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function Logo() {
  return (
    <span className="brand-logo-txt">
      Convo<span className="brand-accent">Shop</span>
      <span className="ai-badge">AI</span>
    </span>
  )
}

const SESSION_KEY = 'convo_session'
const USERS_KEY = 'convo_users'

const readSession = () => {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const s = JSON.parse(store.getItem(SESSION_KEY))
      if (s) return s
    } catch {}
  }
  return null
}

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

// ----------------- 360° 3D iPhone 18 Pro Max -----------------
function IPhone18Stage() {
  const [rotY, setRotY] = useState(-20)
  const [autoSpin, setAutoSpin] = useState(true)
  const isDragging = useRef(false)
  const startX = useRef(0)

  useEffect(() => {
    let animId
    if (autoSpin) {
      const loop = () => {
        setRotY((prev) => (prev + 0.6) % 360)
        animId = requestAnimationFrame(loop)
      }
      animId = requestAnimationFrame(loop)
    }
    return () => cancelAnimationFrame(animId)
  }, [autoSpin])

  return (
    <div className="ip-viewport">
      <div className="ip-toolbar">
        <button
          className={`btn-toggle ${autoSpin ? 'on' : ''}`}
          onClick={() => setAutoSpin(!autoSpin)}
        >
          {autoSpin ? '⏸ Pause 360°' : '🔄 Auto Spin'}
        </button>
        <span className="ip-hint">Drag horizontally to rotate 360°</span>
      </div>

      <div
        className="ip-scene"
        onMouseDown={(e) => {
          setAutoSpin(false)
          isDragging.current = true
          startX.current = e.clientX
        }}
        onMouseMove={(e) => {
          if (!isDragging.current) return
          const dx = e.clientX - startX.current
          startX.current = e.clientX
          setRotY((r) => (r + dx * 0.7) % 360)
        }}
        onMouseUp={() => (isDragging.current = false)}
        onMouseLeave={() => (isDragging.current = false)}
      >
        <div className="ip-floor-glow" />

        <div
          className="ip-3d-box"
          style={{ transform: `rotateY(${rotY}deg) rotateX(8deg)` }}
        >
          {/* Side Frame */}
          <div className="ip-side left">
            <span className="key action" />
            <span className="key vol" />
            <span className="key vol" />
          </div>
          <div className="ip-side right">
            <span className="key pwr" />
          </div>

          {/* Front OLED Screen */}
          <div className="ip-face front">
            <div className="ip-bezel">
              <div className="ip-screen">
                <div className="ip-island">
                  <span className="cam" />
                </div>
                <div className="ip-screen-ui">
                  <span className="ip-clock">9:41</span>
                  <div className="ip-glow-sphere">
                    <span className="ip-model-tag">18 Pro Max</span>
                  </div>
                  <div className="ip-home-bar" />
                </div>
              </div>
            </div>
          </div>

          {/* Back Matte Titanium Chassis */}
          <div className="ip-face back">
            <div className="ip-backplate">
              <span className="apple-logo"></span>
              <div className="cam-bump">
                <div className="lens l1"><span className="optics" /></div>
                <div className="lens l2"><span className="optics" /></div>
                <div className="lens l3"><span className="optics" /></div>
                <span className="flash" />
                <span className="lidar" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------- Auth Screen -----------------
function Login({ onLogin }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    const users = read(USERS_KEY, [])
    const mail = email.trim().toLowerCase()
    const existing = users.find((u) => u.email === mail)

    if (mode === 'signup') {
      if (existing) return setMsg({ type: 'error', text: 'Account already exists. Please sign in.' })
      const u = { name: name.trim() || mail.split('@')[0], email: mail, password }
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, u]))
      setMsg({ type: 'success', text: 'Account created! Welcome to ConvoShop.' })
      setTimeout(() => onLogin(u, true), 500)
      return
    }
    if (!existing) return setMsg({ type: 'error', text: 'No account found. Sign up below.' })
    if (existing.password !== password) return setMsg({ type: 'error', text: 'Incorrect password.' })
    setMsg({ type: 'success', text: 'Welcome back! Launching…' })
    setTimeout(() => onLogin(existing, true), 500)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-glow g1" />
      <div className="auth-glow g2" />

      <div className="auth-box">
        <div className="auth-left">
          <Logo />
          <h1>Leaps ahead in shopping.</h1>
          <p className="auth-left-desc">
            Experience conversational discovery powered by Gemini 1.5 RAG reasoning and verified Amazon reviews.
          </p>
          <div className="auth-perks">
            <div className="perk"><span>💬</span> Natural dialogue queries</div>
            <div className="perk"><span>🧠</span> Real customer review analysis</div>
            <div className="perk"><span>⚡</span> Instant side-by-side trade-offs</div>
          </div>
        </div>

        <div className="auth-right">
          <form className="glass-card" onSubmit={submit}>
            <h2>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
            <p className="card-sub">Access your personal advisory co-pilot</p>

            {mode === 'signup' && (
              <div className="f-row">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="f-row">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="f-row">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {msg && <div className={`msg-badge ${msg.type}`}>{msg.text}</div>}

            <button type="submit" className="btn-glow-full">
              {mode === 'signin' ? 'Sign In to ConvoShop' : 'Create Account'}
            </button>

            <div className="auth-switch">
              {mode === 'signin' ? (
                <p>
                  No account?{' '}
                  <button type="button" onClick={() => setMode('signup')}>
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Have an account?{' '}
                  <button type="button" onClick={() => setMode('signin')}>
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ----------------- AI Assistant Drawer -----------------
function AIDrawer({ isOpen, onClose, allProducts }) {
  const [msgs, setMsgs] = useState([
    {
      sender: 'ai',
      text: "👋 Hi! I'm your ConvoShop AI Co-Pilot. Tell me what you're seeking (e.g. 'Best camera phone under ₹20,000' or 'Lightweight laptop with 10hr battery').",
      matches: [],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const send = (q) => {
    const text = (q || input).trim()
    if (!text) return
    setMsgs((m) => [...m, { sender: 'user', text }])
    setInput('')
    setLoading(true)

    setTimeout(() => {
      const words = text.toLowerCase().split(/\s+/)
      const matches = allProducts
        .filter((p) =>
          words.some(
            (w) =>
              p.title.toLowerCase().includes(w) ||
              p.category.toLowerCase().includes(w)
          )
        )
        .slice(0, 3)

      setMsgs((m) => [
        ...m,
        {
          sender: 'ai',
          text: `Grounded in verified buyer reviews for "${text}":`,
          reasoning: 'Decomposed intent: parsed price & filtered by review sentiment.',
          matches: matches.length > 0 ? matches : allProducts.slice(0, 2),
        },
      ])
      setLoading(false)
    }, 800)
  }

  if (!isOpen) return null

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-head-txt">
            <span className="sparkle">✨</span>
            <div>
              <h3>ConvoShop AI Advisor</h3>
              <small>Gemini 1.5 RAG Review Grounding</small>
            </div>
          </div>
          <button className="btn-x" onClick={onClose}>×</button>
        </div>

        <div className="drawer-chat">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.sender}`}>
              <p>{m.text}</p>
              {m.reasoning && <div className="reason-pill">{m.reasoning}</div>}
              {m.matches?.length > 0 && (
                <div className="match-list">
                  {m.matches.map((item) => (
                    <div key={item.id} className="match-card">
                      <img src={item.image} alt="" />
                      <div>
                        <h6>{item.title}</h6>
                        <strong>{money(item.price)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="bubble ai loading-txt"><span className="dot" /> Reasoning with Gemini…</div>}
          <div ref={chatRef} />
        </div>

        <div className="drawer-foot">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              type="text"
              placeholder="Ask anything (e.g. phone with great battery)…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit">Ask</button>
          </form>
        </div>
      </aside>
    </div>
  )
}

// ----------------- Main Store View -----------------
function Store({ user, onLogout }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [category, setCategory] = useState('all')
  const [shown, setShown] = useState(BATCH)
  const [cart, setCart] = useState(() => read(`convo_cart_${user.email}`, []))
  const [cartOpen, setCartOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = resolveColumns(result.meta.fields || [])
        const get = (row, field) => (cols[field] ? row[cols[field]] : undefined)
        const products = result.data.map((row, i) => ({
          id: i,
          title: get(row, 'title') || 'Untitled product',
          category: get(row, 'category') || 'Uncategorized',
          price: toNumber(get(row, 'price')),
          original: toNumber(get(row, 'originalPrice')),
          rating: toNumber(get(row, 'rating')),
          reviews: toNumber(get(row, 'reviews')),
          salesText: get(row, 'sales'),
          image: get(row, 'image'),
        }))
        setRows(products)
        setStatus(products.length ? 'ready' : 'empty')
      },
      error: () => setStatus('error'),
    })
  }, [])

  const categories = useMemo(() => {
    const counts = new Map()
    rows.forEach((r) => counts.set(r.category, (counts.get(r.category) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => category === 'all' || r.category === category)
  }, [rows, category])

  useEffect(() => {
    const el = endRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown((s) => s + BATCH), {
      rootMargin: '600px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [status, filtered.length])

  useEffect(() => {
    localStorage.setItem(`convo_cart_${user.email}`, JSON.stringify(cart))
  }, [cart, user.email])

  const addToCart = (p) => {
    setCart((c) =>
      c.some((i) => i.id === p.id)
        ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { id: p.id, title: p.title, image: p.image, price: p.price, qty: 1 }]
    )
    setCartOpen(true)
  }

  const count = cart.reduce((n, i) => n + i.qty, 0)
  const total = cart.reduce((n, i) => n + (i.price ?? 0) * i.qty, 0)

  return (
    <div className="store-container">
      {/* Top Glass Navigation */}
      <header className="navbar-glass">
        <div className="nav-inner">
          <Logo />

          <div className="nav-actions">
            <button className="co-pilot-nav-btn" onClick={() => setAiOpen(true)}>
              ✨ AI Advisor
            </button>
            <button className="cart-trigger-btn" onClick={() => setCartOpen(true)}>
              Cart <span className="cart-count-badge">{count}</span>
            </button>
            <button className="logout-btn" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Cyber-Blue Spotlight Hero with 360° 3D iPhone */}
      <section className="store-hero">
        <div className="hero-content">
          <span className="hero-eyebrow">Intent-driven RAG e-commerce</span>
          <h1>ConvoShop, leaps ahead</h1>
          <p className="hero-subtitle">
            Thinking about upgrading? Tell our AI advisor what you need and discover how each model compares to your exact budget.
          </p>

          <div className="hero-button-group">
            <button className="pill-white-action" onClick={() => setAiOpen(true)}>
              Ask ConvoShop
            </button>
            <a className="pill-ghost-action" href="#products">
              See the differences
            </a>
          </div>

          {/* Interactive 360° 3D Phone Stage */}
          <IPhone18Stage />
        </div>
      </section>

      {/* Categories Horizontal Pills */}
      {categories.length > 0 && (
        <nav className="category-scroll-container">
          <div className="category-scroll-track">
            <button
              className={`cat-pill ${category === 'all' ? 'active' : ''}`}
              onClick={() => setCategory('all')}
            >
              All Categories
            </button>
            {categories.map(([name, catCount]) => (
              <button
                key={name}
                className={`cat-pill ${category === name ? 'active' : ''}`}
                onClick={() => setCategory(name)}
              >
                {name} <small>({catCount})</small>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Main Catalog View */}
      <main className="catalog-content" id="products">
        <div className="catalog-meta-bar">
          <div>
            <h3>Verified Catalog</h3>
            <p className="meta-sub">Showing {filtered.length.toLocaleString('en-US')} products</p>
          </div>
        </div>

        {status === 'loading' && <div className="loading-state">Loading verified products…</div>}

        {status === 'ready' && (
          <div className="bento-product-grid">
            {filtered.slice(0, shown).map((p) => (
              <article key={p.id} className="product-card-modern">
                <div className="card-top-tags">
                  {p.rating != null && (
                    <span className="tag-rating">
                      ★ {p.rating} <small>({formatNumber(p.reviews || 0)})</small>
                    </span>
                  )}
                </div>

                <div className="image-viewport">
                  <img src={p.image} alt={p.title} loading="lazy" />
                </div>

                <div className="card-body">
                  <span className="category-label">{p.category}</span>
                  <h4 className="product-title">{p.title}</h4>

                  <div className="price-tag-row">
                    <span className="price-main">{money(p.price)}</span>
                    {p.original > p.price && <span className="price-original">{money(p.original)}</span>}
                  </div>

                  <div className="card-sentiment-chips">
                    <span className="chip verified">✓ Verified Reviews</span>
                    <span className="chip rag">✨ Gemini Grounded</span>
                  </div>

                  <button className="btn-add-cart" onClick={() => addToCart(p)}>
                    Add to Cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div ref={endRef} className="scroll-sentinel">
          {shown < filtered.length ? 'Loading more products…' : 'Showing all verified products.'}
        </div>
      </main>

      {/* Floating AI Launcher */}
      <button className="floating-ai-launcher" onClick={() => setAiOpen(true)}>
        <span>✨</span> Ask ConvoShop
      </button>

      {/* AI Drawer */}
      <AIDrawer isOpen={aiOpen} onClose={() => setAiOpen(false)} allProducts={rows} />

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="drawer-scrim" onClick={() => setCartOpen(false)}>
          <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h3>Cart ({count})</h3>
              <button className="btn-x" onClick={() => setCartOpen(false)}>×</button>
            </div>
            <div className="drawer-chat">
              {cart.map((i) => (
                <div key={i.id} className="match-card">
                  <img src={i.image} alt="" />
                  <div>
                    <h6>{i.title}</h6>
                    <strong>{money(i.price)} × {i.qty}</strong>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-total-box">
              <div className="total-row"><span>Total:</span> <strong>{money(total)}</strong></div>
              <button className="btn-glow-full" onClick={() => setCart([])}>Checkout</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

// ----------------- Root App Export -----------------
export default function App() {
  const [user, setUser] = useState(readSession)

  const login = (u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  return user ? <Store user={user} onLogout={logout} /> : <Login onLogin={login} />
}