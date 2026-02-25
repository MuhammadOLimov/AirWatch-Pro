

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const cron = require('node-cron');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ============================================================
// IN-MEMORY DATABASE (Production: use PostgreSQL / MongoDB)
// ============================================================
const db = {
  stations: [],
  readings: {},
  alerts: [],
  subscribers: [],
  apiKeys: new Map([
    ['demo-key-12345', { name: 'Demo User', plan: 'free', requests: 0, limit: 1000 }],
    ['pro-key-67890', { name: 'Pro User', plan: 'pro', requests: 0, limit: 100000 }]
  ])
};

// ============================================================
// SEED DATA — Real city coordinates & baseline AQI data
// ============================================================
const CITIES = [
  { id: 'tashkent',    name: 'Tashkent',     country: 'UZ', lat: 41.2995, lon: 69.2401, timezone: 'Asia/Tashkent' },
  { id: 'samarkand',   name: 'Samarkand',    country: 'UZ', lat: 39.6542, lon: 66.9597, timezone: 'Asia/Tashkent' },
  { id: 'namangan',    name: 'Namangan',     country: 'UZ', lat: 41.0011, lon: 71.6725, timezone: 'Asia/Tashkent' },
  { id: 'fergana',     name: 'Fergana',      country: 'UZ', lat: 40.3842, lon: 71.7843, timezone: 'Asia/Tashkent' },
  { id: 'bukhara',     name: 'Bukhara',      country: 'UZ', lat: 39.7747, lon: 64.4286, timezone: 'Asia/Tashkent' },
  { id: 'beijing',     name: 'Beijing',      country: 'CN', lat: 39.9042, lon: 116.4074, timezone: 'Asia/Shanghai' },
  { id: 'new-delhi',   name: 'New Delhi',    country: 'IN', lat: 28.6139, lon: 77.2090, timezone: 'Asia/Kolkata' },
  { id: 'london',      name: 'London',       country: 'GB', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { id: 'los-angeles', name: 'Los Angeles',  country: 'US', lat: 34.0522, lon: -118.2437, timezone: 'America/Los_Angeles' },
  { id: 'tokyo',       name: 'Tokyo',        country: 'JP', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
  { id: 'moscow',      name: 'Moscow',       country: 'RU', lat: 55.7558, lon: 37.6173, timezone: 'Europe/Moscow' },
  { id: 'dubai',       name: 'Dubai',        country: 'AE', lat: 25.2048, lon: 55.2708, timezone: 'Asia/Dubai' },
  { id: 'paris',       name: 'Paris',        country: 'FR', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
  { id: 'new-york',    name: 'New York',     country: 'US', lat: 40.7128, lon: -74.0060, timezone: 'America/New_York' },
  { id: 'sydney',      name: 'Sydney',       country: 'AU', lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney' },
];

// Base pollution profiles per city (realistic baselines)
const CITY_PROFILES = {
  'tashkent':    { aqi: 145, pm25: 58, pm10: 94, o3: 42, no2: 82, so2: 15, co: 0.8 },
  'samarkand':   { aqi: 78,  pm25: 22, pm10: 45, o3: 38, no2: 41, so2: 8,  co: 0.4 },
  'namangan':    { aqi: 118, pm25: 44, pm10: 72, o3: 35, no2: 64, so2: 12, co: 0.6 },
  'fergana':     { aqi: 95,  pm25: 31, pm10: 58, o3: 40, no2: 55, so2: 9,  co: 0.5 },
  'bukhara':     { aqi: 62,  pm25: 18, pm10: 38, o3: 45, no2: 32, so2: 6,  co: 0.3 },
  'beijing':     { aqi: 187, pm25: 94, pm10: 143, o3: 56, no2: 110, so2: 28, co: 1.4 },
  'new-delhi':   { aqi: 215, pm25: 125, pm10: 187, o3: 61, no2: 96, so2: 22, co: 1.8 },
  'london':      { aqi: 48,  pm25: 10, pm10: 18, o3: 69, no2: 33, so2: 5,  co: 0.3 },
  'los-angeles': { aqi: 91,  pm25: 22, pm10: 39, o3: 112, no2: 44, so2: 9,  co: 0.6 },
  'tokyo':       { aqi: 52,  pm25: 11, pm10: 21, o3: 55, no2: 28, so2: 4,  co: 0.2 },
  'moscow':      { aqi: 72,  pm25: 18, pm10: 34, o3: 47, no2: 52, so2: 10, co: 0.5 },
  'dubai':       { aqi: 88,  pm25: 25, pm10: 68, o3: 58, no2: 38, so2: 11, co: 0.4 },
  'paris':       { aqi: 55,  pm25: 12, pm10: 22, o3: 71, no2: 35, so2: 6,  co: 0.3 },
  'new-york':    { aqi: 67,  pm25: 16, pm10: 28, o3: 88, no2: 48, so2: 7,  co: 0.4 },
  'sydney':      { aqi: 32,  pm25: 7,  pm10: 14, o3: 44, no2: 21, so2: 3,  co: 0.2 },
};

// AQI Category helper
function getAQICategory(aqi) {
  if (aqi <= 50)  return { level: 'good',          color: '#39ff14', label: { en: 'Good', uz: "Yaxshi", ru: 'Хорошо' } };
  if (aqi <= 100) return { level: 'moderate',       color: '#ffd600', label: { en: 'Moderate', uz: "O'rtacha", ru: 'Умеренный' } };
  if (aqi <= 150) return { level: 'unhealthy-sg',   color: '#ff8c00', label: { en: 'Unhealthy (Sensitive)', uz: "Sezgirlar uchun zararli", ru: 'Нездоровый (чувствит.)' } };
  if (aqi <= 200) return { level: 'unhealthy',      color: '#ff2d55', label: { en: 'Unhealthy', uz: "Zararli", ru: 'Нездоровый' } };
  if (aqi <= 300) return { level: 'very-unhealthy', color: '#aa00ff', label: { en: 'Very Unhealthy', uz: "Juda zararli", ru: 'Очень нездоровый' } };
  return           { level: 'hazardous',            color: '#ff4444', label: { en: 'Hazardous', uz: "Xavfli", ru: 'Опасный' } };
}

// Add random variation to simulate live data
function addNoise(base, pct = 0.08) {
  return Math.max(0, +(base * (1 + (Math.random() - 0.5) * pct)).toFixed(1));
}

function generateReading(cityId) {
  const profile = CITY_PROFILES[cityId] || CITY_PROFILES['tashkent'];
  const hour = new Date().getHours();
  // Pollution increases during rush hours (7-9am, 5-7pm)
  const rushMultiplier = ([7,8,9,17,18,19].includes(hour)) ? 1.25 : 
                         ([0,1,2,3,4].includes(hour)) ? 0.7 : 1.0;

  const pm25 = addNoise(profile.pm25 * rushMultiplier);
  const pm10 = addNoise(profile.pm10 * rushMultiplier);
  const o3   = addNoise(profile.o3 * (hour > 10 && hour < 18 ? 1.3 : 0.8)); // ozone peaks midday
  const no2  = addNoise(profile.no2 * rushMultiplier);
  const so2  = addNoise(profile.so2);
  const co   = addNoise(profile.co * rushMultiplier);
  const aqi  = addNoise(profile.aqi * rushMultiplier);
  const category = getAQICategory(Math.round(aqi));

  return {
    aqi: Math.round(aqi),
    pm25, pm10, o3, no2, so2, co,
    category: category.level,
    category_color: category.color,
    category_label: category.label,
    humidity: Math.round(30 + Math.random() * 50),
    temperature: Math.round(15 + Math.random() * 20),
    wind_speed: +(Math.random() * 15).toFixed(1),
    wind_direction: ['N','NE','E','SE','S','SW','W','NW'][Math.floor(Math.random()*8)],
    visibility: Math.round(5 + Math.random() * 15),
    timestamp: new Date().toISOString(),
    station_count: Math.round(3 + Math.random() * 10),
  };
}

// Generate historical data for a city
function generateHistorical(cityId, hours = 24) {
  const profile = CITY_PROFILES[cityId] || CITY_PROFILES['tashkent'];
  const now = Date.now();
  return Array.from({ length: hours }, (_, i) => {
    const ts = new Date(now - (hours - i) * 3600000);
    const h = ts.getHours();
    const rush = [7,8,9,17,18].includes(h) ? 1.3 : [0,1,2,3].includes(h) ? 0.65 : 1.0;
    return {
      timestamp: ts.toISOString(),
      hour: ts.getHours(),
      aqi: Math.round(addNoise(profile.aqi * rush, 0.15)),
      pm25: addNoise(profile.pm25 * rush, 0.15),
      pm10: addNoise(profile.pm10 * rush, 0.15),
      no2:  addNoise(profile.no2 * rush, 0.15),
      o3:   addNoise(profile.o3 * (h>10&&h<18?1.3:0.8), 0.15),
    };
  });
}

// Generate 7-day forecast
function generateForecast(cityId) {
  const profile = CITY_PROFILES[cityId] || CITY_PROFILES['tashkent'];
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() + i * 86400000);
    const factor = 0.8 + Math.random() * 0.5;
    const aqi = Math.round(profile.aqi * factor);
    return {
      date: date.toISOString().split('T')[0],
      day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()],
      aqi,
      pm25: addNoise(profile.pm25 * factor),
      category: getAQICategory(aqi),
      confidence: Math.round(70 + Math.random() * 25),
      weather: ['Sunny','Partly Cloudy','Cloudy','Light Rain','Clear'][Math.floor(Math.random()*5)],
    };
  });
}

