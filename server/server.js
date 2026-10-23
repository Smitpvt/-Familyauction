const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const socketModule = require('./socket');
const { isCloudinaryConfigured } = require('./config/cloudinary');

// Initialize app & server
const app = express();
const server = http.createServer(app);

// Configure allowed origins for CORS (Express & Socket.IO)
const getAllowedOrigins = () => {
  if (!process.env.CLIENT_ORIGIN) return ['*'];
  return process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, ''));
};

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow non-browser requests or health checkers
  const origins = getAllowedOrigins();
  if (origins.includes('*') || origins.includes(origin)) return true;
  // Allow Vercel preview and production deployments (*.vercel.app)
  if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(origin)) return true;
  return true; // Fallback: allow to avoid breaking production
};

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Attach io to socket helper module
socketModule.init(io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploaded images and team logos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/team_logo', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
connectDB().then(() => {
  // Ensure all registered non-sold players have minimum ₹500 base price
  const Player = require('./models/Player');
  Player.updateMany(
    { status: { $ne: 'sold' }, $or: [{ basePrice: { $lt: 500 } }, { basePrice: { $exists: false } }] },
    { $set: { basePrice: 500 } }
  ).then((res) => {
    if (res.modifiedCount > 0) {
      console.log(`[Base Price]: Updated ${res.modifiedCount} registered player(s) to minimum ₹500 base price.`);
    }
  }).catch((err) => console.error('[Base Price Sync Error]:', err.message));
}).catch(() => {});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/players', require('./routes/players'));
app.use('/api/rounds', require('./routes/rounds'));
app.use('/api/auction', require('./routes/auction'));
app.use('/api/results', require('./routes/results'));
app.use('/api/upload', require('./routes/upload'));

// Health check endpoint (supports both /api/health and /health for Render)
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), app: 'HFPL Auction Server' });
});

// Socket.io connection logic
const auctionController = require('./controllers/auctionController');
io.on('connection', async (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Send initial auction state upon client connection / refresh
  try {
    const fullState = await auctionController.getFullPopulatedState();
    socket.emit('AUCTION_STATE_UPDATE', fullState);
  } catch (e) {
    console.error('Socket initial state error:', e.message);
  }

  socket.on('REQUEST_STATE', async () => {
    try {
      const fullState = await auctionController.getFullPopulatedState();
      socket.emit('AUCTION_STATE_UPDATE', fullState);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
  });
});

// Serve frontend static build if available
const clientDistPath = path.join(__dirname, '../client/dist');
const fs = require('fs');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/team_logo') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  HFPL CRICKET AUCTION SERVER RUNNING`);
  console.log(`  PORT: ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  CLOUDINARY: ${isCloudinaryConfigured() ? 'Configured' : 'Not configured (uploads will return error)'}`);
  console.log(`===============================================`);
});
