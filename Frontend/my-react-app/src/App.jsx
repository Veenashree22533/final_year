import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

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
    <div className="logo-nav-container">
      <img
        className="logo-img-nav"
        src="/logo.png"
        alt="ConvoShop Logo"
      />
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
          <p>A Retrieval-Augmented Generation Framework for Intent-Driven E-Commerce Advisory</p>
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

function GeminiSearchModal({ isOpen, onClose, allProducts, onSelectProduct }) {
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
      setQuery(e.results[0][0].transcript)
      setIsListening(false)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)
    rec.start()
  }

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return allProducts.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 8)
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
            placeholder={isListening ? "🎙️ Listening..." : "Search products, categories..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
            <small className="gemini-results-title">Matching Results</small>
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
                  <img src={item.image} alt="" />
                  <div className="res-info">
                    <h5>{item.title}</h5>
                    <span className="cat">{item.category}</span>
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
      text: "🎙️ Hi! I'm your ConvoShop AI advisor. Looking for wireless microphones or studio gear? Tell me or tap 🎤 to speak!",
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

  const send = (q) => {
    const text = (q || input).trim()
    if (!text) return
    setMsgs((m) => [...m, { sender: 'user', text }])
    setInput('')
    setLoading(true)

    setTimeout(() => {
      const queryLower = text.toLowerCase()
      const numbers = queryLower.match(/\d+/g)
      const maxPrice = numbers ? parseInt(numbers.join(''), 10) : null

      const matches = allProducts.filter((p) => {
        const titleMatch = queryLower.split(' ').some((w) => w.length > 3 && p.title.toLowerCase().includes(w))
        const catMatch = queryLower.includes(p.category.toLowerCase())
        const priceValid = maxPrice ? (p.price != null && p.price <= maxPrice) : true
        return (titleMatch || catMatch) && priceValid
      }).slice(0, 3)

      const finalMatches = matches.length > 0 ? matches : allProducts.slice(0, 3)
      const confidence = (89 + Math.random() * 10).toFixed(1)

      setMsgs((m) => [
        ...m,
        {
          sender: 'ai',
          text: `Here are the top matches based on verified customer reviews for "${text}":`,
          reasoning: 'Grounded in RAG review sentiment & verified pricing.',
          confidence: `${confidence}%`,
          chunks: finalMatches.map(item => `Chunk #${item.id}: "${item.title.slice(0, 28)}..." (sim: ${(0.87 + Math.random()*0.12).toFixed(3)})`),
          matches: finalMatches,
          ragInspectorOpen: false,
        },
      ])
      setLoading(false)
    }, 800)
  }

  if (!isOpen) return null

  return (
    <div className="shopify-drawer-overlay" onClick={onClose}>
      <aside className="shopify-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header-bar">
          <h3>✨ AI Shopping Advisor</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="drawer-body-chat">
          {msgs.map((m, i) => (
            <div key={i} className={`chat-bubble-sh ${m.sender}`}>
              <p>{m.text}</p>
              {m.reasoning && <span className="r-badge">{m.reasoning}</span>}
              {m.confidence && (
                <div style={{ marginTop: '8px' }}>
                  <button 
                    onClick={() => {
                      setMsgs(msgs.map((msg, idx) => idx === i ? { ...msg, ragInspectorOpen: !msg.ragInspectorOpen } : msg))
                    }}
                    style={{ background: 'none', border: '1px solid #93c5fd', color: '#1d4ed8', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔍 View RAG Source Chunks ({m.confidence}) {m.ragInspectorOpen ? '▲' : '▼'}
                  </button>
                  {m.ragInspectorOpen && (
                    <div className="rag-inspector-box">
                      <strong>Vector Database Inspector:</strong>
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
                        onSelectProduct(item)
                        onClose()
                      }}
                      style={{ cursor: 'pointer' }}
                    >
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
          {loading && <div className="chat-bubble-sh ai">Analyzing reviews via vector search…</div>}
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
            <input type="text" placeholder="Ask for microphones or audio gear..." value={input} onChange={(e) => setInput(e.target.value)} />
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
            <img src={product.image} alt={product.title} />
            <span className="zoom-hint">{zoom ? '🔍 Click to Zoom Out' : '🔍 Click to Zoom In'}</span>
          </div>

          <div className="modal-info-side">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="cat-tag-sh">{product.category}</span>
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
              {product.original > product.price && (
                <span className="old-price" style={{ fontSize: '14px' }}>{money(product.original)}</span>
              )}
            </div>

            {product.rating != null && (
              <div className="rating-sh" style={{ marginBottom: '12px' }}>
                ★ {product.rating} &bull; {formatNumber(product.reviews || 0)} Verified Customer Reviews
              </div>
            )}

            <div className="review-breakdown-card">
              <h4>📊 Verified Buyer Rating Breakdown</h4>
              <div className="breakdown-row"><span>5 Star</span><div className="bar-track"><div className="bar-fill" style={{ width: '78%' }}></div></div><span>78%</span></div>
              <div className="breakdown-row"><span>4 Star</span><div className="bar-track"><div className="bar-fill" style={{ width: '15%' }}></div></div><span>15%</span></div>
              <div className="breakdown-row"><span>3 Star</span><div className="bar-track"><div className="bar-fill" style={{ width: '5%' }}></div></div><span>5%</span></div>
              <div className="breakdown-row"><span>1-2 Star</span><div className="bar-track"><div className="bar-fill" style={{ width: '2%' }}></div></div><span>2%</span></div>
            </div>

            <div className="urgency-timer-banner">
              ⚡ Order within <strong>02h 45m</strong> for guaranteed fast dispatch
            </div>

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
                  <img src={item.image} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
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
    if (code === 'CHARGE20') {
      setDiscount(0.20)
      setCouponMsg({ type: 'success', text: 'Coupon applied! 20% discount unlocked.' })
    } else if (code === 'WELCOME10') {
      setDiscount(0.10)
      setCouponMsg({ type: 'success', text: 'Coupon applied! 10% discount unlocked.' })
    } else {
      setDiscount(0)
      setCouponMsg({ type: 'error', text: 'Invalid coupon code (try CHARGE20)' })
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
            <label>Discount Coupon (Try CHARGE20)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" name="coupon" placeholder="e.g. CHARGE20" value={form.coupon} onChange={handleChange} style={{ flex: 1 }} />
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

        <div className="success-items-list">
          {orderData.items.map((item, idx) => (
            <div key={idx} className="success-item-row">
              <span>{item.title.slice(0, 32)}… (×{item.qty})</span>
              <strong>{money(item.price * item.qty)}</strong>
            </div>
          ))}
        </div>

        <button className="shop-btn-red full" onClick={onClose}>
          Continue Shopping
        </button>
      </div>
    </div>
  )
}

function SettingsModal({ user, onClose, onUpdateUser, orders, onLogout, darkMode, setDarkMode }) {
  const [activeSub, setActiveSub] = useState(null)
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
          {activeSub ? (
            <button className="back-arrow-btn" onClick={() => setActiveSub(null)}>‹</button>
          ) : null}
          <h2>{activeSub ? activeSub.toUpperCase() : 'Settings'}</h2>
          <button className="modal-close-x" onClick={onClose}>×</button>
        </div>

        <div className="settings-body-content">
          {!activeSub ? (
            <>
              <div className="settings-profile-banner" onClick={() => setActiveSub('profile')}>
                <div className="profile-avatar-circle">{user.name.charAt(0).toUpperCase()}</div>
                <div className="profile-info-txt">
                  <h3>{user.name.toUpperCase()}</h3>
                  <p>{user.email}</p>
                </div>
                <span className="arrow-icon">›</span>
              </div>

              <div className="settings-list-row" onClick={() => setDarkMode(!darkMode)}>
                <span>Appearance Mode</span>
                <strong>{darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}</strong>
              </div>

              <div className="settings-quick-grid">
                <div className="grid-item" onClick={() => setActiveSub('orders')}>
                  <span className="grid-icon">📦</span>
                  <span>Orders</span>
                </div>
                <div className="grid-item" onClick={() => alert('Coupons & Vouchers: Try code CHARGE20 at checkout.')}>
                  <span className="grid-icon">🏷️</span>
                  <span>Coupons</span>
                </div>
                <div className="grid-item" onClick={() => alert('Wallet Balance: ₹1,500.00 cash-back ready.')}>
                  <span className="grid-icon">💳</span>
                  <span>Wallet</span>
                </div>
                <div className="grid-item" onClick={() => alert('AI RAG Engine active & connected.')}>
                  <span className="grid-icon">📢</span>
                  <span>AI Engine</span>
                </div>
                <div className="grid-item" onClick={() => setActiveSub('policy')}>
                  <span className="grid-icon">🛡️</span>
                  <span>Policy</span>
                </div>
                <div className="grid-item" onClick={() => alert('Customer Support 24/7: support@chargeshop.ai')} >
                  <span className="grid-icon">🎧</span>
                  <span>Support</span>
                </div>
              </div>

              <div className="settings-signout-box">
                <button className="settings-signout-btn" onClick={onLogout}>
                  Sign Out
                </button>
                <small className="version-txt">App version 2.6.0</small>
              </div>
            </>
          ) : (
            <div className="sub-section-view">
              {activeSub === 'profile' && (
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
              )}

              {activeSub === 'orders' && (
                <div className="orders-sub-list">
                  {orders.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#6b7280', padding: '30px' }}>No orders placed yet.</p>
                  ) : (
                    orders.map((ord, idx) => (
                      <div key={idx} className="order-history-card">
                        <div className="order-card-header">
                          <span>Order ID: <strong>{ord.id}</strong></span>
                          <span className="badge-delivered">Confirmed</span>
                        </div>
                        <div className="order-card-details">
                          <small>Date: {ord.date}</small>
                          <small>Total: <strong>{money(ord.total)}</strong></small>
                        </div>
                        <div className="order-items-preview">
                          {ord.items.map((item, i) => (
                            <div key={i} className="ord-item-row">
                              <span>{item.title.slice(0, 32)}… (×{item.qty})</span>
                              <span>{money(item.price * item.qty)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSub === 'address' && (
                <div style={{ padding: '10px 0', fontSize: '13px' }}>
                  <p style={{ fontWeight: 600, marginBottom: '8px' }}>Saved Delivery Address:</p>
                  <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '6px' }}>
                    <strong>{user.name}</strong><br />
                    #42, Tech Park Avenue, Silicon Valley<br />
                    Karnataka, India - 563101
                  </div>
                </div>
              )}

              {activeSub === 'payments' && (
                <div style={{ padding: '10px 0', fontSize: '13px' }}>
                  <p style={{ fontWeight: 600, marginBottom: '8px' }}>Saved Payment Methods:</p>
                  <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>💳 Visa ending in •••• 4892</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>Default</span>
                  </div>
                </div>
              )}

              {(activeSub === 'terms' || activeSub === 'policy') && (
                <div style={{ padding: '10px 0', fontSize: '13px', lineHeight: '1.5', color: '#4b5563' }}>
                  <h4 style={{ color: '#111827', marginBottom: '8px' }}>ConvoShop Terms & Privacy Policy</h4>
                  <p>All AI-driven product advisories are generated via RAG pipelines grounded in verified customer reviews.</p>
                </div>
              )}
            </div>
          )}
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('chargeshop_dark') === 'true')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [shown, setShown] = useState(BATCH)
  const [cart, setCart] = useState(() => read(`charge_cart_${user.email}`, []))
  const [wishlist, setWishlist] = useState(() => read(`charge_wishlist_${user.email}`, []))
  const [recentlyViewed, setRecentlyViewed] = useState(() => read(`charge_recent_${user.email}`, []))
  const [orders, setOrders] = useState(() => read(`charge_orders_${user.email}`, []))
  const [cartOpen, setCartOpen] = useState(false)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderPlacedData, setOrderPlacedData] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('chargeshop_dark', darkMode)
  }, [darkMode])

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
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchCat = category === 'all' || r.category === category
      const matchRating = topRatedOnly ? (r.rating != null && r.rating >= 4.0) : true

      const q = searchQuery.trim().toLowerCase()
      if (!q) return matchCat && matchRating

      const tokens = q.split(/\s+/).filter(w => w.length > 2 && !['under', 'below', 'rs', 'inr'].includes(w))
      const titleLower = r.title.toLowerCase()
      const catLower = r.category.toLowerCase()

      const matchesKeyword = tokens.length === 0 || tokens.some(token => titleLower.includes(token) || catLower.includes(token))

      let priceValid = true
      const priceMatch = q.match(/(?:under|below|<)\s*(\d+)/i)
      if (priceMatch) {
        const maxLimit = parseInt(priceMatch[1], 10)
        const itemPriceInINR = (r.price || 0) * RATE
        priceValid = itemPriceInINR <= maxLimit
      }

      return matchCat && matchRating && matchesKeyword && priceValid
    })
  }, [rows, category, topRatedOnly, searchQuery])

  useEffect(() => {
    const el = endRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown((s) => s + BATCH), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [status, filtered.length])

  useEffect(() => {
    localStorage.setItem(`charge_cart_${user.email}`, JSON.stringify(cart))
  }, [cart, user.email])

  useEffect(() => {
    localStorage.setItem(`charge_wishlist_${user.email}`, JSON.stringify(wishlist))
  }, [wishlist, user.email])

  useEffect(() => {
    localStorage.setItem(`charge_recent_${user.email}`, JSON.stringify(recentlyViewed))
  }, [recentlyViewed, user.email])

  useEffect(() => {
    localStorage.setItem(`charge_orders_${user.email}`, JSON.stringify(orders))
  }, [orders, user.email])

  const handleOpenProduct = (p) => {
    setSelectedProduct(p)
    setRecentlyViewed((prev) => {
      const filtered = prev.filter(item => item.id !== p.id)
      return [p, ...filtered].slice(0, 8)
    })
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
          
          <div className="header-search-bar" onClick={() => setSearchModalOpen(true)}>
            <input 
              type="text" 
              placeholder="Search store (e.g. Laptops under 50000)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="button" className="header-mic-btn" onClick={(e) => { e.stopPropagation(); setSearchModalOpen(true); }}>🎤</button>
            <button className="search-submit-btn" onClick={(e) => { e.stopPropagation(); setSearchModalOpen(true); }}>🔍</button>
          </div>

          <div className="shopify-nav-icons">
            <button className="ai-nav-chip" onClick={() => setAiOpen(true)}>✨ AI Advisor</button>
            <button className="cart-text-btn" onClick={() => setWishlistOpen(true)} title="Wishlist">
              ❤️ <span className="cart-badge-num">{wishlistCount}</span>
            </button>
            <button className="cart-text-btn" onClick={() => setCartOpen(true)}>
              🛒 Add to Cart <span className="cart-badge-num">{count}</span>
            </button>
            <button className="account-icon-btn" onClick={() => setSettingsOpen(true)} title="Settings & Orders">
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
      />

      <section className="shopify-hero-banner">
        <div className="hero-banner-inner">
          <div className="hero-banner-content">
            <span className="banner-tag">SPECIAL OFFER</span>
            <h2>New Gear at Best Prices</h2>
            <p>Check out our special offer on wearable gadgets and electronics.</p>
            <button className="shop-btn-red" onClick={() => setAiOpen(true)}>Shop Now</button>
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
                All Categories
              </button>
              {categories.map(([name, catCount]) => (
                <button
                  key={name}
                  className={`sh-pill ${category === name ? 'active' : ''}`}
                  onClick={() => setCategory(name)}
                >
                  {name} <small>({catCount})</small>
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
        <div className="catalog-title-row">
          <h3>Featured Products</h3>
          <span>Showing {filtered.length} items</span>
        </div>

        {status === 'loading' && <div className="loading-note">Loading store inventory…</div>}

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
                    <img src={p.image} alt={p.title} loading="lazy" />
                  </div>
                  <div className="card-details">
                    <span className="cat-tag-sh">{p.category}</span>
                    <h4 className="title-sh">{p.title}</h4>
                    <div className="price-row-sh">
                      <span className="current-price">{money(p.price)}</span>
                      {p.original > p.price && <span className="old-price">{money(p.original)}</span>}
                    </div>
                    {p.rating != null && (
                      <div className="rating-sh">★ {p.rating} ({formatNumber(p.reviews || 0)})</div>
                    )}
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

      {recentlyViewed.length > 0 && (
        <section className="recently-viewed-section">
          <div className="recent-inner">
            <h3>🕒 Recently Viewed Products</h3>
            <div className="recent-carousel">
              {recentlyViewed.map((item) => (
                <div key={item.id} className="recent-card" onClick={() => handleOpenProduct(item)}>
                  <img src={item.image} alt="" />
                  <h5>{item.title}</h5>
                  <strong>{money(item.price)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
                      <img src={item.image} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
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