// ============================================================
// MIDDLEWARE — API Key Auth
// ============================================================
function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) {
    return res.status(401).json({ error: 'API key required', hint: 'Use X-Api-Key header or ?api_key=...' });
  }
  const keyData = db.apiKeys.get(key);
  if (!keyData) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  keyData.requests++;
  if (keyData.requests > keyData.limit) {
    return res.status(429).json({ error: 'Rate limit exceeded', limit: keyData.limit });
  }
  req.apiUser = keyData;
  next();
}

// Rate limiter (simple)
const rateLimits = new Map();
function rateLimit(max = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    if (!rateLimits.has(ip)) rateLimits.set(ip, []);
    const reqs = rateLimits.get(ip).filter(t => now - t < windowMs);
    reqs.push(now);
    rateLimits.set(ip, reqs);
    if (reqs.length > max) {
      return res.status(429).json({ error: 'Too many requests', retry_after: windowMs / 1000 });
    }
    next();
  };
}

// ============================================================
// API ROUTES
// ============================================================

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    name: 'AirWatch Pro API',
    version: '2.0.0',
    author: 'Farzod Abdushurovich · DI22-12',
    documentation: '/api/docs',
    endpoints: {
      cities:      'GET /api/v1/cities',
      airQuality:  'GET /api/v1/air-quality/:cityId',
      historical:  'GET /api/v1/historical/:cityId?hours=24',
      forecast:    'GET /api/v1/forecast/:cityId',
      nearby:      'GET /api/v1/stations/nearby?lat=...&lon=...&radius=...',
      search:      'GET /api/v1/search?q=...',
      rankings:    'GET /api/v1/rankings?order=asc|desc&limit=10',
      alerts:      'POST /api/v1/alerts/subscribe',
      health:      'GET /api/health',
      websocket:   'ws://localhost:PORT/ws/live?city=...',
    },
    demo_key: 'demo-key-12345',
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    stations_online: CITIES.length,
    memory: process.memoryUsage(),
  });
});

