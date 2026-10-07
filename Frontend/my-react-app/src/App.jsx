import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

// Put the Kaggle CSV in the /public folder and set its file name here.
const CSV_URL = '/amazon_products_sales_data_cleaned.csv'
const BATCH = 24

// The dataset's prices look like US dollars (an AirPods Pro 2 at 162.24 fits US Amazon prices).
// To show rupees, use CURRENCY = 'INR', LOCALE = 'en-IN' and set RATE to the current USD to INR rate.
const CURRENCY = 'USD'
const LOCALE = 'en-US'
const RATE = 1
const money = (n) =>
  n == null ? '–' : new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY }).format(n * RATE)

// The Kaggle page doesn't list column names, so each field is matched to the
// first CSV header that fits one of these patterns (checked in order).
const FIELDS = {
  title: [/^(product_?)?title$/i, /title/i, /name/i],
  category: [/category/i, /type/i],
  originalPrice: [/(original|list|actual|old)_?price/i, /mrp/i],
  price: [/^(discounted_?|current_?|sale_?)?price$/i, /price/i],
  rating: [/^(product_?)?rating$/i, /rating|stars/i],
  reviews: [/review|rating_?count|num_?ratings/i],
  sales: [/bought|sales|sold/i],
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

// Handles values like "$1,299.00", "4.5 out of 5 stars" and "5K+ bought".
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

// Uses public/logo.png. If the file is missing it falls back to "ConvoShop" in text.
function Logo({ variant }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <span className="brand-text">
        Convo<b>Shop</b>
      </span>
    )
  }
  if (variant === 'full') {
    return (
      <img
        className="logo-full"
        src="/logo.png"
        alt="ConvoShop: a retrieval-augmented generation framework for intent-driven e-commerce product advisory"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className="logo-crop">
      <img src="/logo.png" alt="ConvoShop" onError={() => setBroken(true)} />
    </span>
  )
}

// ---------- Login (demo only: accounts live in this browser's localStorage) ----------
const SESSION_KEY = 'mega_session'
const USERS_KEY = 'mega_users'
const readSession = () => {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const s = JSON.parse(store.getItem(SESSION_KEY))
      if (s) return s
    } catch {
      /* ignore bad data */
    }
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

