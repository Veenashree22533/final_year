import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

const BACKEND_URL = 'http://127.0.0.1:8000'
const CSV_URL = '/all_products.csv'
const BATCH = 24
const CURRENCY = 'INR'
const LOCALE = 'en-IN'
const RATE = 1

// Edit these to queries your backend answers well; they appear on the hero and in the empty chat.
const SUGGESTIONS = [
  'Best phone under ₹25,000',
  'Student setup under ₹1 lakh',
  'Compare two smartwatches',
  'Laptop for coding',
]
const FOLLOW_UPS = ['Compare these', 'Show cheaper options', 'Which has the best battery?']

const money = (n) =>
  n == null || n <= 0
    ? '–'
    : new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: 0,
      }).format(n * RATE)

function toNumber(value) {
  if (value == null) return null
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isNaN(n) ? null : n
}

/* ---------- Query parsing (price + keywords) ---------- */

const PRICE_RE =
  /(?:\b(?:under|below|less than|within|max|upto|up to|rs\.?|inr)|₹)\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?)?\b/i

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'of', 'in', 'on', 'to', 'me', 'my', 'i', 'is', 'are',
  'show', 'find', 'get', 'give', 'want', 'need', 'looking', 'best', 'top', 'good', 'great', 'cheap',
  'which', 'what', 'that', 'has', 'have', 'under', 'below', 'over', 'than', 'less', 'within', 'max',
  'upto', 'up', 'budget', 'please', 'can', 'you', 'some', 'any', 'one',
])

function parseQuery(raw) {
  const q = String(raw).toLowerCase().replace(/(\d),(?=\d)/g, '$1')
  let maxPrice = null
  const m = q.match(PRICE_RE)
  if (m) {
    let v = parseFloat(m[1])
    const unit = m[2] || ''
    if (/^(k|thousand)$/.test(unit)) v *= 1000
    else if (/^(lakhs?|lacs?)$/.test(unit)) v *= 100000
    else if (v < 1000) v *= 1000
    maxPrice = v
  }
  const words = q
    .replace(new RegExp(PRICE_RE.source, 'gi'), ' ')
    .replace(/mobiles?/g, 'phone')
    .replace(/notebooks?/g, 'laptop')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9+]/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w))
  return { maxPrice, words }
}

function matchProducts(products, raw, { any = false, category = 'all' } = {}) {
  const { maxPrice, words } = parseQuery(raw)
  return products.filter((p) => {
    if (category !== 'all' && p.category !== category) return false
    if (maxPrice && !(p.price != null && p.price > 0 && p.price <= maxPrice)) return false
    if (!words.length) return true
    const hay = `${p.brand || ''} ${p.title || ''} ${p.category || ''}`.toLowerCase()
    const hit = (w) => hay.includes(w) || w.includes(p.category) || p.category.includes(w)
    return any ? words.some(hit) : words.every(hit)
  })
}

/* ---------- Icons (rounded line icons) ---------- */

const ICONS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </>
  ),
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  bag: (
    <>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  spark: (
    <>
      <path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z" />
      <path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  share: <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  check: <path d="M20 6L9 17l-5-5" />,
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />,
  truck: (
    <>
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 3v5h-7z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>
  ),
  up: <path d="M18 15l-6-6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
}

function Icon({ name, size = 20, fill = false }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

/* ---------- Product images ----------
   A real image_url from the catalog is used when it is a usable http(s) link.
   Otherwise a neutral placeholder (device outline + brand) is generated. */

const SHAPES = {
  phone:
    '<rect x="118" y="30" width="84" height="164" rx="16" fill="#fff" stroke="#e3b184" stroke-width="3"/>' +
    '<rect x="128" y="46" width="64" height="124" rx="6" fill="#f3d3b3"/>' +
    '<rect x="146" y="36" width="28" height="4" rx="2" fill="#e3b184"/>',
  laptop:
    '<rect x="80" y="44" width="160" height="104" rx="8" fill="#fff" stroke="#e3b184" stroke-width="3"/>' +
    '<rect x="90" y="54" width="140" height="84" rx="3" fill="#f3d3b3"/>' +
    '<path d="M52 160h216l-14 22H66z" fill="#fff" stroke="#e3b184" stroke-width="3" stroke-linejoin="round"/>',
  smartwatch:
    '<rect x="134" y="10" width="52" height="44" rx="10" fill="#f3d3b3"/>' +
    '<rect x="134" y="158" width="52" height="44" rx="10" fill="#f3d3b3"/>' +
    '<rect x="108" y="48" width="104" height="116" rx="30" fill="#fff" stroke="#e3b184" stroke-width="3"/>' +
    '<rect x="120" y="60" width="80" height="92" rx="20" fill="#f3d3b3"/>',
}

const shapeKey = (category = '') =>
  /laptop|notebook/i.test(category) ? 'laptop' : /watch|band|wear/i.test(category) ? 'smartwatch' : 'phone'

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function makePlaceholder(brand = '', category = '') {
  const key = shapeKey(category)
  const label = escapeXml((brand || key).toUpperCase().slice(0, 18))
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 260">' +
    '<rect width="320" height="260" fill="#ffffff"/>' +
    SHAPES[key] +
    `<text x="160" y="242" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" letter-spacing="1.5" fill="#b07c52">${label}</text>` +
    '</svg>'
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function getProductImage(brand = '', title = '', category = '', rawUrl = '') {
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.startsWith('http') && !rawUrl.includes('phonedb.net')) {
    return rawUrl
  }
  return makePlaceholder(brand, (category || '').toLowerCase())
}

function ProductImg({ src, brand, category, alt = '', loading }) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={(e) => {
        const el = e.currentTarget
        if (el.dataset.fb) return
        el.dataset.fb = '1'
        el.src = makePlaceholder(brand, category)
      }}
    />
  )
}

