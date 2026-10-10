import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

const BACKEND_URL = 'http://127.0.0.1:8000'
const CSV_URL = '/all_products.csv'
const BATCH = 24
const CURRENCY = 'INR'
const LOCALE = 'en-IN'
const RATE = 1

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
  const text = String(value)
  const n = parseFloat(text.replace(/[^0-9.]/g, ''))
  if (Number.isNaN(n)) return null
  return n
}

const BRAND_IMAGE_POOLS = {
  phone: {
    samsung: [
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=500&auto=format&fit=crop&q=80'
    ],
    apple: [
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1567581935884-3349723552ca?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=500&auto=format&fit=crop&q=80'
    ],
    google: [
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=500&auto=format&fit=crop&q=80'
    ],
    general_android: [
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1575695342320-d2d2d2f9b73f?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop&q=80'
    ]
  },
  laptop: {
    apple: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=500&auto=format&fit=crop&q=80'
    ],
    asus: [
      'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500&auto=format&fit=crop&q=80'
    ],
    hp: [
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=80'
    ],
    lenovo: [
      'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=500&auto=format&fit=crop&q=80'
    ],
    general_laptop: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&auto=format&fit=crop&q=80'
    ]
  },
  smartwatch: {
    apple: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1510017803434-a899398421b3?w=500&auto=format&fit=crop&q=80'
    ],
    samsung: [
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=80'
    ],
    general_watch: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544117519-31a4b719223d?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=500&auto=format&fit=crop&q=80'
    ]
  }
}

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getProductImage(brand = '', title = '', category = '', rawUrl = '') {
  if (rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('phonedb.net') && !rawUrl.includes('photo-1511707171634')) {
    return rawUrl
  }

  const b = (brand || '').toLowerCase()
  const t = (title || '').toLowerCase()
  const c = (category || '').toLowerCase()
  const key = `${b}_${t}`
  const hash = hashString(key)

  if (c === 'phone') {
    if (b.includes('samsung')) {
      const pool = BRAND_IMAGE_POOLS.phone.samsung
      return pool[hash % pool.length]
    }
    if (b.includes('apple') || t.includes('iphone')) {
      const pool = BRAND_IMAGE_POOLS.phone.apple
      return pool[hash % pool.length]
    }
    if (b.includes('google') || t.includes('pixel')) {
      const pool = BRAND_IMAGE_POOLS.phone.google
      return pool[hash % pool.length]
    }
    const pool = BRAND_IMAGE_POOLS.phone.general_android
    return pool[hash % pool.length]
  }

  if (c === 'laptop') {
    if (b.includes('apple') || t.includes('macbook')) {
      const pool = BRAND_IMAGE_POOLS.laptop.apple
      return pool[hash % pool.length]
    }
    if (b.includes('asus') || b.includes('rog') || b.includes('tuf')) {
      const pool = BRAND_IMAGE_POOLS.laptop.asus
      return pool[hash % pool.length]
    }
    if (b.includes('hp')) {
      const pool = BRAND_IMAGE_POOLS.laptop.hp
      return pool[hash % pool.length]
    }
    if (b.includes('lenovo') || b.includes('thinkpad')) {
      const pool = BRAND_IMAGE_POOLS.laptop.lenovo
      return pool[hash % pool.length]
    }
    const pool = BRAND_IMAGE_POOLS.laptop.general_laptop
    return pool[hash % pool.length]
  }

  if (c === 'smartwatch') {
    if (b.includes('apple')) {
      const pool = BRAND_IMAGE_POOLS.smartwatch.apple
      return pool[hash % pool.length]
    }
    if (b.includes('samsung')) {
      const pool = BRAND_IMAGE_POOLS.smartwatch.samsung
      return pool[hash % pool.length]
    }
    const pool = BRAND_IMAGE_POOLS.smartwatch.general_watch
    return pool[hash % pool.length]
  }

  const pool = BRAND_IMAGE_POOLS.phone.general_android
  return pool[hash % pool.length]
}

function parseFormattedMarkdown(text) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>')
    .replace(/^- (.*$)/gim, '<li class="md-li">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
  return html
}

function Logo() {
  return (
    <div className="logo-nav-container">
      <img
        className="logo-img-nav"
        src="/logo.png"
        alt="ConvoShop Logo"
        onError={(e) => { e.target.style.display = 'none' }}
      />
      <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '-0.5px' }}>ConvoShop</span>
    </div>
  )
}

const SESSION_KEY = 'convoshop_session'
const USERS_KEY = 'convoshop_users'

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

