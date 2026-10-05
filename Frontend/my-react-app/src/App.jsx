import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

// Put the Kaggle CSV in the /public folder and set its file name here.
const CSV_URL = '/amazon_products_sales_data_cleaned.csv'
const BATCH = 24

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

// ---------- Login (demo only: accounts live in this browser's localStorage) ----------
const SESSION_KEY = 'mega_session'
const USERS_KEY = 'mega_users'
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function Login({ onLogin }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const users = read(USERS_KEY, [])
    const mail = email.trim().toLowerCase()
    if (mode === 'signup') {
      if (users.some((u) => u.email === mail)) return setError('That email already has an account. Sign in instead.')
      const user = { name: name.trim() || mail.split('@')[0], email: mail, password }
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]))
      return onLogin(user)
    }
    const user = users.find((u) => u.email === mail && u.password === password)
    if (!user) return setError('Wrong email or password. New here? Create an account.')
    onLogin(user)
  }

  const flip = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError('')
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>Convo Shop</h1>
        <p>{mode === 'signin' ? 'Sign in to see the Black Friday deals.' : 'Create an account to start shopping.'}</p>
        {mode === 'signup' && (
          <input placeholder="Your name" aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input type="email" required placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (6+ characters)"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn dark" type="submit">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button className="link" type="button" onClick={flip}>
          {mode === 'signin' ? 'No account? Create one' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
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
  const [minRating, setMinRating] = useState(0)
  const [sort, setSort] = useState('default')
  const [shown, setShown] = useState(BATCH)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
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
          originalText: get(row, 'originalPrice'),
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
    const counts = new Map()
    rows.forEach((r) => counts.set(r.category, (counts.get(r.category) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)
  }, [rows])

  // One best seller from each of 6 different categories spins in the 3D ring.
  const featured = useMemo(() => {
    const best = new Map()
    for (const r of rows) {
      if (!r.image) continue
      const cur = best.get(r.category)
      if (!cur || (r.sales ?? 0) > (cur.sales ?? 0)) best.set(r.category, r)
    }
    return [...best.values()].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0)).slice(0, 6)
  }, [rows])

  const hero = featured.length ? featured[idx % featured.length] : null

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
        (minRating === 0 || (r.rating ?? 0) >= minRating) &&
        (!q || r.title.toLowerCase().includes(q)),
    )
    const byNumber = (key, dir) => (a, b) => dir * ((a[key] ?? -Infinity) - (b[key] ?? -Infinity))
    if (sort === 'sales') list.sort(byNumber('sales', -1))
    if (sort === 'rating') list.sort(byNumber('rating', -1))
    if (sort === 'price-asc') list.sort(byNumber('price', 1))
    if (sort === 'price-desc') list.sort(byNumber('price', -1))
    return list
  }, [rows, query, category, minRating, sort])

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
    const onKey = (e) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
      <section className="hero" ref={heroRef} onMouseMove={onMove} onMouseLeave={() => tilt(0, 0)}>
        <div className="hero-panel">
          <nav className="hero-nav">
            <span className="logo" aria-hidden="true" />
            <span className="brand">Convo Shop</span>
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
                      <small>{s.priceText}</small>
                    </button>
                  ))}
                  <button type="submit" className="all">
                    See all results for &ldquo;{draft}&rdquo;
                  </button>
                </div>
              )}
            </form>

            <span className="who">Hi, {user.name}</span>
            <button className="pill" onClick={onLogout}>
              Log out
            </button>
          </nav>

          <h1 className="mega">Mega Deals</h1>
          <span className="tag tag-top">
            <i>Black</i> ✦ Friday
          </span>
          <span className="tag tag-off">
            <i>Get</i> 80% <i>off</i>
          </span>

          {hero && (
            <>
              <div className="stage">
                <div className="tilt">
                  {/* One product spins on its own axis; the next one appears after each full turn. */}
                  <div
                    className="slab"
                    key={hero.id}
                    onAnimationIteration={() => featured.length > 1 && setIdx((i) => i + 1)}
                  >
                    <button className="f front" onClick={() => goSearch(hero.title)} aria-label={hero.title}>
                      <img src={hero.image} alt="" />
                    </button>
                    <div className="f back" aria-hidden="true">
                      Mega
                      <br />
                      Deals
                    </div>
                    <div className="side s-l" />
                    <div className="side s-r" />
                    <div className="side s-t" />
                    <div className="side s-b" />
                  </div>
                </div>
                <div className="shadow" />
              </div>
              <div className="dots">
                <span>{hero.category}</span>
                {featured.map((f, i) => (
                  <button
                    key={f.id}
                    className={i === idx % featured.length ? 'on' : ''}
                    onClick={() => setIdx(i)}
                    aria-label={`Show ${f.category}`}
                  />
                ))}
              </div>
            </>
          )}

          <div className="hero-copy">
            <p>Six best sellers turn in 3D, one after another. Hover to pause, click to see it.</p>
            <a className="btn dark" href="#products">
              Shop now →
            </a>
          </div>
        </div>
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
                <div className="stat-value">{formatNumber(stats.avgPrice)}</div>
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
              <select aria-label="Minimum rating" value={minRating} onChange={onFilter(setMinRating, Number)}>
                <option value={0}>Any rating</option>
                <option value={3}>3 stars and up</option>
                <option value={4}>4 stars and up</option>
                <option value={4.5}>4.5 stars and up</option>
              </select>
              <select aria-label="Sort by" value={sort} onChange={onFilter(setSort)}>
                <option value="default">Default order</option>
                <option value="sales">Most sold</option>
                <option value="rating">Highest rated</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
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
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(p)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(p)}
                  >
                    {p.image && <img src={p.image} alt="" loading="lazy" />}
                    {p.salesText && <span className="badge">{p.salesText}</span>}
                    <h3 className="card-title">{p.title}</h3>
                    <span className="card-category">{p.category}</span>
                    <div className="card-foot">
                      <span className="price">
                        {p.priceText ?? '–'}
                        {p.originalText && <s>{p.originalText}</s>}
                      </span>
                      {p.rating != null && (
                        <span className="rating">
                          {p.rating}
                          {p.reviews != null && ` (${formatNumber(p.reviews)})`}
                        </span>
                      )}
                    </div>
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
                {selected.priceText ?? '–'}
                {selected.originalText && <s>{selected.originalText}</s>}
              </p>
              {selected.rating != null && (
                <p className="rating">
                  {selected.rating}
                  {selected.reviews != null && ` · ${formatNumber(selected.reviews)} reviews`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  const [user, setUser] = useState(() => read(SESSION_KEY, null))

  useEffect(() => {
    document.title = 'Convo Shop'
  }, [])

  const login = (u) => {
    const session = { name: u.name, email: u.email }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
  }
  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  return user ? <Store user={user} onLogout={logout} /> : <Login onLogin={login} />
}