function Thumb({ item }) {
  return (
    <span className="thumb">
      <ProductImg src={item.image} brand={item.brand} category={item.category} />
    </span>
  )
}

function Price({ p }) {
  return (
    <span className="price-wrap">
      <span className="price">{money(p.price)}</span>
      {p.estimated && p.price > 0 && (
        <span className="chip chip-est" title="This price is an estimate">est.</span>
      )}
    </span>
  )
}

/* ---------- Tiny markdown renderer (escapes first, so it is safe for innerHTML) ---------- */

function renderMarkdown(text) {
  if (!text) return ''
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
  const out = []
  let list = null
  const close = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const raw of String(text).split('\n')) {
    const line = raw.trimEnd()
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol'
      if (list !== type) {
        close()
        out.push(`<${type}>`)
        list = type
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`)
      continue
    }
    close()
    if (!line.trim()) continue
    const h = line.match(/^#{1,3}\s+(.*)$/)
    out.push(h ? `<h4 class="md-h">${inline(h[1])}</h4>` : `<p>${inline(line)}</p>`)
  }
  close()
  return out.join('')
}

/* ---------- Voice input ---------- */

const SpeechRec =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

function useVoice(onText) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const cb = useRef(onText)
  cb.current = onText

  const toggle = () => {
    if (!SpeechRec) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SpeechRec()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => cb.current(e.results[0][0].transcript)
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }
  return { supported: !!SpeechRec, listening, toggle }
}

/* ---------- Shared UI ---------- */

function Logo() {
  return (
    <div className="logo">
      <img
        className="logo-img"
        src="/logo.png"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      <span>ConvoShop</span>
    </div>
  )
}

function Overlay({ onClose, variant = 'center', size, label, children }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

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

  return (
    <div
      className={`overlay overlay-${variant}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`sheet sheet-${variant} ${size ? `sheet-${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  )
}

function SheetHead({ title, subtitle, icon, onClose }) {
  return (
    <header className="sheet-head">
      <div className="sheet-title">
        {icon && <span className="soft-icon"><Icon name={icon} size={18} /></span>}
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
    </header>
  )
}

function Composer({ value, onChange, onSubmit, placeholder, voice, disabled, large, autoFocus }) {
  return (
    <form
      className={`composer ${large ? 'composer-lg' : ''}`}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={voice?.listening ? 'Listening…' : placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
      />
      {voice?.supported && (
        <button
          type="button"
          className={`icon-btn ${voice.listening ? 'is-listening' : ''}`}
          onClick={voice.toggle}
          aria-label={voice.listening ? 'Stop listening' : 'Voice input'}
        >
          <Icon name="mic" />
        </button>
      )}
      <button type="submit" className="send-btn" disabled={disabled || !value.trim()} aria-label="Send">
        <Icon name="arrowUp" size={18} />
      </button>
    </form>
  )
}

function EmptyState({ icon = 'search', title, text, children }) {
  return (
    <div className="empty">
      <span className="soft-icon soft-icon-lg"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  )
}

function ProductRow({ item, onOpen, children }) {
  return (
    <div
      className="row"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(item)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(item)
        }
      }}
    >
      <Thumb item={item} />
      <div className="row-main">
        <p className="row-title">{item.title}</p>
        <p className="row-sub">
          {item.brand}
          {item.brand && item.category ? ' · ' : ''}
          {item.category}
        </p>
        <Price p={item} />
      </div>
      {children && (
        <div className="row-end" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  )
}

function ProductCard({ p, wished, onOpen, onWish, onAdd }) {
  return (
    <article
      className="card"
      tabIndex={0}
      onClick={() => onOpen(p)}
      onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && onOpen(p)}
    >
      <div className="card-media">
        <button
          className={`wish ${wished ? 'on' : ''}`}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          onClick={(e) => {
            e.stopPropagation()
            onWish(p)
          }}
        >
          <Icon name="heart" size={18} fill={wished} />
        </button>
        <ProductImg src={p.image} brand={p.brand} category={p.category} alt={p.title} loading="lazy" />
      </div>
      <div className="card-body">
        <p className="eyebrow">
          {p.brand}
          {p.brand && p.category ? ' · ' : ''}
          {p.category}
        </p>
        <h4 className="card-title">{p.title}</h4>
        <div className="card-foot">
          <Price p={p} />
          <button
            className="btn btn-soft btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              onAdd(p)
            }}
          >
            Add
          </button>
        </div>
      </div>
    </article>
  )
}