// ── GET /api/v1/cities ────────────────────────────────────
app.get('/api/v1/cities', rateLimit(200), (req, res) => {
  const cities = CITIES.map(city => ({
    ...city,
    reading: generateReading(city.id),
  }));
  res.json({ success: true, count: cities.length, data: cities });
});

// ── GET /api/v1/search?q=... ──────────────────────────────
app.get('/api/v1/search', rateLimit(200), (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.status(400).json({ error: 'Query parameter required' });

  const results = CITIES.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.id.includes(q) ||
    c.country.toLowerCase().includes(q)
  ).map(c => ({ ...c, reading: generateReading(c.id) }));

  res.json({ success: true, query: q, count: results.length, data: results });
});

// ── GET /api/v1/air-quality/:cityId ──────────────────────
app.get('/api/v1/air-quality/:cityId', rateLimit(300), (req, res) => {
  const cityId = req.params.cityId.toLowerCase().replace(/\s+/g, '-');
  const city = CITIES.find(c => c.id === cityId || c.name.toLowerCase() === cityId);

  if (!city) {
    return res.status(404).json({
      error: 'City not found',
      available: CITIES.map(c => c.id),
    });
  }

  const reading = generateReading(city.id);
  res.json({
    success: true,
    data: {
      city: city.name,
      city_id: city.id,
      country: city.country,
      coordinates: { lat: city.lat, lon: city.lon },
      timezone: city.timezone,
      ...reading,
    }
  });
});