function Login({ onLogin }) {
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [message, setMessage] = useState(null) // { type: 'error' | 'success' | 'info', text }

  const say = (type, text) => setMessage({ type, text })
  const go = (next) => {
    setMode(next)
    setMessage(null)
    setPassword('')
  }

  const finish = (user) => {
    say('success', 'Login successful! Taking you to the shop…')
    setTimeout(() => onLogin(user, remember), 700)
  }

  const submit = (e) => {
    e.preventDefault()
    const users = read(USERS_KEY, [])
    const mail = email.trim().toLowerCase()
    const existing = users.find((u) => u.email === mail)

    if (mode === 'signup') {
      if (existing) return say('error', 'That email already has an account. Try signing in.')
      const user = { name: name.trim() || mail.split('@')[0], email: mail, password }
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]))
      return finish(user)
    }
    if (mode === 'forgot') {
      if (!existing) return say('error', 'No account found with that email.')
      localStorage.setItem(USERS_KEY, JSON.stringify(users.map((u) => (u.email === mail ? { ...u, password } : u))))
      go('signin')
      return say('success', 'Password updated. You can sign in now.')
    }
    if (!existing) return say('error', 'No account found with that email. Sign up first?')
    if (existing.password !== password) return say('error', 'Invalid password. Please try again.')
    finish(existing)
  }

  const text = {
    signin: ['Welcome back!', 'Please log in.', 'Sign in'],
    signup: ['Create your account', 'Join ConvoShop in a minute.', 'Create account'],
    forgot: ['Reset your password', 'Enter your email and a new password.', 'Reset password'],
  }[mode]

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <Logo variant="full" />
        <h1>{text[0]}</h1>
        <p className="login-sub">{text[1]}</p>

        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">{mode === 'forgot' ? 'New password' : 'Password'}</label>
          <div className="pw">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" aria-pressed={show} onClick={() => setShow(!show)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {mode === 'signin' && (
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <button type="button" className="link" onClick={() => go('forgot')}>
              Forgot your password?
            </button>
          </div>
        )}

        {message && (
          <p className={`msg ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}

        <button className="primary" type="submit">
          {text[2]}
        </button>

        <p className="switch">
          {mode === 'signin' && (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" className="link" onClick={() => go('signup')}>
                Sign up
              </button>
            </>
          )}
          {mode === 'signup' && (
            <>
              Already have an account?{' '}
              <button type="button" className="link" onClick={() => go('signin')}>
                Sign in
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <button type="button" className="link" onClick={() => go('signin')}>
              ← Back to sign in
            </button>
          )}
        </p>
      </form>
    </main>
  )
}

function Floater({ p, side, onPick }) {
  return (
    <button className={`floater ${side}`} onClick={() => onPick(p.title)} aria-label={p.title}>
      <img src={p.image} alt="" />
      <span className="floor" />
    </button>
  )
}

// ---------- Store ----------
function Store({ user, onLogout }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [missing, setMissing] = useState([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('all')
  const [shown, setShown] = useState(BATCH)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [cart, setCart] = useState(() => read(`convo_cart_${user.email}`, []))
  const [cartOpen, setCartOpen] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const heroRef = useRef(null)
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
          priceText: get(row, 'price'),
          original: toNumber(get(row, 'originalPrice')),
          rating: toNumber(get(row, 'rating')),
          reviews: toNumber(get(row, 'reviews')),
          sales: toNumber(get(row, 'sales')),
          salesText: get(row, 'sales'),
          image: get(row, 'image'),
          url: get(row, 'url'),
        }))
        setMissing(Object.keys(FIELDS).filter((f) => !cols[f]))
        setRows(products)
        setStatus(products.length ? 'ready' : 'empty')
      },
      error: () => setStatus('error'),
    })
  }, [])

  const categories = useMemo(() => {
    const info = new Map()
    rows.forEach((r) => {
      const e = info.get(r.category) || { count: 0, image: null }
      e.count++
      if (!e.image && r.image) e.image = r.image
      info.set(r.category, e)
    })
    return [...info.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 60)
      .map(([name, e]) => [name, e.count, e.image])
  }, [rows])

  // Hero products: a best-selling phone and laptop first, then top sellers from other categories.
  const picks = useMemo(() => {
    const top = (include, exclude) => {
      let best = null
      for (const r of rows) {
        if (!r.image || !include.test(r.title) || exclude.test(r.title)) continue
        if (!best || (r.sales ?? 0) > (best.sales ?? 0)) best = r
      }
      return best
    }
    const phone = top(/\b(smartphone|iphone|galaxy|mobile phone)\b/i, /case|cover|charger|cable|protector|holder|stand/i)
    const laptop = top(/\blaptop\b/i, /bag|sleeve|stand|cooling|skin|charger|cover/i)
    const first = [phone, laptop].filter(Boolean)
    const best = new Map()
    for (const r of rows) {
      if (!r.image) continue
      const cur = best.get(r.category)
      if (!cur || (r.sales ?? 0) > (cur.sales ?? 0)) best.set(r.category, r)
    }
    const rest = [...best.values()].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0)).filter((r) => !first.includes(r))
    return [...first, ...rest].slice(0, 8)
  }, [rows])
  const slideCount = Math.max(1, Math.min(4, Math.floor(picks.length / 2)))
  const slide = idx % slideCount
  const leftPick = picks[slide * 2]
  const rightPick = picks[slide * 2 + 1]

  useEffect(() => {
    if (slideCount < 2) return
    const t = setInterval(() => setIdx((i) => i + 1), 5500)
    return () => clearInterval(t)
  }, [slideCount])

  const stripRef = useRef(null)
  const scrollStrip = (dir) => stripRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (q.length < 2) return []
    const out = []
    for (const r of rows) {
      if (r.title.toLowerCase().includes(q)) {
        out.push(r)
        if (out.length === 6) break
      }
    }
    return out
  }, [draft, rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(
      (r) =>
        (category === 'all' || r.category === category) &&
        (!q || r.title.toLowerCase().includes(q)),
    )
    return list
  }, [rows, query, category])

  const stats = useMemo(() => {
    const avg = (key) => {
      const v = filtered.map((r) => r[key]).filter((x) => x != null)
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    return { avgRating: avg('rating'), avgPrice: avg('price') }
  }, [filtered])

  // Load more products as the person scrolls toward the bottom.
  useEffect(() => {
    const el = endRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown((s) => s + BATCH), {
      rootMargin: '800px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [status, filtered.length])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setSelected(null)
      setCartOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    localStorage.setItem(`convo_cart_${user.email}`, JSON.stringify(cart))
  }, [cart, user.email])

  const count = cart.reduce((n, i) => n + i.qty, 0)
  const total = cart.reduce((n, i) => n + (i.price ?? 0) * i.qty, 0)
  const totalText = money(total)

  const addToCart = (p) => {
    setOrdered(false)
    setCart((c) =>
      c.some((i) => i.id === p.id)
        ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { id: p.id, title: p.title, image: p.image, price: p.price, qty: 1 }],
    )
    setCartOpen(true)
  }
  const changeQty = (id, delta) =>
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0))
  const removeItem = (id) => setCart((c) => c.filter((i) => i.id !== id))
  const checkout = () => {
    setCart([])
    setOrdered(true)
  }

  const scrollToProducts = () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })

  const goSearch = (text) => {
    setQuery(text)
    setDraft(text)
    setCategory('all')
    setShown(BATCH)
    setOpen(false)
    scrollToProducts()
  }

  const jumpTo = (name) => {
    setCategory(name)
    setQuery('')
    setShown(BATCH)
    scrollToProducts()
  }

  const onFilter = (setter, parse = (v) => v) => (e) => {
    setter(parse(e.target.value))
    setShown(BATCH)
  }

  const tilt = (x, y) => {
    heroRef.current?.style.setProperty('--rx', x)
    heroRef.current?.style.setProperty('--ry', y)
  }
  const onMove = (e) => {
    const r = heroRef.current.getBoundingClientRect()
    tilt(((e.clientX - r.left) / r.width - 0.5).toFixed(3), ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }

  const visible = filtered.slice(0, shown)

  return (
    <>
      <section className="shell" ref={heroRef} onMouseMove={onMove} onMouseLeave={() => tilt(0, 0)}>
        <nav className="topbar">
          <span className="brand">
            <Logo />
          </span>
            <details className="menu">
              <summary className="pill">Categories</summary>
              <div className="menu-list">
                {categories.slice(0, 14).map(([name, count]) => (
                  <button
                    key={name}
                    onClick={(e) => {
                      e.currentTarget.closest('details').removeAttribute('open')
                      jumpTo(name)
                    }}
                  >
                    {name} <small>{count.toLocaleString('en-US')}</small>
                  </button>
                ))}
              </div>
            </details>

            <form
              className="searchbox"
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                goSearch(draft)
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search laptops, shirts, gadgets…"
                aria-label="Search products"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
              />
              {open && suggestions.length > 0 && (
                <div className="suggest" onMouseDown={(e) => e.preventDefault()}>
                  {suggestions.map((s) => (
                    <button type="button" key={s.id} onClick={() => goSearch(s.title)}>
                      {s.image && <img src={s.image} alt="" />}
                      <span>{s.title}</span>
                      <small>{money(s.price)}</small>
                    </button>
                  ))}
                  <button type="submit" className="all">
                    See all results for &ldquo;{draft}&rdquo;
                  </button>
                </div>
              )}
            </form>

          <span className="who">Hi, {user.name}</span>
          <button className="pill" onClick={() => setCartOpen(true)}>
            Cart ({count})
          </button>
          <button className="pill" onClick={onLogout}>
            Log out
          </button>
        </nav>

        <div className="banner">
          {leftPick && <Floater key={`l${leftPick.id}`} p={leftPick} side="left" onPick={goSearch} />}
          <div className="banner-copy">
            <h1>
              Shop Smarter.
              <br />
              Live Brighter.
            </h1>
            <a className="cta-pill" href="#products">
              Explore Today&apos;s Picks <span aria-hidden="true">→</span>
            </a>
          </div>
          {rightPick && <Floater key={`r${rightPick.id}`} p={rightPick} side="right" onPick={goSearch} />}
          {slideCount > 1 && (
            <div className="dots">
              {Array.from({ length: slideCount }, (_, i) => (
                <button key={i} className={i === slide ? 'on' : ''} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`} />
              ))}
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="strip">
            <button className="arrow" onClick={() => scrollStrip(-1)} aria-label="Scroll categories left">
              ‹
            </button>
            <div className="strip-track" ref={stripRef}>
              {categories.slice(0, 14).map(([name, , image]) => (
                <button key={name} className={`strip-item${category === name ? ' on' : ''}`} onClick={() => jumpTo(name)}>
                  {image && <img src={image} alt="" />}
                  <span>{name}</span>
                </button>
              ))}
            </div>
            <button className="arrow" onClick={() => scrollStrip(1)} aria-label="Scroll categories right">
              ›
            </button>
          </div>
        )}
      </section>

      <main className="app" id="products">
        <header className="app-header">
          <h2>All products</h2>
          <p>Search, filter and sort the full 2025 Amazon dataset. More load as you scroll.</p>
        </header>

        {status === 'loading' && <p className="empty">Loading products…</p>}
        {status === 'error' && <p className="empty">Couldn&apos;t load {CSV_URL}. Check the file is in the public folder.</p>}
        {status === 'empty' && <p className="empty">The CSV has no rows.</p>}

        {status === 'ready' && (
          <>
            <section className="stats">
              <div className="stat">
                <div className="stat-value">{filtered.length.toLocaleString('en-US')}</div>
                <div className="stat-label">Products shown</div>
              </div>
              <div className="stat">
                <div className="stat-value">{formatNumber(stats.avgRating)}</div>
                <div className="stat-label">Average rating</div>
              </div>
              <div className="stat">
                <div className="stat-value">{money(stats.avgPrice)}</div>
                <div className="stat-label">Average price</div>
              </div>
              <div className="stat">
                <div className="stat-value">{categories.length}</div>
                <div className="stat-label">Categories</div>
              </div>
            </section>

            <section className="toolbar">
              <input
                className="search"
                type="search"
                placeholder="Search products"
                aria-label="Filter products"
                value={query}
                onChange={onFilter(setQuery)}
              />
              <select aria-label="Category" value={category} onChange={onFilter(setCategory)}>
                <option value="all">All categories</option>
                {categories.map(([c]) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </section>

            {missing.length > 0 && (
              <p className="empty">No matching column found for: {missing.join(', ')}. Adjust FIELDS at the top of App.jsx.</p>
            )}

            {visible.length === 0 ? (
              <p className="empty">No products match. Try a different search or filter.</p>
            ) : (
              <section className="grid">
                {visible.map((p) => (
                  <article
                    className="card"
                    key={p.id}
                    onClick={() => setSelected(p)}
                  >
                    {p.image && <img src={p.image} alt="" loading="lazy" />}
                    {p.salesText && <span className="badge">{p.salesText}</span>}
                    <h3 className="card-title">
                      <button className="linklike" onClick={() => setSelected(p)}>
                        {p.title}
                      </button>
                    </h3>
                    <span className="card-category">{p.category}</span>
                    <div className="card-foot">
                      <span className="price">
                        {money(p.price)}
                        {p.original > p.price && <s>{money(p.original)}</s>}
                      </span>
                      {p.rating != null && (
                        <span className="rating">
                          {p.rating}
                          {p.reviews != null && ` (${formatNumber(p.reviews)})`}
                        </span>
                      )}
                    </div>
                    <button
                      className="btn dark add"
                      onClick={(e) => {
                        e.stopPropagation()
                        addToCart(p)
                      }}
                    >
                      Add to cart
                    </button>
                  </article>
                ))}
              </section>
            )}

            <div ref={endRef} className="empty">
              {shown < filtered.length ? 'Loading more…' : filtered.length > 0 && 'You reached the end.'}
            </div>
          </>
        )}
      </main>

      {selected && (
        <div className="modal-bg" onClick={() => setSelected(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={selected.title} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">
              ×
            </button>
            {selected.image && <img src={selected.image} alt={selected.title} />}
            <div className="modal-info">
              {selected.salesText && <span className="badge">{selected.salesText}</span>}
              <h2>{selected.title}</h2>
              <p className="card-category">{selected.category}</p>
              <p className="price">
                {money(selected.price)}
                {selected.original > selected.price && <s>{money(selected.original)}</s>}
              </p>
              {selected.rating != null && (
                <p className="rating">
                  {selected.rating}
                  {selected.reviews != null && ` · ${formatNumber(selected.reviews)} reviews`}
                </p>
              )}
              <button className="btn dark add" onClick={() => addToCart(selected)}>
                Add to cart
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="modal-bg drawer-bg" onClick={() => setCartOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Shopping cart" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Your cart ({count})</h2>
              <button className="modal-close" onClick={() => setCartOpen(false)} aria-label="Close cart">
                ×
              </button>
            </header>
            {ordered && <p className="empty">Thanks! Your demo order was placed.</p>}
            {!ordered && cart.length === 0 && <p className="empty">Your cart is empty.</p>}
            {cart.length > 0 && (
              <>
                <ul className="cart-list">
                  {cart.map((i) => (
                    <li key={i.id}>
                      {i.image && <img src={i.image} alt="" />}
                      <div>
                        <span className="cart-title">{i.title}</span>
                        <span className="price">{money(i.price)}</span>
                        <div className="qty">
                          <button onClick={() => changeQty(i.id, -1)} aria-label="Decrease quantity">
                            −
                          </button>
                          <span>{i.qty}</span>
                          <button onClick={() => changeQty(i.id, 1)} aria-label="Increase quantity">
                            +
                          </button>
                          <button className="remove" onClick={() => removeItem(i.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <footer>
                  <p>
                    <span>Total</span>
                    <b>{totalText}</b>
                  </p>
                  <button className="btn dark add" onClick={checkout}>
                    Checkout
                  </button>
                </footer>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  )
}

export default function App() {
  const [user, setUser] = useState(readSession)

  useEffect(() => {
    document.title = 'ConvoShop'
  }, [])

  const login = (u, remember) => {
    const session = { name: u.name, email: u.email }
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
  }
  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  return user ? <Store user={user} onLogout={logout} /> : <Login onLogin={login} />
}