function Toast({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action.run()
            onDismiss()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

/* ---------- Auth ---------- */

const SESSION_KEY = 'convoshop_session'
const USERS_KEY = 'convoshop_users'
const DARK_KEY = 'convoshop_dark'

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

const readDark = () => {
  try {
    const v = localStorage.getItem(DARK_KEY)
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {}
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

function Login({ onLogin }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [msg, setMsg] = useState(null)

  const switchMode = (m) => {
    setMode(m)
    setMsg(null)
  }

  const submit = (e) => {
    e.preventDefault()
    const users = read(USERS_KEY, [])
    const mail = email.trim().toLowerCase()
    const existing = users.find((u) => u.email === mail)

    if (mode === 'signup') {
      if (existing) {
        setMsg({ type: 'error', text: 'An account with this email already exists. Please sign in.' })
        return
      }
      const newUser = { name: name.trim() || mail.split('@')[0], email: mail, password }
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]))
      setMsg({ type: 'success', text: 'Account created. Signing you in…' })
      setTimeout(() => onLogin(newUser, remember), 600)
      return
    }

    if (!existing) {
      setMsg({ type: 'error', text: 'No account found with this email. Please create one.' })
      return
    }
    if (existing.password !== password) {
      setMsg({ type: 'error', text: 'Incorrect password. Please try again.' })
      return
    }
    setMsg({ type: 'success', text: 'Welcome back. Opening your store…' })
    setTimeout(() => onLogin(existing, remember), 600)
  }

  return (
    <div className="auth-viewport">
      <div className="auth-card">
        <Logo />
        <h1>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted auth-sub">
          {mode === 'signin' ? 'Sign in to continue shopping.' : 'Join ConvoShop to start shopping.'}
        </p>

        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="stack">
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                className="input"
                type="text"
                autoComplete="name"
                placeholder="Alex Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="auth-pw">Password</label>
            <div className="input-wrap">
              <input
                id="auth-pw"
                className="input"
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button type="button" className="link-btn input-action" onClick={() => setShowPw(!showPw)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {mode === 'signin' && (
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember this device</span>
            </label>
          )}

          {msg && (
            <div className={`notice notice-${msg.type}`} role={msg.type === 'error' ? 'alert' : 'status'}>
              {msg.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ---------- AI advisor (chat) ---------- */

const WELCOME = {
  sender: 'ai',
  text: "Hi, I'm ConvoShop. Tell me what you're looking for — budget, battery, camera, anything — and I'll recommend from the catalog.",
  matches: [],
}

function normalizeMatch(item, byId) {
  const id = item.id || item.product_id
  const full = byId.get(id)
  return {
    ...item,
    id,
    category: (item.category || '').toLowerCase(),
    estimated: full?.estimated ?? false,
    image: getProductImage(item.brand, item.title, item.category, item.image),
  }
}

function AIDrawer({ isOpen, onClose, allProducts, onSelectProduct, onAddToCart, seed }) {
  const [msgs, setMsgs] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEnd = useRef(null)
  const lastQuery = useRef('')
  const lastSeed = useRef(0)
  const byId = useMemo(() => new Map(allProducts.map((p) => [p.id, p])), [allProducts])

  useEffect(() => {
    if (isOpen) chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, loading, isOpen])

  const send = async (q) => {
    const text = (q ?? input).trim()
    if (!text || loading) return

    // Follow-ups like "show cheaper ones" carry the last category the user mentioned.
    const mentionsCategory = /phone|mobile|laptop|notebook|watch/i.test(text)
    const searchText = !mentionsCategory && lastQuery.current ? `${lastQuery.current}. ${text}` : text
    if (mentionsCategory) lastQuery.current = text

    setMsgs((m) => [...m, { sender: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND_URL}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: searchText }),
      })
      if (!res.ok) throw new Error(`Backend HTTP ${res.status}`)
      const data = await res.json()
      setMsgs((m) => [
        ...m,
        {
          sender: 'ai',
          text: data.response || 'I could not generate an answer for that.',
          matches: (data.matches || []).map((x) => normalizeMatch(x, byId)),
          open: false,
        },
      ])
    } catch (err) {
      console.error('Backend RAG API error:', err)
      const matches = matchProducts(allProducts, text, { any: true }).slice(0, 3)
      setMsgs((m) => [
        ...m,
        {
          sender: 'ai',
          offline: true,
          text: matches.length
            ? `I can't reach the AI advisor right now, so these are plain catalog matches for “${text}”.`
            : `I can't reach the AI advisor right now, and I found no catalog matches for “${text}”. Try again in a moment.`,
          matches,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const voice = useVoice((t) => send(t))

  useEffect(() => {
    if (seed && seed.n !== lastSeed.current) {
      lastSeed.current = seed.n
      send(seed.text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const toggleSources = (i) =>
    setMsgs((all) => all.map((m, idx) => (idx === i ? { ...m, open: !m.open } : m)))

  if (!isOpen) return null

  const last = msgs[msgs.length - 1]
  const showFollowUps = !loading && last.sender === 'ai' && last.matches?.length > 0 && !last.offline

  return (
    <Overlay onClose={onClose} variant="drawer" label="AI advisor">
      <SheetHead title="ConvoShop AI" subtitle="Answers grounded in the catalog" icon="spark" onClose={onClose} />

      <div className="chat">
        {msgs.map((m, i) => (
          <div key={i} className={`msg msg-${m.sender}`}>
            <div className="bubble">
              <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
            </div>

            {m.matches?.length > 0 && (
              <div className="msg-cards">
                {m.matches.map((item) => (
                  <ProductRow
                    key={item.id}
                    item={item}
                    onOpen={(it) => {
                      onSelectProduct(byId.get(it.id) || it)
                      onClose()
                    }}
                  >
                    <button className="btn btn-soft btn-sm" onClick={() => onAddToCart(byId.get(item.id) || item)}>
                      Add
                    </button>
                  </ProductRow>
                ))}
              </div>
            )}

            {m.sender === 'ai' && m.matches?.length > 0 && !m.offline && (
              <div className="sources">
                <button className="link-btn" onClick={() => toggleSources(i)} aria-expanded={!!m.open}>
                  Sources ({m.matches.length}) <Icon name={m.open ? 'up' : 'down'} size={14} />
                </button>
                {m.open && (
                  <div className="sources-panel">
                    <p className="muted">Retrieved from the verified catalog with hybrid vector search.</p>
                    <ul>
                      {m.matches.map((x) => (
                        <li key={x.id}>
                          <span>{x.title}</span>
                          <code>{x.id}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="msg msg-ai">
            <div className="bubble typing" aria-label="ConvoShop is thinking">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      <footer className="sheet-foot">
        {msgs.length === 1 && !loading && (
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip-btn" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {showFollowUps && (
          <div className="chips">
            {FOLLOW_UPS.map((s) => (
              <button key={s} className="chip-btn" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => send()}
          placeholder="Ask for phones, laptops or watches…"
          voice={voice}
          disabled={loading}
          autoFocus
        />
      </footer>
    </Overlay>
  )
}

/* ---------- Product detail ---------- */

function ProductDetail({ product, onClose, onAddToCart, wished, onToggleWish }) {
  const [zoom, setZoom] = useState(false)
  const [copied, setCopied] = useState(false)

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Overlay onClose={onClose} variant="center" label={product.title}>
      <button className="icon-btn modal-x" onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
      <div className="detail">
        <button
          className={`detail-media ${zoom ? 'zoomed' : ''}`}
          onClick={() => setZoom(!zoom)}
          aria-label={zoom ? 'Zoom out' : 'Zoom in'}
        >
          <ProductImg src={product.image} brand={product.brand} category={product.category} alt={product.title} />
          <span className="media-hint">
            <Icon name="search" size={14} /> {zoom ? 'Zoom out' : 'Zoom in'}
          </span>
        </button>

        <div className="detail-info">
          <div className="detail-top">
            <p className="eyebrow">
              {product.brand}
              {product.brand && product.category ? ' · ' : ''}
              {product.category}
            </p>
            <div className="detail-actions">
              <button className="icon-btn" onClick={share} aria-label="Copy link">
                <Icon name={copied ? 'check' : 'share'} size={18} />
              </button>
              <button
                className={`icon-btn ${wished ? 'is-on' : ''}`}
                onClick={() => onToggleWish(product)}
                aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                aria-pressed={wished}
              >
                <Icon name="heart" size={18} fill={wished} />
              </button>
            </div>
          </div>

          <h2>{product.title}</h2>
          <div className="detail-price">
            <Price p={product} />
          </div>
          {product.estimated && product.price > 0 && (
            <p className="muted small">Estimated price — not a live listing price.</p>
          )}

          {product.description && (
            <div className="panel">
              <h5>About this product</h5>
              <p>{product.description}</p>
            </div>
          )}

          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={() => {
              onAddToCart(product)
              onClose()
            }}
          >
            Add to cart
          </button>
        </div>
      </div>
    </Overlay>
  )
}

/* ---------- Wishlist / Cart ---------- */

function WishlistDrawer({ isOpen, onClose, wishlist, onRemove, onMoveToCart, onOpen }) {
  if (!isOpen) return null
  return (
    <Overlay onClose={onClose} variant="drawer" label="Wishlist">
      <SheetHead title={`Wishlist (${wishlist.length})`} onClose={onClose} />
      <div className="sheet-body">
        {wishlist.length === 0 ? (
          <EmptyState icon="heart" title="Nothing saved yet" text="Tap the heart on any product to save it here.">
            <button className="btn btn-soft" onClick={onClose}>Browse products</button>
          </EmptyState>
        ) : (
          <div className="stack">
            {wishlist.map((item) => (
              <ProductRow key={item.id} item={item} onOpen={(it) => { onOpen(it); onClose() }}>
                <div className="row-actions">
                  <button className="btn btn-soft btn-sm" onClick={() => onMoveToCart(item)}>Move to cart</button>
                  <button className="link-btn" onClick={() => onRemove(item.id)}>Remove</button>
                </div>
              </ProductRow>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  )
}

function CartDrawer({ isOpen, onClose, cart, count, total, onQty, onRemove, onCheckout, onOpen }) {
  if (!isOpen) return null
  const hasEst = cart.some((i) => i.estimated)
  return (
    <Overlay onClose={onClose} variant="drawer" label="Cart">
      <SheetHead title={`Cart (${count})`} onClose={onClose} />
      <div className="sheet-body">
        {cart.length === 0 ? (
          <EmptyState icon="bag" title="Your cart is empty" text="Add something you like and it will show up here.">
            <button className="btn btn-soft" onClick={onClose}>Continue shopping</button>
          </EmptyState>
        ) : (
          <div className="stack">
            {cart.map((item) => (
              <ProductRow key={item.id} item={item} onOpen={(it) => { onOpen(it); onClose() }}>
                <div className="row-actions">
                  <div className="stepper">
                    <button onClick={() => onQty(item.id, -1)} aria-label="Decrease quantity">
                      <Icon name="minus" size={14} />
                    </button>
                    <span>{item.qty}</span>
                    <button onClick={() => onQty(item.id, 1)} aria-label="Increase quantity">
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <button className="link-btn" onClick={() => onRemove(item.id)}>Remove</button>
                </div>
              </ProductRow>
            ))}
          </div>
        )}
      </div>
      {cart.length > 0 && (
        <footer className="sheet-foot">
          <div className="total-row">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          {hasEst && <p className="muted small">Includes estimated prices.</p>}
          <button className="btn btn-primary btn-block btn-lg" onClick={onCheckout}>
            Check out
          </button>
        </footer>
      )}
    </Overlay>
  )
}

/* ---------- Checkout / success / settings ---------- */

function CheckoutModal({ cartItems, totalAmount, onClose, onSuccess }) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    paymentMethod: 'cod',
    coupon: '',
  })
  const [discount, setDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    if (name === 'coupon') {
      setDiscount(0)
      setCouponMsg(null)
    }
  }

  const applyCoupon = () => {
    if (form.coupon.trim().toUpperCase() === 'CONVO20') {
      setDiscount(0.2)
      setCouponMsg({ type: 'success', text: '20% discount applied.' })
    } else {
      setDiscount(0)
      setCouponMsg({ type: 'error', text: 'That code isn’t valid. Try CONVO20.' })
    }
  }

  const finalPayable = totalAmount * (1 - discount)

  return (
    <Overlay onClose={onClose} variant="center" size="narrow" label="Checkout">
      <SheetHead title="Delivery & payment" icon="truck" onClose={onClose} />
      <form
        className="sheet-body stack"
        onSubmit={(e) => {
          e.preventDefault()
          onSuccess({ ...form, finalTotal: finalPayable })
        }}
      >
        <div className="field">
          <label htmlFor="co-name">Full name</label>
          <input id="co-name" className="input" name="fullName" autoComplete="name" placeholder="Rahul Sharma" value={form.fullName} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="co-phone">Phone number</label>
          <input id="co-phone" className="input" type="tel" inputMode="tel" name="phone" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="co-addr">Address</label>
          <input id="co-addr" className="input" name="address" autoComplete="street-address" placeholder="#42, Tech Park Road" value={form.address} onChange={handleChange} required />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="co-city">City</label>
            <input id="co-city" className="input" name="city" autoComplete="address-level2" placeholder="Bengaluru" value={form.city} onChange={handleChange} required />
          </div>
          <div className="field">
            <label htmlFor="co-pin">Pincode</label>
            <input id="co-pin" className="input" name="pincode" inputMode="numeric" pattern="\d{6}" title="6-digit pincode" autoComplete="postal-code" placeholder="560001" value={form.pincode} onChange={handleChange} required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="co-coupon">Coupon code</label>
          <div className="inline">
            <input id="co-coupon" className="input" name="coupon" placeholder="CONVO20" value={form.coupon} onChange={handleChange} />
            <button type="button" className="btn btn-soft" onClick={applyCoupon}>Apply</button>
          </div>
          {couponMsg && <small className={`coupon-msg ${couponMsg.type}`}>{couponMsg.text}</small>}
        </div>

        <div className="field">
          <label htmlFor="co-pay">Payment method</label>
          <select id="co-pay" className="input" name="paymentMethod" value={form.paymentMethod} onChange={handleChange}>
            <option value="cod">Cash on delivery</option>
            <option value="upi">UPI / Google Pay / PhonePe</option>
            <option value="card">Credit / debit card</option>
          </select>
        </div>

        <div className="summary">
          <div><span>{cartItems.reduce((n, i) => n + i.qty, 0)} items</span><span>{money(totalAmount)}</span></div>
          {discount > 0 && <div><span>Discount (20%)</span><span>− {money(totalAmount * discount)}</span></div>}
          <div className="summary-total"><span>Total</span><strong>{money(finalPayable)}</strong></div>
        </div>

        <button type="submit" className="btn btn-primary btn-block btn-lg">Place order</button>
      </form>
    </Overlay>
  )
}

function OrderSuccessModal({ orderData, onClose }) {
  return (
    <Overlay onClose={onClose} variant="center" size="xs" label="Order confirmed">
      <div className="success">
        <span className="success-badge"><Icon name="check" size={32} /></span>
        <h2>Order placed</h2>
        <p className="muted">Thank you, {orderData.shipping.fullName}. Your order is confirmed.</p>

        <dl className="meta">
          <div><dt>Order ID</dt><dd>{orderData.id}</dd></div>
          <div>
            <dt>Delivering to</dt>
            <dd>{orderData.shipping.address}, {orderData.shipping.city} – {orderData.shipping.pincode}</dd>
          </div>
          <div><dt>Payment</dt><dd style={{ textTransform: 'uppercase' }}>{orderData.shipping.paymentMethod}</dd></div>
          <div><dt>Total</dt><dd>{money(orderData.total)}</dd></div>
        </dl>

        <button className="btn btn-primary btn-block btn-lg" onClick={onClose}>Continue shopping</button>
      </div>
    </Overlay>
  )
}

function SettingsModal({ user, onClose, onUpdateUser, orders, onLogout, darkMode, setDarkMode }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [saved, setSaved] = useState(false)

  const save = (e) => {
    e.preventDefault()
    onUpdateUser({ name, email })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Overlay onClose={onClose} variant="center" size="narrow" label="Settings">
      <SheetHead title="Settings" onClose={onClose} />
      <div className="sheet-body stack-lg">
        <form onSubmit={save} className="stack">
          <h5 className="section-label">Profile</h5>
          <div className="field">
            <label htmlFor="st-name">Full name</label>
            <input id="st-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="st-email">Email</label>
            <input id="st-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {saved && <div className="notice notice-success" role="status">Profile updated.</div>}
          <button type="submit" className="btn btn-soft btn-block">Save changes</button>
        </form>

        <div className="stack">
          <h5 className="section-label">Appearance</h5>
          <div className="setting-row">
            <span>Dark mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              aria-label="Dark mode"
              className={`switch ${darkMode ? 'on' : ''}`}
              onClick={() => setDarkMode(!darkMode)}
            >
              <i />
            </button>
          </div>
        </div>

        <div className="stack">
          <h5 className="section-label">Orders</h5>
          {orders.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <ul className="orders">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.id}</strong>
                    <span className="muted small">{o.date}</span>
                  </div>
                  <span>{money(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button className="btn btn-danger btn-block" onClick={onLogout}>Sign out</button>
      </div>
    </Overlay>
  )
}

/* ---------- Store ---------- */

function HeaderSearch({ value, onChange, onSubmit, onClear }) {
  const voice = useVoice((t) => onSubmit(t))
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value)
      }}
    >
      <Icon name="search" size={18} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={voice.listening ? 'Listening…' : 'Search, or ask: best phone under 30k'}
        aria-label="Search products"
      />
      {value && (
        <button type="button" className="icon-btn icon-btn-sm" onClick={onClear} aria-label="Clear search">
          <Icon name="close" size={16} />
        </button>
      )}
      {voice.supported && (
        <button
          type="button"
          className={`icon-btn icon-btn-sm ${voice.listening ? 'is-listening' : ''}`}
          onClick={voice.toggle}
          aria-label="Voice search"
        >
          <Icon name="mic" size={18} />
        </button>
      )}
    </form>
  )
}

function Hero({ onAsk }) {
  const [text, setText] = useState('')
  const submit = (t) => {
    const v = (t ?? text).trim()
    if (!v) return
    onAsk(v)
    setText('')
  }
  const voice = useVoice((t) => submit(t))

  return (
    <section className="hero">
      <div className="hero-inner">
        <p className="eyebrow eyebrow-accent">ConvoShop AI</p>
        <h1>Tell us what you need.<br />We’ll find what fits.</h1>
        <p className="lead">
          Ask in plain words — budget, battery, camera — and get recommendations grounded in the catalog’s real specs.
        </p>
        <Composer
          large
          value={text}
          onChange={setText}
          onSubmit={() => submit()}
          placeholder="e.g. A phone under ₹30,000 with great battery life"
          voice={voice}
        />
        <div className="chips chips-center">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip-btn" onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Recommendation({ rec, onClose, onOpen }) {
  return (
    <section className="reco" aria-live="polite">
      <header className="reco-head">
        <div className="sheet-title">
          <span className="soft-icon"><Icon name="spark" size={18} /></span>
          <div>
            <h3>{rec.offline ? 'AI advisor unavailable' : 'Recommended for you'}</h3>
            <p className="muted">“{rec.query}”</p>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
          <Icon name="close" />
        </button>
      </header>

      {rec.offline ? (
        <p className="reco-text">
          I couldn’t reach the AI advisor, so the products below are plain catalog matches instead.
        </p>
      ) : (
        <div className="reco-text md" dangerouslySetInnerHTML={{ __html: renderMarkdown(rec.response) }} />
      )}

      {rec.matches.length > 0 && (
        <div className="reco-matches">
          <p className="eyebrow">Retrieved from the catalog · {rec.matches.length}</p>
          <div className="match-grid">
            {rec.matches.map((item) => (
              <ProductRow key={item.id} item={item} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Store({ user, onLogout, onUpdateUser, darkMode, setDarkMode }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [topRatedOnly, setTopRatedOnly] = useState(false)
  const [sort, setSort] = useState('featured')
  const [shown, setShown] = useState(BATCH)
  const [cart, setCart] = useState(() => read(`convo_cart_${user.email}`, []))
  const [wishlist, setWishlist] = useState(() => read(`convo_wishlist_${user.email}`, []))
  const [orders, setOrders] = useState(() => read(`convo_orders_${user.email}`, []))
  const [cartOpen, setCartOpen] = useState(false)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSeed, setAiSeed] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderPlacedData, setOrderPlacedData] = useState(null)
  const [aiRecommendation, setAiRecommendation] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const endRef = useRef(null)

  const showToast = (text, action) => {
    clearTimeout(toastTimer.current)
    setToast({ text, action })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const products = result.data.map((row, i) => {
          const priceVal = toNumber(row.price_inr)
          const cat = (row.category || 'Uncategorized').toLowerCase()
          // Price is an estimate if the CSV says so (price_estimated / is_estimated column);
          // otherwise laptops are treated as estimated (their INR prices are converted from EUR).
          const flag = String(row.price_estimated ?? row.is_estimated ?? '').trim().toLowerCase()
          const estimated = flag ? ['1', 'true', 'yes', 'y'].includes(flag) : /laptop/.test(cat)
          return {
            id: row.product_id || `prod_${i}`,
            product_id: row.product_id || `prod_${i}`,
            title: row.name || 'Untitled product',
            brand: row.brand || '',
            category: cat,
            price: priceVal,
            original: priceVal,
            estimated,
            rating: toNumber(row.rating),
            image: getProductImage(row.brand, row.name, row.category, row.image_url),
            description: row.description || '',
          }
        })
        setRows(products)
        setStatus(products.length ? 'ready' : 'empty')
      },
      error: () => setStatus('error'),
    })
  }, [])

  const byId = useMemo(() => new Map(rows.map((p) => [p.id, p])), [rows])
  const openProduct = (p) => setSelectedProduct(byId.get(p.id) || p)

  const openAdvisor = (text) => {
    if (text) setAiSeed({ text, n: Date.now() })
    setAiOpen(true)
  }

  const handleRAGSearch = async (textToSearch) => {
    const text = (textToSearch || searchQuery).trim()
    if (!text) return
    setSearchQuery(text)
    setAiLoading(true)
    setAiRecommendation(null)

    try {
      const res = await fetch(`${BACKEND_URL}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAiRecommendation({
        query: text,
        response: data.response || '',
        matches: (data.matches || []).map((m) => normalizeMatch(m, byId)),
      })
    } catch (err) {
      console.error('RAG Search Error:', err)
      setAiRecommendation({ query: text, response: '', matches: [], offline: true })
    } finally {
      setAiLoading(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setAiRecommendation(null)
  }

  const categories = useMemo(() => {
    const counts = new Map()
    rows.forEach((r) => counts.set(r.category, (counts.get(r.category) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const hasRatings = useMemo(() => rows.some((r) => r.rating != null), [rows])

  const filtered = useMemo(() => {
    // When the AI returned matches, show exactly those in the grid.
    if (aiRecommendation?.matches?.length) {
      const ids = new Set(aiRecommendation.matches.map((m) => m.id))
      const matched = rows.filter((r) => ids.has(r.id))
      if (matched.length) return matched
    }
    return matchProducts(rows, searchQuery.trim(), { category }).filter(
      (r) => !topRatedOnly || (r.rating != null && r.rating >= 4.0)
    )
  }, [rows, category, topRatedOnly, searchQuery, aiRecommendation])

  const sorted = useMemo(() => {
    if (sort === 'featured') return filtered
    const list = [...filtered]
    if (sort === 'low') {
      const key = (p) => (p.price > 0 ? p.price : Infinity)
      return list.sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1))
    }
    return list.sort((a, b) => (b.price || 0) - (a.price || 0))
  }, [filtered, sort])

  useEffect(() => {
    setShown(BATCH)
  }, [category, topRatedOnly, searchQuery, aiRecommendation, sort])

  useEffect(() => {
    const el = endRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setShown((s) => s + BATCH),
      { rootMargin: '600px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [status, sorted.length])

  useEffect(() => {
    localStorage.setItem(`convo_cart_${user.email}`, JSON.stringify(cart))
  }, [cart, user.email])
  useEffect(() => {
    localStorage.setItem(`convo_wishlist_${user.email}`, JSON.stringify(wishlist))
  }, [wishlist, user.email])
  useEffect(() => {
    localStorage.setItem(`convo_orders_${user.email}`, JSON.stringify(orders))
  }, [orders, user.email])

  const addToCart = (p) => {
    setCart((c) =>
      c.some((i) => i.id === p.id)
        ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [
            ...c,
            {
              id: p.id,
              title: p.title,
              brand: p.brand,
              category: p.category,
              image: p.image,
              price: p.price,
              estimated: p.estimated,
              qty: 1,
            },
          ]
    )
    showToast('Added to cart', { label: 'View cart', run: () => setCartOpen(true) })
  }

  const toggleWishlist = (p) =>
    setWishlist((w) => (w.some((i) => i.id === p.id) ? w.filter((i) => i.id !== p.id) : [...w, p]))

  const removeWishlistItem = (id) => setWishlist((w) => w.filter((i) => i.id !== id))

  const moveToCart = (item) => {
    addToCart(item)
    removeWishlistItem(item.id)
  }

  const changeQty = (id, delta) =>
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0))

  const removeItem = (id) => setCart((c) => c.filter((i) => i.id !== id))

  const count = cart.reduce((n, i) => n + i.qty, 0)
  const total = cart.reduce((n, i) => n + (i.price ?? 0) * i.qty, 0)

  const handleFinalizeOrder = (checkoutData) => {
    const newOrder = {
      id: 'CS-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      items: [...cart],
      total: checkoutData.finalTotal,
      shipping: checkoutData,
    }
    setOrders((o) => [newOrder, ...o])
    setCart([])
    setCartOpen(false)
    setCheckoutOpen(false)
    setOrderPlacedData(newOrder)
  }

  const query = searchQuery.trim()
  const heading = aiRecommendation
    ? `Results for “${aiRecommendation.query}”`
    : query
      ? `Results for “${query}”`
      : 'All products'

  return (
    <div className="store">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="area-logo"><Logo /></div>

          <div className="area-search">
            <HeaderSearch
              value={searchQuery}
              onChange={(v) => {
                setSearchQuery(v)
                if (aiRecommendation) setAiRecommendation(null)
              }}
              onSubmit={handleRAGSearch}
              onClear={clearSearch}
            />
          </div>

          <nav className="area-actions" aria-label="Main">
            <button className="btn btn-soft btn-sm ai-chip" onClick={() => openAdvisor()}>
              <Icon name="spark" size={16} /> <span>Ask AI</span>
            </button>
            <button className="icon-btn" onClick={() => setWishlistOpen(true)} aria-label={`Wishlist, ${wishlist.length} items`}>
              <Icon name="heart" />
              {wishlist.length > 0 && <span className="badge">{wishlist.length}</span>}
            </button>
            <button className="icon-btn" onClick={() => setCartOpen(true)} aria-label={`Cart, ${count} items`}>
              <Icon name="bag" />
              {count > 0 && <span className="badge">{count}</span>}
            </button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Account and settings">
              <Icon name="user" />
            </button>
          </nav>
        </div>
      </header>

      <Hero onAsk={openAdvisor} />

      {categories.length > 0 && (
        <nav className="cats" aria-label="Categories">
          <div className="cats-track">
            <button className={`pill ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>
              All <small>{rows.length}</small>
            </button>
            {categories.map(([name, n]) => (
              <button
                key={name}
                className={`pill ${category === name ? 'active' : ''}`}
                onClick={() => setCategory(name)}
              >
                <span className="cap">{name}</span> <small>{n}</small>
              </button>
            ))}
          </div>
          {hasRatings && (
            <button
              className={`pill ${topRatedOnly ? 'active' : ''}`}
              onClick={() => setTopRatedOnly(!topRatedOnly)}
              aria-pressed={topRatedOnly}
            >
              <Icon name="star" size={14} fill={topRatedOnly} /> Top rated
            </button>
          )}
        </nav>
      )}

      <main className="main" id="products">
        {aiLoading && (
          <section className="reco" aria-busy="true">
            <div className="skeleton sk-line sk-w40" />
            <div className="skeleton sk-line" />
            <div className="skeleton sk-line sk-w70" />
          </section>
        )}

        {aiRecommendation && !aiLoading && (
          <Recommendation rec={aiRecommendation} onClose={() => setAiRecommendation(null)} onOpen={openProduct} />
        )}

        <div className="catalog-head">
          <div>
            <h2>{heading}</h2>
            {status === 'ready' && <p className="muted">{sorted.length} {sorted.length === 1 ? 'item' : 'items'}</p>}
          </div>
          <div className="catalog-tools">
            {(query || aiRecommendation) && (
              <button className="btn btn-ghost btn-sm" onClick={clearSearch}>Clear search</button>
            )}
            <select
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </div>
        </div>

        {status === 'loading' && (
          <div className="grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card" aria-hidden="true">
                <div className="card-media skeleton" />
                <div className="card-body">
                  <div className="skeleton sk-line sk-w40" />
                  <div className="skeleton sk-line" />
                  <div className="skeleton sk-line sk-w70" />
                </div>
              </div>
            ))}
          </div>
        )}

        {(status === 'error' || status === 'empty') && (
          <EmptyState
            icon="search"
            title={status === 'error' ? 'We couldn’t load the catalog' : 'The catalog is empty'}
            text={status === 'error' ? 'Check your connection and try again.' : 'No products were found in the data file.'}
          >
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
          </EmptyState>
        )}

        {status === 'ready' && sorted.length === 0 && (
          <EmptyState
            title="No matches"
            text={query ? `Nothing in the catalog matches “${query}”. Try fewer words, or ask the AI advisor.` : 'No products match these filters.'}
          >
            <div className="chips chips-center">
              <button className="btn btn-primary" onClick={() => openAdvisor(query || undefined)}>
                <Icon name="spark" size={16} /> Ask the AI advisor
              </button>
              <button
                className="btn btn-soft"
                onClick={() => {
                  clearSearch()
                  setCategory('all')
                  setTopRatedOnly(false)
                }}
              >
                Clear filters
              </button>
            </div>
          </EmptyState>
        )}

        {status === 'ready' && sorted.length > 0 && (
          <div className="grid">
            {sorted.slice(0, shown).map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                wished={wishlist.some((i) => i.id === p.id)}
                onOpen={openProduct}
                onWish={toggleWishlist}
                onAdd={addToCart}
              />
            ))}
          </div>
        )}

        <div ref={endRef} className="end-sentinel">
          {status === 'ready' && sorted.length > 0 && (shown < sorted.length ? 'Loading more…' : 'You’ve reached the end.')}
        </div>
      </main>

      <button className="fab" onClick={() => openAdvisor()}>
        <Icon name="spark" size={18} /> Ask AI
      </button>

      <AIDrawer
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        allProducts={rows}
        onSelectProduct={openProduct}
        onAddToCart={addToCart}
        seed={aiSeed}
      />

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
          wished={wishlist.some((i) => i.id === selectedProduct.id)}
          onToggleWish={toggleWishlist}
        />
      )}

      <WishlistDrawer
        isOpen={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        wishlist={wishlist}
        onRemove={removeWishlistItem}
        onMoveToCart={moveToCart}
        onOpen={openProduct}
      />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        count={count}
        total={total}
        onQty={changeQty}
        onRemove={removeItem}
        onCheckout={() => {
          setCartOpen(false)
          setCheckoutOpen(true)
        }}
        onOpen={openProduct}
      />

      {checkoutOpen && (
        <CheckoutModal
          cartItems={cart}
          totalAmount={total}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleFinalizeOrder}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          user={user}
          orders={orders}
          onClose={() => setSettingsOpen(false)}
          onUpdateUser={onUpdateUser}
          onLogout={onLogout}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      )}

      {orderPlacedData && <OrderSuccessModal orderData={orderPlacedData} onClose={() => setOrderPlacedData(null)} />}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(readSession)
  const [darkMode, setDarkModeState] = useState(readDark)

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', darkMode)
  }, [darkMode])

  const setDarkMode = (v) => {
    setDarkModeState(v)
    try {
      localStorage.setItem(DARK_KEY, String(v))
    } catch {}
  }

  const login = (u, remember) => {
    const sessionData = { name: u.name, email: u.email }
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(sessionData))
    setUser(sessionData)
  }

  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  const updateUser = (updated) => {
    const newSession = { ...user, ...updated }
    setUser(newSession)
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession))
  }

  return user ? (
    <Store user={user} onLogout={logout} onUpdateUser={updateUser} darkMode={darkMode} setDarkMode={setDarkMode} />
  ) : (
    <Login onLogin={login} />
  )
}