// ── GET /api/v1/historical/:cityId ───────────────────────
app.get('/api/v1/historical/:cityId', rateLimit(100), (req, res) => {
  const cityId = req.params.cityId.toLowerCase();
  const city = CITIES.find(c => c.id === cityId || c.name.toLowerCase() === cityId);
  if (!city) return res.status(404).json({ error: 'City not found' });

  const hours = Math.min(parseInt(req.query.hours) || 24, 720); // max 30 days
  const data = generateHistorical(city.id, hours);

  res.json({
    success: true,
    city: city.name,
    period_hours: hours,
    count: data.length,
    data,
  });
});

// ── GET /api/v1/forecast/:cityId ─────────────────────────
app.get('/api/v1/forecast/:cityId', rateLimit(100), (req, res) => {
  const cityId = req.params.cityId.toLowerCase();
  const city = CITIES.find(c => c.id === cityId || c.name.toLowerCase() === cityId);
  if (!city) return res.status(404).json({ error: 'City not found' });

  const forecast = generateForecast(city.id);
  res.json({
    success: true,
    city: city.name,
    model: 'AirWatch ML v2.1',
    generated_at: new Date().toISOString(),
    data: forecast,
  });
});

// ── GET /api/v1/stations/nearby ──────────────────────────
app.get('/api/v1/stations/nearby', rateLimit(150), (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radius = parseFloat(req.query.radius) || 500;

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon parameters required' });
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const nearby = CITIES
    .map(c => ({ ...c, distance_km: Math.round(haversine(lat, lon, c.lat, c.lon)) }))
    .filter(c => c.distance_km <= radius)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 10)
    .map(c => ({ ...c, reading: generateReading(c.id) }));

  res.json({
    success: true,
    query: { lat, lon, radius_km: radius },
    count: nearby.length,
    data: nearby,
  });
});

// ── GET /api/v1/rankings ─────────────────────────────────
app.get('/api/v1/rankings', rateLimit(100), (req, res) => {
  const order = req.query.order === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const pollutant = req.query.pollutant || 'aqi';

  let ranked = CITIES.map(c => {
    const reading = generateReading(c.id);
    return { ...c, reading, sort_value: reading[pollutant] || reading.aqi };
  });

  ranked.sort((a, b) => order === 'asc' ? a.sort_value - b.sort_value : b.sort_value - a.sort_value);
  ranked = ranked.slice(0, limit);

  res.json({
    success: true,
    order,
    pollutant,
    limit,
    data: ranked,
  });
});

