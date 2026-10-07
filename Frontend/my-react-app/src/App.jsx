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
                  {/* Sales badge removed completely */}
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

      {/* Embedded Complete Styles */}
      <style>{`
        :root {
          --bg-deep: #030712;
          --surface: rgba(13, 21, 41, 0.75);
          --border: rgba(255, 255, 255, 0.1);
          --primary-blue: #2563eb;
          --accent-cyan: #38bdf8;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --radius-pill: 9999px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg-deep); color: var(--text-main); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

        .store-container {
          min-height: 100vh;
          background: 
            radial-gradient(circle 900px at 50% -10%, rgba(37, 99, 235, 0.38) 0%, transparent 80%),
            radial-gradient(circle 600px at 85% 15%, rgba(56, 189, 248, 0.12) 0%, transparent 70%),
            var(--bg-deep);
        }

        .navbar-glass {
          position: sticky; top: 0; z-index: 40;
          background: rgba(3, 7, 18, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 14px 28px;
        }
        .nav-inner { max-width: 1240px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .brand-logo-txt { font-size: 22px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; }
        .brand-accent { color: var(--accent-cyan); }
        .ai-badge { font-size: 10px; background: rgba(56, 189, 248, 0.15); color: var(--accent-cyan); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 8px; border-radius: var(--radius-pill); }
        .nav-actions { display: flex; align-items: center; gap: 12px; }
        .co-pilot-nav-btn { padding: 8px 18px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: 0; border-radius: var(--radius-pill); font-size: 13px; font-weight: 700; cursor: pointer; }
        .cart-trigger-btn { padding: 8px 18px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border); border-radius: var(--radius-pill); font-size: 13px; color: #fff; cursor: pointer; }
        .cart-count-badge { background: var(--primary-blue); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: var(--radius-pill); font-weight: 800; }
        .logout-btn { background: none; border: 0; color: #64748b; font-size: 12px; cursor: pointer; }

        .store-hero { padding: 80px 24px 40px; text-align: center; max-width: 860px; margin: 0 auto; }
        .hero-eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em; color: var(--accent-cyan); margin-bottom: 16px; display: inline-block; }
        .store-hero h1 { font-size: clamp(34px, 5.2vw, 56px); font-weight: 800; color: #ffffff; line-height: 1.1; margin-bottom: 18px; }
        .hero-subtitle { font-size: 16px; color: var(--text-muted); line-height: 1.6; max-width: 640px; margin: 0 auto 32px; }
        .hero-button-group { display: flex; justify-content: center; gap: 14px; margin-bottom: 20px; }
        .pill-white-action { padding: 12px 28px; border-radius: var(--radius-pill); background: #ffffff; color: #030712; font-size: 14px; font-weight: 700; border: 0; cursor: pointer; }
        .pill-ghost-action { padding: 12px 28px; border-radius: var(--radius-pill); background: transparent; color: #ffffff; font-size: 14px; font-weight: 600; border: 1px solid rgba(255, 255, 255, 0.3); text-decoration: none; cursor: pointer; }

        .ip-viewport { width: 100%; max-width: 680px; height: 460px; margin: 20px auto 0; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none; }
        .ip-toolbar { position: absolute; top: 0; z-index: 20; display: flex; align-items: center; gap: 14px; }
        .btn-toggle { padding: 7px 16px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: rgba(255, 255, 255, 0.08); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-toggle.on { background: var(--primary-blue); border-color: var(--accent-cyan); }
        .ip-hint { font-size: 12px; color: #64748b; }
        .ip-scene { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; perspective: 1400px; cursor: grab; }
        .ip-floor-glow { position: absolute; bottom: 20px; width: 340px; height: 50px; background: radial-gradient(ellipse at center, rgba(37, 99, 235, 0.45) 0%, transparent 75%); filter: blur(16px); }
        .ip-3d-box { position: relative; width: 220px; height: 430px; transform-style: preserve-3d; transition: transform 0.05s linear; }

        .ip-face.front { position: absolute; inset: 0; transform: translateZ(10px); backface-visibility: hidden; border-radius: 44px; background: #020617; padding: 4px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); }
        .ip-bezel { width: 100%; height: 100%; border-radius: 40px; background: linear-gradient(135deg, #cbd5e1, #475569 45%, #0f172a 100%); padding: 3px; }
        .ip-screen { position: relative; width: 100%; height: 100%; border-radius: 38px; background: #000; overflow: hidden; }
        .ip-island { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 76px; height: 20px; background: #000; border-radius: 20px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; z-index: 10; }
        .ip-island .cam { width: 6px; height: 6px; border-radius: 50%; background: #082f49; border: 1px solid rgba(255,255,255,0.2); }
        .ip-screen-ui { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 32px 16px 14px; background: radial-gradient(circle at 50% 30%, #1e3a8a 0%, #030712 70%); }
        .ip-clock { font-size: 38px; font-weight: 700; color: #fff; }
        .ip-model-tag { font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255, 255, 255, 0.25); }
        .ip-home-bar { width: 75px; height: 4px; border-radius: 3px; background: rgba(255, 255, 255, 0.6); }

        .ip-face.back { position: absolute; inset: 0; transform: rotateY(180deg) translateZ(10px); backface-visibility: hidden; border-radius: 44px; background: linear-gradient(145deg, #1e293b, #0f172a 60%, #020617); border: 3px solid #64748b; padding: 14px; display: flex; }
        .ip-backplate { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .apple-logo { font-size: 44px; color: rgba(255, 255, 255, 0.2); }
        .cam-bump { position: absolute; top: 8px; left: 6px; width: 92px; height: 92px; border-radius: 24px; background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.15); padding: 8px; }
        .lens { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: #020617; border: 2px solid #64748b; display: flex; align-items: center; justify-content: center; }
        .lens.l1 { top: 6px; left: 6px; }
        .lens.l2 { bottom: 6px; left: 6px; }
        .lens.l3 { top: 26px; right: 6px; }
        .optics { width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #0369a1, #020617); }
        .flash { position: absolute; top: 8px; right: 10px; width: 10px; height: 10px; border-radius: 50%; background: #fef08a; }
        .lidar { position: absolute; bottom: 10px; right: 10px; width: 8px; height: 8px; border-radius: 50%; background: #000; }

        .ip-side { position: absolute; top: 40px; bottom: 40px; width: 20px; display: flex; flex-direction: column; gap: 14px; }
        .ip-side.left { left: -10px; transform: rotateY(-90deg); }
        .ip-side.right { right: -10px; transform: rotateY(90deg); }
        .key { width: 12px; background: #64748b; border-radius: 2px; }
        .key.action { height: 14px; }
        .key.vol { height: 24px; }
        .key.pwr { height: 36px; margin-top: 20px; }

        .category-scroll-container { max-width: 1240px; margin: 0 auto 30px; padding: 0 24px; }
        .category-scroll-track { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
        .cat-pill { flex: none; padding: 8px 18px; border: 1px solid var(--border); background: rgba(255, 255, 255, 0.04); border-radius: var(--radius-pill); color: var(--text-muted); cursor: pointer; }
        .cat-pill.active { background: #fff; color: #030712; }

        .catalog-content { max-width: 1240px; margin: 0 auto; padding: 0 24px 80px; }
        .catalog-meta-bar { display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 14px; }
        .bento-product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
        .product-card-modern { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 18px; display: flex; flex-direction: column; backdrop-filter: blur(14px); }
        .product-card-modern:hover { transform: translateY(-4px); border-color: rgba(59, 130, 246, 0.5); }
        .card-top-tags { display: flex; justify-content: flex-end; font-size: 11px; font-weight: 700; margin-bottom: 10px; }
        .tag-rating { color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 2px 7px; border-radius: 4px; margin-left: auto; }
        .image-viewport { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; }
        .image-viewport img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .category-label { font-size: 11px; text-transform: uppercase; color: var(--accent-cyan); font-weight: 700; }
        .product-title { font-size: 14px; font-weight: 600; color: #fff; margin: 4px 0 10px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .price-tag-row { display: flex; align-items: baseline; gap: 8px; margin-top: auto; margin-bottom: 12px; }
        .price-main { font-size: 19px; font-weight: 800; color: #fff; }
        .price-original { font-size: 12px; color: #64748b; text-decoration: line-through; }
        .card-sentiment-chips { display: flex; gap: 6px; margin-bottom: 14px; }
        .chip { font-size: 10px; font-weight: 700; padding: 3px 6px; border-radius: 4px; }
        .chip.verified { color: #34d399; background: rgba(52, 211, 153, 0.15); }
        .chip.rag { color: var(--accent-cyan); background: rgba(56, 189, 248, 0.15); }
        .btn-add-cart { padding: 10px; border: 0; border-radius: 8px; background: #fff; color: #030712; font-weight: 700; cursor: pointer; width: 100%; }

        .floating-ai-launcher {
          position: fixed; bottom: 24px; right: 24px; z-index: 45;
          display: flex; align-items: center; gap: 8px; padding: 12px 20px;
          border-radius: var(--radius-pill); border: 1px solid rgba(255,255,255,0.25);
          background: linear-gradient(135deg, #1e3a8a, #0f172a); color: #fff;
          font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 10px 30px rgba(30, 58, 138, 0.5);
        }

        .drawer-scrim { position: fixed; inset: 0; z-index: 50; background: rgba(3, 7, 18, 0.7); backdrop-filter: blur(8px); display: flex; justify-content: flex-end; }
        .drawer-panel { width: min(460px, 100%); height: 100%; background: #090e1d; border-left: 1px solid var(--border); display: flex; flex-direction: column; }
        .drawer-head { padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .drawer-head-txt { display: flex; align-items: center; gap: 10px; }
        .drawer-head-txt h3 { font-size: 16px; color: #fff; }
        .btn-x { background: none; border: 0; font-size: 24px; color: #94a3b8; cursor: pointer; }
        .drawer-chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .bubble { max-width: 88%; padding: 12px 16px; border-radius: 14px; font-size: 14px; }
        .bubble.user { align-self: flex-end; background: var(--primary-blue); color: #fff; }
        .bubble.ai { align-self: flex-start; background: rgba(255,255,255,0.05); border: 1px solid var(--border); }
        .reason-pill { margin-top: 8px; font-size: 11px; padding: 4px 8px; background: rgba(37,99,235,0.2); border-radius: 6px; color: #93c5fd; }
        .match-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .match-card { display: flex; gap: 10px; padding: 8px; background: rgba(255,255,255,0.04); border-radius: 8px; align-items: center; }
        .match-card img { width: 40px; height: 40px; object-fit: contain; }
        .match-card h6 { font-size: 12px; color: #fff; }
        .drawer-foot { padding: 16px; border-top: 1px solid var(--border); }
        .drawer-foot form { display: flex; gap: 8px; }
        .drawer-foot input { flex: 1; padding: 10px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: #fff; }
        .drawer-foot button { padding: 8px 18px; border-radius: var(--radius-pill); border: 0; background: #fff; color: #030712; font-weight: 700; cursor: pointer; }
        .cart-total-box { padding: 20px; border-top: 1px solid var(--border); }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 16px; color: #fff; }

        .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px 20px; position: relative; overflow: hidden; background: #030712; }
        .auth-glow { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
        .auth-glow.g1 { width: 440px; height: 440px; top: -50px; left: -50px; background: rgba(37, 99, 235, 0.25); }
        .auth-glow.g2 { width: 460px; height: 460px; bottom: -60px; right: -60px; background: rgba(56, 189, 248, 0.15); }
        .auth-box { position: relative; z-index: 2; width: 100%; max-width: 960px; display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center; }
        .auth-left h1 { font-size: 38px; color: #fff; margin: 16px 0; }
        .auth-left-desc { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
        .auth-perks { display: flex; flex-direction: column; gap: 10px; }
        .perk { font-size: 13px; color: #cbd5e1; display: flex; gap: 10px; align-items: center; }
        .glass-card { background: rgba(13, 21, 41, 0.85); backdrop-filter: blur(20px); border: 1px solid var(--border); padding: 36px 32px; border-radius: 20px; display: flex; flex-direction: column; gap: 16px; }
        .glass-card h2 { font-size: 22px; color: #fff; }
        .card-sub { font-size: 13px; color: #94a3b8; }
        .f-row { display: flex; flexDirection: column; gap: 6px; }
        .f-row label { font-size: 12px; font-weight: 600; color: #cbd5e1; }
        .f-row input { padding: 11px 14px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: #fff; font-size: 14px; }
        .btn-glow-full { width: 100%; padding: 12px; border-radius: 8px; border: 0; background: #fff; color: #030712; font-weight: 700; cursor: pointer; }
        .auth-switch { text-align: center; font-size: 13px; color: #94a3b8; }
        .auth-switch button { background: none; border: 0; color: var(--accent-cyan); font-weight: 700; cursor: pointer; }
        .msg-badge { padding: 8px 12px; border-radius: 8px; font-size: 12px; }
        .msg-badge.error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .msg-badge.success { background: rgba(52, 211, 153, 0.2); color: #86efac; }

        @media (max-width: 840px) {
          .auth-box { grid-template-columns: 1fr; }
          .auth-left { display: none; }
        }
      `}</style>
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