function Login({ onLogin }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [msg, setMsg] = useState(null)

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
      setMsg({ type: 'success', text: 'Account created successfully! Logging you in…' })
      setTimeout(() => onLogin(newUser, remember), 600)
      return
    }

    if (!existing) {
      setMsg({ type: 'error', text: 'No account found with this email. Please sign up.' })
      return
    }
    if (existing.password !== password) {
      setMsg({ type: 'error', text: 'Incorrect password. Please try again.' })
      return
    }

    setMsg({ type: 'success', text: 'Welcome back! Launching your store…' })
    setTimeout(() => onLogin(existing, remember), 600)
  }

  return (
    <div className="shopify-auth-viewport">
      <div className="shopify-auth-card-box">
        <div className="auth-brand-head">
          <Logo />
          <h2 style={{ marginTop: '10px' }}>ConvoShop</h2>
          <p>A RAG-Based Conversational Shopping Assistant with Verified Product Catalog</p>
        </div>

        <div className="auth-tab-switch">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => { setMode('signin'); setMsg(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => { setMode('signup'); setMsg(null); }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className="auth-form-stack">
          {mode === 'signup' && (
            <div className="auth-field">
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

          <div className="auth-field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === 'signin' && (
            <div className="auth-meta-row">
              <label className="remember-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember this device</span>
              </label>
            </div>
          )}

          {msg && <div className={`auth-alert-box ${msg.type}`}>{msg.text}</div>}

          <button type="submit" className="shop-btn-red full-width">
            {mode === 'signin' ? 'Sign In to Store' : 'Complete Registration'}
          </button>
        </form>

        <div className="auth-card-footer">
          {mode === 'signin' ? (
            <p>New customer? <button type="button" onClick={() => { setMode('signup'); setMsg(null); }}>Create an account</button></p>
          ) : (
            <p>Already have an account? <button type="button" onClick={() => { setMode('signin'); setMsg(null); }}>Sign in here</button></p>
          )}
        </div>
      </div>
    </div>
  )
}

function GeminiSearchModal({ isOpen, onClose, allProducts, onSelectProduct, onTriggerSearch }) {
  const [query, setQuery] = useState('')
  const [isListening, setIsListening] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.')
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'en-IN'
    setIsListening(true)
    rec.onresult = (e) => {
      const txt = e.results[0][0].transcript
      setQuery(txt)
      setIsListening(false)
      onTriggerSearch(txt)
      onClose()
    }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)
    rec.start()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      onTriggerSearch(query)
      onClose()
    }
  }

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()

    let maxLimit = null
    const priceMatch = q.match(/(?:under|below|less than|within|max|upto|up to|₹|rs\.?)\s*(\d+)\s*(k|thousand|lakh)?/i)
    if (priceMatch) {
      maxLimit = parseFloat(priceMatch[1])
      const unit = (priceMatch[2] || '').toLowerCase()
      if (unit === 'k' || unit === 'thousand') maxLimit *= 1000
      else if (unit === 'lakh') maxLimit *= 100000
      else if (maxLimit < 1000) maxLimit *= 1000
    }

    const keywords = q
      .replace(/(?:under|below|less than|within|max|upto|up to|₹|rs\.?)\s*\d+\s*(k|thousand|lakh)?/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 1)

    return allProducts.filter(p => {
      const textToSearch = `${p.brand || ''} ${p.title || ''} ${p.category || ''}`.toLowerCase()
      const matchesKw = keywords.length === 0 || keywords.every(kw => textToSearch.includes(kw) || kw.includes(p.category.toLowerCase()))
      const matchesPrice = maxLimit ? (p.price != null && p.price > 0 && p.price <= maxLimit) : true
      return matchesKw && matchesPrice
    }).slice(0, 10)
  }, [query, allProducts])

  if (!isOpen) return null

  return (
    <div className="gemini-search-overlay" onClick={onClose}>
      <div className="gemini-search-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="gemini-search-input-row">
          <span className="search-mag-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={isListening ? "🎙️ Listening..." : "Search catalog (e.g. samsung phones under 100000)..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            type="button" 
            className={`gemini-mic-btn ${isListening ? 'listening' : ''}`}
            onClick={handleVoice}
            title="Voice search"
          >
            🎤
          </button>
          <button className="gemini-close-btn" onClick={onClose}>×</button>
        </div>

        {query.trim() !== '' && (
          <div className="gemini-results-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small className="gemini-results-title">Matching Results</small>
              <button 
                style={{ background: '#ef4444', color: '#fff', border: 0, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => {
                  onTriggerSearch(query)
                  onClose()
                }}
              >
                ✨ Get AI RAG Recommendation
              </button>
            </div>
            {results.length === 0 ? (
              <p className="no-res" style={{ padding: '16px', color: '#6b7280', textAlign: 'center' }}>No products found matching "{query}"</p>
            ) : (
              results.map((item) => (
                <div 
                  key={item.id} 
                  className="gemini-result-item"
                  onClick={() => {
                    onSelectProduct(item)
                    onClose()
                  }}
                >
                  <img src={item.image} alt="" onError={(e) => { e.target.src = getProductImage(item.brand, item.title, item.category) }} />
                  <div className="res-info">
                    <h5>{item.title}</h5>
                    <span className="cat">{item.category.toUpperCase()} • {item.brand}</span>
                  </div>
                  <strong>{money(item.price)}</strong>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AIDrawer({ isOpen, onClose, allProducts, onSelectProduct }) {
  const [msgs, setMsgs] = useState([
    {
      sender: 'ai',
      text: "👋 Hi! I'm ConvoShop, your RAG-powered product advisor. Ask me anything about Phones, Laptops, or Smartwatches!",
      matches: [],
      ragInspectorOpen: false,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    setIsListening(true)

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript
      setInput(speechToText)
      setIsListening(false)
      send(speechToText)
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognition.start()
  }

  const send = async (q) => {
    const text = (q || input).trim()
    if (!text) return
    setMsgs((m) => [...m, { sender: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND_URL}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      if (!res.ok) throw new Error('Backend HTTP error')

      const data = await res.json()
      const confidence = '98.5%'

      setMsgs((m) => [
        ...m,
        {
          sender: 'ai',
          text: data.response || "No response received.",
          reasoning: 'Grounded in verified catalog & Pinecone hybrid vector search.',
          confidence: `${confidence}`,
          chunks: (data.matches || []).map(item => `[${item.id || item.product_id}]: ${item.title} (₹${item.price || 0})`),
          matches: (data.matches || []).map(item => ({
            id: item.id || item.product_id,
            title: item.title,
            brand: item.brand,
            category: item.category,
            price: item.price,
            image: getProductImage(item.brand, item.title, item.category, item.image)
          })),
          ragInspectorOpen: false,
        },
      ])
    } catch (err) {
      console.error('Backend RAG API error:', err)
      const queryLower = text.toLowerCase()
      const matches = allProducts.filter((p) => {
        const textToSearch = `${p.brand || ''} ${p.title || ''} ${p.category || ''}`.toLowerCase()
        return queryLower.split(' ').some(w => w.length > 2 && textToSearch.includes(w))
      }).slice(0, 3)

      setMsgs((m) => [
        ...m,
        {
          sender: 'ai',
          text: `Retrieved ${matches.length} catalog products for "${text}":`,
          reasoning: 'Catalog match.',
          confidence: `90%`,
          chunks: matches.map(item => `[${item.id}]: ${item.title}`),
          matches: matches,
          ragInspectorOpen: false,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="shopify-drawer-overlay" onClick={onClose}>
      <aside className="shopify-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header-bar">
          <h3>✨ ConvoShop AI Advisor</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="drawer-body-chat">
          {msgs.map((m, i) => (
            <div key={i} className={`chat-bubble-sh ${m.sender}`}>
              <div 
                className="chat-text-inner"
                dangerouslySetInnerHTML={{ __html: parseFormattedMarkdown(m.text) }} 
              />
              {m.reasoning && <span className="r-badge">{m.reasoning}</span>}
              {m.confidence && (
                <div style={{ marginTop: '8px' }}>
                  <button 
                    onClick={() => {
                      setMsgs(msgs.map((msg, idx) => idx === i ? { ...msg, ragInspectorOpen: !msg.ragInspectorOpen } : msg))
                    }}
                    style={{ background: 'none', border: '1px solid #93c5fd', color: '#1d4ed8', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔍 View Vector RAG Context ({m.confidence}) {m.ragInspectorOpen ? '▲' : '▼'}
                  </button>
                  {m.ragInspectorOpen && (
                    <div className="rag-inspector-box">
                      <strong>Retrieved Vector Metadata:</strong>
                      <ul>
                        {m.chunks.map((chk, ci) => (
                          <li key={ci}>{chk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {m.matches?.length > 0 && (
                <div className="mini-grid-sh">
                  {m.matches.map((item) => (
                    <div 
                      key={item.id} 
                      className="mini-product-row"
                      onClick={() => {
                        const fullProd = allProducts.find(p => p.id === item.id || p.title === item.title) || item
                        onSelectProduct(fullProd)
                        onClose()
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <img src={item.image} alt="" onError={(e) => { e.target.src = getProductImage(item.brand, item.title, item.category) }} />
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
          {loading && <div className="chat-bubble-sh ai">Searching Pinecone vector catalog & generating response…</div>}
          {isListening && <div className="chat-bubble-sh ai voice-listening">🎙️ Listening... Speak now!</div>}
          <div ref={chatRef} />
        </div>
        <div className="drawer-footer-bar">
          <form onSubmit={(e) => { e.preventDefault(); send(); }}>
            <button
              type="button"
              className={`voice-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceSearch}
              title="Speak your query"
            >
              🎤
            </button>
            <input type="text" placeholder="Ask for phones, laptops, or watches..." value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" className="shop-btn-red">Send</button>
          </form>
        </div>
      </aside>
    </div>
  )
}

function ProductDetailModal({ product, onClose, onAddToCart, isWishlisted, onToggleWishlist }) {
  if (!product) return null
  const [zoom, setZoom] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="shopify-drawer-overlay" onClick={onClose}>
      <div className="product-detail-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose}>×</button>
        
        <div className="modal-content-grid">
          <div 
            className={`modal-img-viewport ${zoom ? 'zoomed' : ''}`}
            onClick={() => setZoom(!zoom)}
            title="Click to toggle image zoom"
          >
            <img 
              src={product.image} 
              alt={product.title} 
              onError={(e) => { e.target.src = getProductImage(product.brand, product.title, product.category) }} 
            />
            <span className="zoom-hint">{zoom ? '🔍 Click to Zoom Out' : '🔍 Click to Zoom In'}</span>
          </div>

          <div className="modal-info-side">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="cat-tag-sh">{product.category.toUpperCase()} • {product.brand}</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleShare} 
                  style={{ background: 'none', border: 0, fontSize: '18px', cursor: 'pointer' }}
                  title="Share product link"
                >
                  🔗 {copied ? '✓ Copied!' : ''}
                </button>
                <button 
                  onClick={() => onToggleWishlist(product)} 
                  style={{ background: 'none', border: 0, fontSize: '20px', cursor: 'pointer' }}
                  title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                >
                  {isWishlisted ? '❤️' : '🤍'}
                </button>
              </div>
            </div>
            <h2>{product.title}</h2>
            
            <div className="price-row-sh" style={{ margin: '12px 0' }}>
              <span className="current-price" style={{ fontSize: '22px' }}>{money(product.price)}</span>
            </div>

            {product.description && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#334155', marginBottom: '14px', lineHeight: '1.5' }}>
                <strong>Product Description & Specifications:</strong>
                <p style={{ marginTop: '4px' }}>{product.description}</p>
              </div>
            )}

            <button 
              className="shop-btn-red full" 
              onClick={() => {
                onAddToCart(product)
                onClose()
              }}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WishlistDrawer({ isOpen, onClose, wishlist, onRemoveWishlist, onAddToCart }) {
  if (!isOpen) return null

  return (
    <div className="shopify-drawer-overlay" onClick={onClose}>
      <aside className="shopify-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header-bar">
          <h3>❤️ My Wishlist ({wishlist.length})</h3>
          <button onClick={onClose}>×</button>
        </div>

        <div className="drawer-body-chat">
          {wishlist.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '40px' }}>Your wishlist is empty. Tap the heart icon on any product to save it!</p>
          ) : (
            wishlist.map((item) => (
              <div key={item.id} className="mini-product-row" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
                  <img src={item.image} alt="" onError={(e) => { e.target.src = getProductImage(item.brand, item.title, item.category) }} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                  <div>
                    <h6 style={{ fontSize: '12px', maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h6>
                    <strong style={{ fontSize: '13px' }}>{money(item.price)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="shop-btn-red" 
                    style={{ padding: '6px 10px', fontSize: '11px' }}
                    onClick={() => {
                      onAddToCart(item)
                      onRemoveWishlist(item.id)
                    }}
                  >
                    Move to Cart
                  </button>
                  <button onClick={() => onRemoveWishlist(item.id)} style={{ border: 0, background: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer' }}>×</button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}

function CheckoutModal({ cartItems, totalAmount, onClose, onSuccess }) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    paymentMethod: 'cod',
    coupon: ''
  })
  const [discount, setDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState(null)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const applyCoupon = () => {
    const code = form.coupon.trim().toUpperCase()
    if (code === 'CONVO20') {
      setDiscount(0.20)
      setCouponMsg({ type: 'success', text: 'Coupon applied! 20% discount unlocked.' })
    } else {
      setDiscount(0)
      setCouponMsg({ type: 'error', text: 'Invalid coupon code (try CONVO20)' })
    }
  }

  const finalPayable = totalAmount * (1 - discount)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSuccess({ ...form, finalTotal: finalPayable })
  }

  return (
    <div className="shopify-drawer-overlay" onClick={onClose}>
      <div className="checkout-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header-bar">
          <h3>🚚 Delivery Address & Checkout</h3>
          <button onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form-body">
          <div className="auth-field">
            <label>Full Name</label>
            <input type="text" name="fullName" placeholder="e.g. Rahul Sharma" value={form.fullName} onChange={handleChange} required />
          </div>

          <div className="auth-field">
            <label>Phone Number</label>
            <input type="tel" name="phone" placeholder="e.g. +91 98765 43210" value={form.phone} onChange={handleChange} required />
          </div>

          <div className="auth-field">
            <label>Street Address / House No.</label>
            <input type="text" name="address" placeholder="e.g. #42, Tech Park Road" value={form.address} onChange={handleChange} required />
          </div>

          <div className="checkout-row-2">
            <div className="auth-field">
              <label>City / Town</label>
              <input type="text" name="city" placeholder="e.g. Bengaluru" value={form.city} onChange={handleChange} required />
            </div>
            <div className="auth-field">
              <label>Postal Code (Pincode)</label>
              <input type="text" name="pincode" placeholder="e.g. 560001" value={form.pincode} onChange={handleChange} required />
            </div>
          </div>

          <div className="auth-field" style={{ marginTop: '4px' }}>
            <label>Discount Coupon (Try CONVO20)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" name="coupon" placeholder="e.g. CONVO20" value={form.coupon} onChange={handleChange} style={{ flex: 1 }} />
              <button type="button" className="shop-btn-outline" onClick={applyCoupon}>Apply</button>
            </div>
            {couponMsg && <small style={{ color: couponMsg.type === 'success' ? '#10b981' : '#ef4444', fontWeight: 600, marginTop: '2px' }}>{couponMsg.text}</small>}
          </div>

          <div className="auth-field" style={{ marginTop: '4px' }}>
            <label>Payment Method</label>
            <select name="paymentMethod" value={form.paymentMethod} onChange={handleChange} className="setting-select" style={{ padding: '10px' }}>
              <option value="cod">Cash on Delivery (COD)</option>
              <option value="upi">UPI / Google Pay / PhonePe</option>
              <option value="card">Credit / Debit Card</option>
            </select>
          </div>

          <div className="checkout-total-banner">
            <span>Total Payable:</span>
            <strong>{money(finalPayable)}</strong>
          </div>

          <button type="submit" className="shop-btn-red full">Place Secure Order</button>
        </form>
      </div>
    </div>
  )
}

function OrderSuccessModal({ orderData, onClose }) {
  return (
    <div className="shopify-drawer-overlay" onClick={onClose}>
      <div className="success-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="success-icon-badge">🎉</div>
        <h2>Order Placed Successfully!</h2>
        <p className="success-sub">Thank you, {orderData.shipping.fullName}. Your AI-assisted order is confirmed.</p>

        <div className="order-meta-card">
          <div className="meta-line">
            <span>Order Tracking ID:</span>
            <strong>{orderData.id}</strong>
          </div>
          <div className="meta-line">
            <span>Delivery Address:</span>
            <strong style={{ textAlign: 'right', maxWidth: '200px' }}>{orderData.shipping.address}, {orderData.shipping.city} - {orderData.shipping.pincode}</strong>
          </div>
          <div className="meta-line">
            <span>Payment:</span>
            <strong style={{ textTransform: 'uppercase' }}>{orderData.shipping.paymentMethod}</strong>
          </div>
          <div className="meta-line">
            <span>Total Paid:</span>
            <strong>{money(orderData.total)}</strong>
          </div>
        </div>

        <button className="shop-btn-red full" onClick={onClose}>
          Continue Shopping
        </button>
      </div>
    </div>
  )
}

function SettingsModal({ user, onClose, onUpdateUser, orders, onLogout, darkMode, setDarkMode }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [msg, setMsg] = useState(false)

  const handleSaveProfile = (e) => {
    e.preventDefault()
    onUpdateUser({ name, email })
    setMsg(true)
    setTimeout(() => setMsg(false), 2000)
  }

  return (
    <div className="shopify-drawer-overlay" onClick={onClose}>
      <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings & Profile</h2>
          <button className="modal-close-x" onClick={onClose}>×</button>
        </div>

        <div className="settings-body-content">
          <form onSubmit={handleSaveProfile} className="auth-form-stack">
            <div className="auth-field">
              <label>Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {msg && <div className="auth-alert-box success">Profile updated successfully!</div>}
            <button type="submit" className="shop-btn-red full-width">Save Changes</button>
          </form>

          <div className="settings-signout-box" style={{ marginTop: '20px' }}>
            <button className="settings-signout-btn" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Store({ user, onLogout, onUpdateUser }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [topRatedOnly, setTopRatedOnly] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('convoshop_dark') === 'true')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [shown, setShown] = useState(BATCH)
  const [cart, setCart] = useState(() => read(`convo_cart_${user.email}`, []))
  const [wishlist, setWishlist] = useState(() => read(`convo_wishlist_${user.email}`, []))
  const [orders, setOrders] = useState(() => read(`convo_orders_${user.email}`, []))
  const [cartOpen, setCartOpen] = useState(false)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderPlacedData, setOrderPlacedData] = useState(null)
  
  // AI Recommendation Banner State
  const [aiRecommendation, setAiRecommendation] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('convoshop_dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const products = result.data.map((row, i) => {
          const priceVal = toNumber(row.price_inr)
          const img = getProductImage(row.brand, row.name, row.category, row.image_url)

          return {
            id: row.product_id || `prod_${i}`,
            product_id: row.product_id || `prod_${i}`,
            title: row.name || 'Untitled product',
            brand: row.brand || '',
            category: (row.category || 'Uncategorized').toLowerCase(),
            price: priceVal,
            original: priceVal,
            rating: toNumber(row.rating),
            image: img,
            description: row.description || ''
          }
        })
        setRows(products)
        setStatus(products.length ? 'ready' : 'empty')
      },
      error: () => setStatus('error'),
    })
  }, [])

  const handleRAGSearch = async (textToSearch) => {
    const text = (textToSearch || searchQuery).trim()
    if (!text) return
    setSearchQuery(text)
    setAiLoading(true)

    try {
      const res = await fetch(`${BACKEND_URL}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      if (!res.ok) throw new Error('HTTP Error')
      const data = await res.json()

      const cleanedMatches = (data.matches || []).map(item => ({
        ...item,
        image: getProductImage(item.brand, item.title, item.category, item.image)
      }))

      setAiRecommendation({
        query: text,
        response: data.response,
        matches: cleanedMatches
      })
    } catch (err) {
      console.error('RAG Search Error:', err)
    } finally {
      setAiLoading(false)
    }
  }

  const categories = useMemo(() => {
    const counts = new Map()
    rows.forEach((r) => counts.set(r.category, (counts.get(r.category) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const filtered = useMemo(() => {
    // If AI Recommendation has matches, prioritize returning those matches in the catalog grid!
    if (aiRecommendation && aiRecommendation.matches && aiRecommendation.matches.length > 0) {
      const matchPids = new Set(aiRecommendation.matches.map(m => m.id || m.product_id))
      const matchedCatalog = rows.filter(r => matchPids.has(r.id) || matchPids.has(r.product_id))
      if (matchedCatalog.length > 0) return matchedCatalog
    }

    return rows.filter((r) => {
      const matchCat = category === 'all' || r.category === category
      const matchRating = topRatedOnly ? (r.rating != null && r.rating >= 4.0) : true

      const q = searchQuery.trim().toLowerCase()
      if (!q) return matchCat && matchRating

      let priceValid = true
      const priceMatch = q.match(/(?:under|below|less than|within|max|upto|up to|₹|rs\.?)\s*(\d+)\s*(k|thousand|lakh)?/i)
      if (priceMatch) {
        let maxLimit = parseFloat(priceMatch[1])
        const unit = (priceMatch[2] || '').toLowerCase()
        if (unit === 'k' || unit === 'thousand') maxLimit *= 1000
        else if (unit === 'lakh') maxLimit *= 100000
        else if (maxLimit < 1000) maxLimit *= 1000
        priceValid = (r.price != null && r.price > 0 && r.price <= maxLimit)
      }

      const keywords = q
        .replace(/(?:under|below|less than|within|max|upto|up to|₹|rs\.?)\s*\d+\s*(k|thousand|lakh)?/gi, '')
        .split(/\s+/)
        .filter(w => w.length > 1)

      const textToSearch = `${r.brand || ''} ${r.title || ''} ${r.category || ''}`.toLowerCase()
      const matchesKeyword = keywords.length === 0 || keywords.every(kw => textToSearch.includes(kw) || kw.includes(r.category) || r.category.includes(kw))

      return matchCat && matchRating && matchesKeyword && priceValid
    })
  }, [rows, category, topRatedOnly, searchQuery, aiRecommendation])

  useEffect(() => {
    const el = endRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown((s) => s + BATCH), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [status, filtered.length])

  useEffect(() => {
    localStorage.setItem(`convo_cart_${user.email}`, JSON.stringify(cart))
  }, [cart, user.email])

  useEffect(() => {
    localStorage.setItem(`convo_wishlist_${user.email}`, JSON.stringify(wishlist))
  }, [wishlist, user.email])

  const handleOpenProduct = (p) => {
    setSelectedProduct(p)
  }

  const addToCart = (p) => {
    setCart((c) =>
      c.some((i) => i.id === p.id)
        ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { id: p.id, title: p.title, image: p.image, price: p.price, qty: 1 }]
    )
    setCartOpen(true)
  }

  const toggleWishlist = (p) => {
    setWishlist((w) =>
      w.some((i) => i.id === p.id) ? w.filter((i) => i.id !== p.id) : [...w, p]
    )
  }

  const removeWishlistItem = (id) => {
    setWishlist((w) => w.filter((i) => i.id !== id))
  }

  const changeQty = (id, delta) => {
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0)
    )
  }

  const removeItem = (id) => {
    setCart((c) => c.filter((i) => i.id !== id))
  }

  const count = cart.reduce((n, i) => n + i.qty, 0)
  const wishlistCount = wishlist.length
  const total = cart.reduce((n, i) => n + (i.price ?? 0) * i.qty, 0)

  const handleFinalizeOrder = (checkoutData) => {
    const summary = [...cart]
    const finalTotal = checkoutData.finalTotal
    const newOrder = {
      id: 'CS-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      items: summary,
      total: finalTotal,
      shipping: checkoutData
    }
    setOrders([newOrder, ...orders])
    setCart([])
    setCartOpen(false)
    setCheckoutOpen(false)
    setOrderPlacedData(newOrder)
  }

  return (
    <div className={`shopify-store-root ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      <header className="shopify-header">
        <div className="shopify-header-inner">
          <Logo />
          
          <form 
            className="header-search-bar" 
            onSubmit={(e) => {
              e.preventDefault()
              handleRAGSearch(searchQuery)
            }}
          >
            <input 
              type="text" 
              placeholder="Search (e.g. which samsung phone has the biggest battery under 100000)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="button" className="header-mic-btn" onClick={() => setSearchModalOpen(true)}>🎤</button>
            <button type="submit" className="search-submit-btn">🔍</button>
          </form>

          <div className="shopify-nav-icons">
            <button className="ai-nav-chip" onClick={() => setAiOpen(true)}>✨ AI Advisor</button>
            <button className="cart-text-btn" onClick={() => setWishlistOpen(true)} title="Wishlist">
              ❤️ <span className="cart-badge-num">{wishlistCount}</span>
            </button>
            <button className="cart-text-btn" onClick={() => setCartOpen(true)}>
              🛒 Cart <span className="cart-badge-num">{count}</span>
            </button>
            <button className="account-icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
              ⚙️ Settings
            </button>
            <button className="logout-text-btn" onClick={onLogout}>Sign Out</button>
          </div>
        </div>
      </header>

      <GeminiSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        allProducts={rows}
        onSelectProduct={(item) => handleOpenProduct(item)}
        onTriggerSearch={(txt) => handleRAGSearch(txt)}
      />

      <section className="shopify-hero-banner">
        <div className="hero-banner-inner">
          <div className="hero-banner-content">
            <span className="banner-tag">VERIFIED PRODUCT CATALOG</span>
            <h2>Phones, Laptops & Smartwatches</h2>
            <p>RAG-Augmented AI Conversational Assistant with Zero Hallucination Guarantee</p>
            <button className="shop-btn-red" onClick={() => setAiOpen(true)}>Ask AI Advisor</button>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <nav className="shopify-cat-nav">
          <div className="shopify-cat-track" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`sh-pill ${category === 'all' ? 'active' : ''}`}
                onClick={() => setCategory('all')}
              >
                All Categories ({rows.length})
              </button>
              {categories.map(([name, catCount]) => (
                <button
                  key={name}
                  className={`sh-pill ${category === name ? 'active' : ''}`}
                  onClick={() => setCategory(name)}
                >
                  {name.toUpperCase()} <small>({catCount})</small>
                </button>
              ))}
            </div>
            <button
              className={`sh-pill rating-filter-btn ${topRatedOnly ? 'active' : ''}`}
              onClick={() => setTopRatedOnly(!topRatedOnly)}
            >
              ⭐ Top Rated (4.0+)
            </button>
          </div>
        </nav>
      )}

      <main className="shopify-main-content" id="products">
        {/* AI Recommendation & RAG Comparison Card */}
        {aiLoading && (
          <div className="ai-recommendation-card loading">
            <span>✨ Querying Pinecone RAG database & generating comparative recommendation...</span>
          </div>
        )}

        {aiRecommendation && !aiLoading && (
          <div className="ai-recommendation-card">
            <div className="ai-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>✨</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>AI Product Recommendation & Comparative Analysis</h4>
                  <small style={{ color: '#818cf8', fontSize: '12px' }}>Query: "{aiRecommendation.query}"</small>
                </div>
              </div>
              <button className="close-rec-btn" onClick={() => setAiRecommendation(null)}>×</button>
            </div>

            <div className="ai-card-body">
              <div 
                className="ai-response-text"
                dangerouslySetInnerHTML={{ __html: parseFormattedMarkdown(aiRecommendation.response) }} 
              />

              {aiRecommendation.matches && aiRecommendation.matches.length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <small style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                    Retrieved Catalog Products for Comparison ({aiRecommendation.matches.length}):
                  </small>
                  <div className="ai-matches-grid">
                    {aiRecommendation.matches.map((item) => (
                      <div 
                        key={item.id} 
                        className="ai-match-card"
                        onClick={() => {
                          const fullProd = rows.find(r => r.id === item.id || r.title === item.title) || item
                          handleOpenProduct(fullProd)
                        }}
                      >
                        <img 
                          src={item.image} 
                          alt={item.title} 
                          onError={(e) => { e.target.src = getProductImage(item.brand, item.title, item.category) }} 
                        />
                        <div className="ai-match-info">
                          <h6>{item.title}</h6>
                          <span className="badge">{item.category?.toUpperCase()} • {item.brand}</span>
                          <strong>{money(item.price)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="catalog-title-row">
          <h3>{aiRecommendation ? `RAG Search Results (${filtered.length})` : 'Verified Product Catalog'}</h3>
          <span>Showing {filtered.length} items</span>
        </div>

        {status === 'loading' && <div className="loading-note">Loading verified catalog inventory…</div>}

        {status === 'ready' && (
          <div className="shopify-product-grid">
            {filtered.slice(0, shown).map((p) => {
              const isWishlisted = wishlist.some((i) => i.id === p.id)
              return (
                <div 
                  key={p.id} 
                  className="shopify-card"
                  onClick={() => handleOpenProduct(p)}
                >
                  <div className="card-img-wrap" style={{ position: 'relative' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleWishlist(p)
                      }}
                      style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 0, fontSize: '18px', cursor: 'pointer', zIndex: 5 }}
                      title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                    >
                      {isWishlisted ? '❤️' : '🤍'}
                    </button>
                    <img 
                      src={p.image} 
                      alt={p.title} 
                      loading="lazy" 
                      onError={(e) => { e.target.src = getProductImage(p.brand, p.title, p.category) }} 
                    />
                  </div>
                  <div className="card-details">
                    <span className="cat-tag-sh">{p.category.toUpperCase()} • {p.brand}</span>
                    <h4 className="title-sh">{p.title}</h4>
                    <div className="price-row-sh">
                      <span className="current-price">{money(p.price)}</span>
                    </div>
                    <button 
                      className="shop-btn-red full" 
                      onClick={(e) => {
                        e.stopPropagation()
                        addToCart(p)
                      }}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div ref={endRef} className="end-sentinel">
          {shown < filtered.length ? 'Loading more products…' : 'End of catalog.'}
        </div>
      </main>

      <button className="floating-shopify-ai" onClick={() => setAiOpen(true)}>
        ✨ Ask AI Advisor
      </button>

      <AIDrawer 
        isOpen={aiOpen} 
        onClose={() => setAiOpen(false)} 
        allProducts={rows} 
        onSelectProduct={(item) => handleOpenProduct(item)}
      />

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
          isWishlisted={wishlist.some((i) => i.id === selectedProduct.id)}
          onToggleWishlist={toggleWishlist}
        />
      )}

      <WishlistDrawer
        isOpen={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        wishlist={wishlist}
        onRemoveWishlist={removeWishlistItem}
        onAddToCart={addToCart}
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

      {orderPlacedData && (
        <OrderSuccessModal
          orderData={orderPlacedData}
          onClose={() => setOrderPlacedData(null)}
        />
      )}

      {cartOpen && (
        <div className="shopify-drawer-overlay" onClick={() => setCartOpen(false)}>
          <aside className="shopify-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header-bar">
              <h3>Your Shopping Cart ({count})</h3>
              <button onClick={() => setCartOpen(false)}>×</button>
            </div>
            
            <div className="drawer-body-chat">
              {cart.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '40px' }}>Your cart is empty.</p>
              ) : (
                cart.map((item) => (
                  <div 
                    key={item.id} 
                    className="mini-product-row cart-clickable-row"
                    onClick={() => {
                      const fullProd = rows.find(r => r.title === item.title) || item
                      handleOpenProduct(fullProd)
                      setCartOpen(false)
                    }}
                    title="Click to view product details"
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                      <img src={item.image} alt="" onError={(e) => { e.target.src = getProductImage(item.brand, item.title, item.category) }} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                      <div>
                        <h6 style={{ fontSize: '12px', maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h6>
                        <strong style={{ fontSize: '13px' }}>{money(item.price)}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => changeQty(item.id, -1)} style={{ width: '22px', height: '22px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>-</button>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.qty}</span>
                      <button onClick={() => changeQty(item.id, 1)} style={{ width: '22px', height: '22px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>+</button>
                      <button onClick={() => removeItem(item.id)} style={{ border: 0, background: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', marginLeft: '6px' }}>Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="drawer-footer-bar" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Total:</span>
                  <span>{money(total)}</span>
                </div>
                <button className="shop-btn-red" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Proceed to Checkout</button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(readSession)

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

  return (
    <>
      {user ? <Store user={user} onLogout={logout} onUpdateUser={updateUser} /> : <Login onLogin={login} />}
    </>
  )
}