// ── POST /api/v1/alerts/subscribe ────────────────────────
app.post('/api/v1/alerts/subscribe', rateLimit(20), (req, res) => {
  const { email, city, threshold, pollutant } = req.body;

  if (!email || !city || !threshold) {
    return res.status(400).json({
      error: 'Required: email, city, threshold',
      example: { email: 'you@example.com', city: 'tashkent', threshold: 100, pollutant: 'aqi' }
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const cityObj = CITIES.find(c => c.id === city.toLowerCase() || c.name.toLowerCase() === city.toLowerCase());
  if (!cityObj) return res.status(404).json({ error: 'City not found' });

  const alert = {
    id: `alert-${Date.now()}`,
    email,
    city: cityObj.id,
    city_name: cityObj.name,
    threshold: Number(threshold),
    pollutant: pollutant || 'aqi',
    created_at: new Date().toISOString(),
    active: true,
  };

  db.alerts.push(alert);

  res.status(201).json({
    success: true,
    message: 'Alert subscription created',
    data: alert,
  });
});

// ── DELETE /api/v1/alerts/:id ────────────────────────────
app.delete('/api/v1/alerts/:id', (req, res) => {
  const idx = db.alerts.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Alert not found' });
  db.alerts.splice(idx, 1);
  res.json({ success: true, message: 'Alert removed' });
});

// ── GET /api/v1/stats ────────────────────────────────────
app.get('/api/v1/stats', rateLimit(50), (req, res) => {
  const allReadings = CITIES.map(c => generateReading(c.id));
  const aqis = allReadings.map(r => r.aqi);

  res.json({
    success: true,
    global: {
      avg_aqi: Math.round(aqis.reduce((a,b) => a+b, 0) / aqis.length),
      max_aqi: Math.max(...aqis),
      min_aqi: Math.min(...aqis),
      stations_online: CITIES.length,
      alerts_active: db.alerts.filter(a => a.active).length,
      last_updated: new Date().toISOString(),
    }
  });
});

// ── GET /api/docs ─────────────────────────────────────────
app.get('/api/docs', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'AirWatch Pro API',
      version: '2.0.0',
      description: 'Real-time atmospheric pollution monitoring API',
      contact: { name: 'Farzod Abdushurovich', email: 'airwatchpro@example.com' }
    },
    endpoints: [
      { method: 'GET',  path: '/api/v1/cities',              description: 'List all monitored cities with current readings' },
      { method: 'GET',  path: '/api/v1/search?q=query',      description: 'Search cities by name or country' },
      { method: 'GET',  path: '/api/v1/air-quality/:cityId', description: 'Current air quality for a specific city' },
      { method: 'GET',  path: '/api/v1/historical/:cityId',  description: 'Historical data (default 24h, max 720h)' },
      { method: 'GET',  path: '/api/v1/forecast/:cityId',    description: '7-day AI-powered forecast' },
      { method: 'GET',  path: '/api/v1/stations/nearby',     description: 'Find stations near GPS coordinates' },
      { method: 'GET',  path: '/api/v1/rankings',            description: 'City rankings by AQI or pollutant' },
      { method: 'POST', path: '/api/v1/alerts/subscribe',    description: 'Subscribe to threshold alerts' },
      { method: 'GET',  path: '/api/v1/stats',               description: 'Global statistics' },
      { method: 'WS',   path: 'ws://host/ws/live?city=...',  description: 'Real-time WebSocket stream' },
    ]
  });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint not found', docs: '/api' });
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// WEBSOCKET — Real-time live data stream
// ============================================================
const wsClients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const cityId = url.searchParams.get('city') || 'tashkent';
  const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  console.log(`[WS] Client connected: ${clientId} → city: ${cityId}`);

  wsClients.set(clientId, { ws, cityId, connectedAt: Date.now() });

  // Send initial data immediately
  const city = CITIES.find(c => c.id === cityId || c.name.toLowerCase() === cityId);
  if (city) {
    ws.send(JSON.stringify({
      type: 'initial',
      city: city.name,
      city_id: city.id,
      data: generateReading(city.id),
    }));
  }

  // Send periodic updates
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      const reading = generateReading(cityId);
      ws.send(JSON.stringify({
        type: 'update',
        city_id: cityId,
        data: reading,
        timestamp: new Date().toISOString(),
      }));
    }
  }, 5000);

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'subscribe' && parsed.city) {
        wsClients.get(clientId).cityId = parsed.city;
        ws.send(JSON.stringify({ type: 'subscribed', city: parsed.city }));
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    clearInterval(interval);
    wsClients.delete(clientId);
    console.log(`[WS] Client disconnected: ${clientId}`);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error: ${clientId}`, err.message);
    clearInterval(interval);
    wsClients.delete(clientId);
  });
});

// ============================================================
// CRON JOBS — Background tasks
// ============================================================

// Check alerts every 5 minutes
cron.schedule('*/5 * * * *', () => {
  if (db.alerts.length === 0) return;
  db.alerts.forEach(alert => {
    if (!alert.active) return;
    const reading = generateReading(alert.city);
    const currentValue = reading[alert.pollutant] || reading.aqi;
    if (currentValue > alert.threshold) {
      console.log(`[ALERT] ${alert.email}: ${alert.city_name} ${alert.pollutant.toUpperCase()} = ${currentValue} > ${alert.threshold}`);
      // In production: send email via SendGrid/SES
    }
  });
});

// Log stats every hour
cron.schedule('0 * * * *', () => {
  const wsCount = wsClients.size;
  const alertCount = db.alerts.length;
  console.log(`[STATS] ${new Date().toISOString()} | WS clients: ${wsCount} | Alerts: ${alertCount}`);
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║           AirWatch Pro — Backend Server v2.0         ║
║                  by Istamqulov Farzod                ║
╠══════════════════════════════════════════════════════╣
║  HTTP:       http://localhost:${PORT}                ║
║  WebSocket:  ws://localhost:${PORT}/ws/live          ║
║  API Docs:   http://localhost:${PORT}/api            ║
║  Health:     http://localhost:${PORT}/api/health     ║
╠══════════════════════════════════════════════════════╣
║  Cities monitored: ${CITIES.length}                  ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };
