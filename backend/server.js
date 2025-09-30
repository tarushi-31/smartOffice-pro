const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { 
  offices, 
  floors, 
  desks, 
  meetingRooms, 
  bookings, 
  employeePresence, 
  visitorLogs, 
  environmentalData,
  sampleUsers 
} = require('./models/OfficeModels');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(tempDir);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Database simulation (in production, use MongoDB/PostgreSQL)
let users = [
  {
    id: 1,
    email: 'admin@maskguard.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    name: 'Admin User',
    role: 'admin',
    organization: 'MaskGuard Corp',
    department: 'IT',
    createdAt: new Date(),
    isActive: true
  },
  {
    id: 2,
    email: 'manager@company.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    name: 'John Manager',
    role: 'manager',
    organization: 'Tech Corp',
    department: 'Operations',
    createdAt: new Date(),
    isActive: true
  }
];

let organizations = [
  {
    id: 1,
    name: 'MaskGuard Corp',
    type: 'Technology',
    employees: 150,
    locations: ['New York', 'San Francisco'],
    complianceRate: 95.2,
    createdAt: new Date()
  },
  {
    id: 2,
    name: 'Tech Corp',
    type: 'Software',
    employees: 75,
    locations: ['Austin', 'Seattle'],
    complianceRate: 88.7,
    createdAt: new Date()
  }
];

let detectionHistory = [];
let events = [];
let alerts = [];
// In-memory notifications store
let notifications = [];
let complianceReports = [];

// Statistics tracking
let stats = {
  totalDetections: 0,
  withMask: 0,
  withoutMask: 0,
  accuracy: 0,
  lastUpdated: new Date()
};

// AI Service configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware for role-based access
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    stats: stats,
    version: '3.0.0',
    service: 'SmartOffice Pro API'
  });
});

// ========================================
// NOTIFICATIONS ENDPOINTS (user-scoped)
// ========================================

// Seed a simple notification for first-time users (helper)
function ensureWelcomeNotification(userId) {
  const hasAny = notifications.some(n => n.userId === userId);
  if (!hasAny) {
    notifications.push({
      id: notifications.length + 1,
      userId,
      title: 'Welcome to SmartOffice Pro',
      message: 'You will receive updates here about bookings and office status.',
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }
}

// Get notifications for current user
app.get('/api/notifications', authenticateToken, (req, res) => {
  ensureWelcomeNotification(req.user.id);
  const userNotifications = notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const unreadCount = userNotifications.filter(n => !n.isRead).length;

  res.json({
    success: true,
    notifications: userNotifications,
    unreadCount
  });
});

// Mark single notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = notifications.findIndex(n => n.id === id && n.userId === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  notifications[idx].isRead = true;
  return res.json({ success: true, notification: notifications[idx] });
});

// Mark all as read
app.put('/api/notifications/mark-all-read', authenticateToken, (req, res) => {
  notifications = notifications.map(n => (
    n.userId === req.user.id ? { ...n, isRead: true } : n
  ));
  return res.json({ success: true });
});

// ========================================
// OFFICE MANAGEMENT ENDPOINTS
// ========================================

// Get office information
app.get('/api/offices', authenticateToken, (req, res) => {
  res.json({
    success: true,
    offices: offices.map(office => ({
      ...office,
      currentOccupancy: Math.floor(Math.random() * office.capacity * 0.8),
      utilizationRate: Math.floor(Math.random() * 80) + 10
    }))
  });
});

// Get floors for an office
app.get('/api/offices/:officeId/floors', authenticateToken, (req, res) => {
  const officeId = parseInt(req.params.officeId);
  const officeFloors = floors.filter(floor => floor.officeId === officeId);
  
  res.json({
    success: true,
    floors: officeFloors.map(floor => ({
      ...floor,
      currentOccupancy: Math.floor(Math.random() * floor.deskCount * 0.7),
      utilizationRate: Math.floor(Math.random() * 70) + 15
    }))
  });
});

// Get desks for a floor
app.get('/api/floors/:floorId/desks', authenticateToken, (req, res) => {
  const floorId = parseInt(req.params.floorId);
  const floorDesks = desks.filter(desk => desk.floorId === floorId);
  
  res.json({
    success: true,
    desks: floorDesks
  });
});

// Get meeting rooms for a floor
app.get('/api/floors/:floorId/meeting-rooms', authenticateToken, (req, res) => {
  const floorId = parseInt(req.params.floorId);
  const floorRooms = meetingRooms.filter(room => room.floorId === floorId);
  
  res.json({
    success: true,
    meetingRooms: floorRooms
  });
});

// Book a desk
app.post('/api/bookings/desk', authenticateToken, [
  body('deskId').exists(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deskId, startDate, endDate, notes } = req.body;
    
    // Check if desk exists and is available
    const desk = desks.find(d => d.id === deskId);
    if (!desk) {
      return res.status(404).json({ error: 'Desk not found' });
    }

    // Check for conflicts
    const conflictingBooking = bookings.find(booking => 
      booking.resourceId === deskId && 
      booking.type === 'desk' &&
      booking.status === 'confirmed' &&
      ((new Date(startDate) >= new Date(booking.startDate) && new Date(startDate) < new Date(booking.endDate)) ||
       (new Date(endDate) > new Date(booking.startDate) && new Date(endDate) <= new Date(booking.endDate)))
    );

    if (conflictingBooking) {
      return res.status(409).json({ error: 'Desk is already booked for this time period' });
    }

    const newBooking = {
      id: `desk-${Date.now()}`,
      type: 'desk',
      resourceId: deskId,
      userId: req.user.id,
      userName: req.user.name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || '',
      status: 'confirmed',
      createdAt: new Date()
    };

    bookings.push(newBooking);

    res.status(201).json({
      success: true,
      message: 'Desk booked successfully',
      booking: newBooking
    });

  // Create a notification for the user
  notifications.push({
    id: notifications.length + 1,
    userId: req.user.id,
    title: 'Desk booking confirmed',
    message: `Your desk #${deskId} has been booked from ${new Date(startDate).toLocaleString()} to ${new Date(endDate).toLocaleString()}.`,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  } catch (error) {
    console.error('Desk booking error:', error);
    res.status(500).json({ error: 'Failed to book desk' });
  }
});

// Book a meeting room
app.post('/api/bookings/meeting-room', authenticateToken, [
  body('roomId').exists(),
  body('title').trim().isLength({ min: 1 }),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('attendees').optional().isInt({ min: 1 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roomId, title, description, startDate, endDate, attendees } = req.body;
    
    // Check if room exists and is available
    const room = meetingRooms.find(r => r.id === roomId);
    if (!room) {
      return res.status(404).json({ error: 'Meeting room not found' });
    }

    // Check capacity
    if (attendees && attendees > room.capacity) {
      return res.status(400).json({ error: 'Number of attendees exceeds room capacity' });
    }

    // Check for conflicts
    const conflictingBooking = bookings.find(booking => 
      booking.resourceId === roomId && 
      booking.type === 'meeting' &&
      booking.status === 'confirmed' &&
      ((new Date(startDate) >= new Date(booking.startDate) && new Date(startDate) < new Date(booking.endDate)) ||
       (new Date(endDate) > new Date(booking.startDate) && new Date(endDate) <= new Date(booking.endDate)))
    );

    if (conflictingBooking) {
      return res.status(409).json({ error: 'Meeting room is already booked for this time period' });
    }

    const newBooking = {
      id: `room-${Date.now()}`,
      type: 'meeting',
      resourceId: roomId,
      userId: req.user.id,
      userName: req.user.name,
      title,
      description: description || '',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      attendees: attendees || 2,
      status: 'confirmed',
      createdAt: new Date()
    };

    bookings.push(newBooking);

    res.status(201).json({
      success: true,
      message: 'Meeting room booked successfully',
      booking: newBooking
    });

  // Create a notification for the user
  notifications.push({
    id: notifications.length + 1,
    userId: req.user.id,
    title: 'Meeting room booked',
    message: `“${title}” reserved from ${new Date(startDate).toLocaleString()} to ${new Date(endDate).toLocaleString()}.`,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  } catch (error) {
    console.error('Meeting room booking error:', error);
    res.status(500).json({ error: 'Failed to book meeting room' });
  }
});

// Get user bookings
app.get('/api/bookings/my-bookings', authenticateToken, (req, res) => {
  const userBookings = bookings.filter(booking => booking.userId === req.user.id);
  
  // Add resource details to bookings
  const bookingsWithDetails = userBookings.map(booking => {
    const resource = booking.type === 'desk' 
      ? desks.find(d => d.id === booking.resourceId)
      : meetingRooms.find(r => r.id === booking.resourceId);
    
    const floor = floors.find(f => f.id === resource.floorId);
    
    return {
      ...booking,
      resource: {
        ...resource,
        floorName: floor.name,
        officeName: offices.find(o => o.id === floor.officeId).name
      }
    };
  });

  res.json({
    success: true,
    bookings: bookingsWithDetails
  });
});

// Get all bookings (admin/manager only)
app.get('/api/bookings', authenticateToken, requireRole(['admin', 'manager']), (req, res) => {
  const { type, status, startDate, endDate } = req.query;
  
  let filteredBookings = bookings;
  
  if (type) {
    filteredBookings = filteredBookings.filter(booking => booking.type === type);
  }
  
  if (status) {
    filteredBookings = filteredBookings.filter(booking => booking.status === status);
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    filteredBookings = filteredBookings.filter(booking => {
      const bookingStart = new Date(booking.startDate);
      return bookingStart >= start && bookingStart <= end;
    });
  }

  res.json({
    success: true,
    bookings: filteredBookings,
    total: filteredBookings.length
  });
});

// Cancel booking
app.put('/api/bookings/:bookingId/cancel', authenticateToken, (req, res) => {
  const bookingId = req.params.bookingId;
  const bookingIndex = bookings.findIndex(b => b.id === bookingId);
  
  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  
  // Check permissions
  if (req.user.role !== 'admin' && bookings[bookingIndex].userId !== req.user.id) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  bookings[bookingIndex].status = 'cancelled';
  bookings[bookingIndex].cancelledAt = new Date();
  bookings[bookingIndex].cancelledBy = req.user.id;
  
  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    booking: bookings[bookingIndex]
  });
});

// Employee check-in (with face mask detection)
app.post('/api/attendance/check-in', authenticateToken, async (req, res) => {
  try {
    const { deskId, imageData, temperature } = req.body;
    
    if (!deskId) {
      return res.status(400).json({ error: 'Desk ID is required' });
    }

    // Check if desk exists and is available
    const desk = desks.find(d => d.id === deskId);
    if (!desk) {
      return res.status(404).json({ error: 'Desk not found' });
    }

    // Check if desk is already occupied
    const activePresence = employeePresence.find(p => 
      p.deskId === deskId && 
      p.status === 'active' &&
      !p.checkOut
    );
    
    if (activePresence) {
      return res.status(409).json({ error: 'Desk is already occupied' });
    }

    let maskCompliance = true; // Default to compliant
    
    // If image data provided, use face mask detection
    if (imageData) {
      try {
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/webcam`, {
          image: imageData
        }, {
          timeout: 10000
        });
        
        maskCompliance = aiResponse.data.prediction.result === 'Wearing Mask';
      } catch (aiError) {
        console.error('AI service error:', aiError);
        // Continue with check-in even if AI service fails
      }
    }

    // If no mask compliance, create alert
    if (!maskCompliance) {
      const alert = {
        id: alerts.length + 1,
        userId: req.user.id,
        type: 'safety_violation',
        message: `Employee ${req.user.name} checked in without proper mask compliance`,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        resolved: false
      };
      alerts.push(alert);
    }

    // Create attendance record
    const attendanceRecord = {
      id: employeePresence.length + 1,
      userId: req.user.id,
      userName: req.user.name,
      deskId: deskId,
      checkIn: new Date(),
      status: 'active',
      maskCompliance: maskCompliance,
      temperature: temperature || (36.5 + Math.random() * 0.5),
      createdAt: new Date()
    };

    employeePresence.push(attendanceRecord);

    // Update desk status
    const deskIndex = desks.findIndex(d => d.id === deskId);
    if (deskIndex !== -1) {
      desks[deskIndex].status = 'occupied';
    }

    res.json({
      success: true,
      message: 'Check-in successful',
      attendance: attendanceRecord,
      maskCompliance: maskCompliance,
      alert: !maskCompliance ? 'Safety violation recorded' : null
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// Employee check-out
app.post('/api/attendance/check-out', authenticateToken, (req, res) => {
  try {
    const { attendanceId } = req.body;
    
    const attendanceIndex = employeePresence.findIndex(p => 
      p.id === attendanceId && 
      p.userId === req.user.id && 
      p.status === 'active'
    );
    
    if (attendanceIndex === -1) {
      return res.status(404).json({ error: 'Active attendance record not found' });
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(employeePresence[attendanceIndex].checkIn);
    const duration = checkOutTime.getTime() - checkInTime.getTime();

    employeePresence[attendanceIndex].checkOut = checkOutTime;
    employeePresence[attendanceIndex].duration = duration;
    employeePresence[attendanceIndex].status = 'completed';

    // Update desk status
    const deskIndex = desks.findIndex(d => d.id === employeePresence[attendanceIndex].deskId);
    if (deskIndex !== -1) {
      desks[deskIndex].status = 'available';
    }

    res.json({
      success: true,
      message: 'Check-out successful',
      attendance: employeePresence[attendanceIndex],
      duration: Math.round(duration / (1000 * 60 * 60)) // hours
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Check-out failed' });
  }
});

// Get current office occupancy
app.get('/api/occupancy/current', authenticateToken, (req, res) => {
  const activePresence = employeePresence.filter(p => p.status === 'active');
  const officeOccupancy = {};
  
  offices.forEach(office => {
    const officeDesks = desks.filter(d => d.officeId === office.id);
    const occupiedDesks = officeDesks.filter(d => d.status === 'occupied');
    
    officeOccupancy[office.id] = {
      officeName: office.name,
      totalDesks: officeDesks.length,
      occupiedDesks: occupiedDesks.length,
      utilizationRate: officeDesks.length > 0 ? (occupiedDesks.length / officeDesks.length) * 100 : 0,
      currentEmployees: activePresence.filter(p => 
        desks.find(d => d.id === p.deskId && d.officeId === office.id)
      ).length
    };
  });

  res.json({
    success: true,
    occupancy: officeOccupancy,
    totalActive: activePresence.length
  });
});

// Get environmental data
app.get('/api/environmental', authenticateToken, (req, res) => {
  const { officeId, hours = 24 } = req.query;
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  let filteredData = environmentalData.filter(data => 
    new Date(data.timestamp) >= cutoffTime
  );
  
  if (officeId) {
    filteredData = filteredData.filter(data => data.officeId === parseInt(officeId));
  }

  res.json({
    success: true,
    environmentalData: filteredData.slice(-100), // Last 100 records
    averages: {
      temperature: filteredData.reduce((sum, d) => sum + d.temperature, 0) / filteredData.length || 0,
      humidity: filteredData.reduce((sum, d) => sum + d.humidity, 0) / filteredData.length || 0,
      airQuality: filteredData.reduce((sum, d) => sum + d.airQuality, 0) / filteredData.length || 0,
      noiseLevel: filteredData.reduce((sum, d) => sum + d.noiseLevel, 0) / filteredData.length || 0,
      occupancy: filteredData.reduce((sum, d) => sum + d.occupancy, 0) / filteredData.length || 0
    }
  });
});

// Get office analytics - user-specific
app.get('/api/analytics/office', authenticateToken, (req, res) => {
  const { startDate, endDate, officeId } = req.query;
  
  // Get user-specific data
  let userPresence = employeePresence.filter(p => p.userId === req.user.id);
  let userBookings = bookings.filter(b => b.userId === req.user.id);
  
  // Filter data by date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    userPresence = userPresence.filter(p => {
      const checkIn = new Date(p.checkIn);
      return checkIn >= start && checkIn <= end;
    });
    userBookings = userBookings.filter(b => {
      const bookingDate = new Date(b.startDate);
      return bookingDate >= start && bookingDate <= end;
    });
  }
  
  // Filter by office
  if (officeId) {
    const officeDesks = desks.filter(d => d.officeId === parseInt(officeId));
    const officeDeskIds = officeDesks.map(d => d.id);
    userPresence = userPresence.filter(p => officeDeskIds.includes(p.deskId));
  }

  const analytics = {
    totalCheckIns: userPresence.length,
    averageSessionDuration: userPresence.length > 0 
      ? userPresence.reduce((sum, p) => sum + (p.duration || 0), 0) / userPresence.length / (1000 * 60 * 60)
      : 0,
    maskComplianceRate: userPresence.length > 0
      ? (userPresence.filter(p => p.maskCompliance).length / userPresence.length) * 100
      : 100,
    peakHours: generatePeakHours(userPresence),
    departmentBreakdown: generateUserDepartmentBreakdown(userPresence, req.user),
    deskUtilization: generateUserDeskUtilization(userPresence),
    bookingTrends: generateUserBookingTrends(userBookings)
  };

  res.json({
    success: true,
    analytics: analytics,
    period: {
      startDate: startDate || 'All time',
      endDate: endDate || 'Present'
    }
  });
});

// Helper functions for analytics
function generatePeakHours(presenceData) {
  const hourlyData = Array(24).fill(0);
  presenceData.forEach(p => {
    const hour = new Date(p.checkIn).getHours();
    hourlyData[hour]++;
  });
  return hourlyData;
}

function generateDepartmentBreakdown(presenceData) {
  const deptData = {};
  presenceData.forEach(p => {
    const user = sampleUsers.find(u => u.id === p.userId);
    if (user) {
      deptData[user.department] = (deptData[user.department] || 0) + 1;
    }
  });
  return deptData;
}

function generateDeskUtilization(officeId) {
  const relevantDesks = officeId ? desks.filter(d => d.officeId === parseInt(officeId)) : desks;
  const totalDesks = relevantDesks.length;
  const occupiedDesks = relevantDesks.filter(d => d.status === 'occupied').length;
  
  return {
    total: totalDesks,
    occupied: occupiedDesks,
    available: totalDesks - occupiedDesks,
    utilizationRate: totalDesks > 0 ? (occupiedDesks / totalDesks) * 100 : 0
  };
}

function generateBookingTrends(bookings, startDate, endDate) {
  let filteredBookings = bookings;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    filteredBookings = bookings.filter(b => {
      const bookingDate = new Date(b.startDate);
      return bookingDate >= start && bookingDate <= end;
    });
  }
  
  const deskBookings = filteredBookings.filter(b => b.type === 'desk').length;
  const roomBookings = filteredBookings.filter(b => b.type === 'meeting').length;
  
  return {
    deskBookings,
    roomBookings,
    totalBookings: deskBookings + roomBookings,
    averageBookingDuration: filteredBookings.length > 0 
      ? filteredBookings.reduce((sum, b) => sum + (new Date(b.endDate) - new Date(b.startDate)), 0) / filteredBookings.length / (1000 * 60 * 60)
      : 0
  };
}

// User-specific helper functions
function generateUserDepartmentBreakdown(presenceData, user) {
  // For individual users, show only their department
  return {
    [user.department || 'General']: presenceData.length
  };
}

function generateUserDeskUtilization(userPresence) {
  const userDeskIds = new Set(userPresence.map(p => p.deskId));
  const totalDesks = desks.length;
  
  return {
    total: totalDesks,
    occupied: userDeskIds.size,
    available: totalDesks - userDeskIds.size,
    utilizationRate: totalDesks > 0 ? (userDeskIds.size / totalDesks) * 100 : 0
  };
}

function generateUserBookingTrends(userBookings) {
  const deskBookings = userBookings.filter(b => b.type === 'desk').length;
  const roomBookings = userBookings.filter(b => b.type === 'meeting').length;
  
  return {
    deskBookings,
    roomBookings,
    totalBookings: deskBookings + roomBookings,
    averageBookingDuration: userBookings.length > 0 
      ? userBookings.reduce((sum, b) => sum + (new Date(b.endDate) - new Date(b.startDate)), 0) / userBookings.length / (1000 * 60 * 60)
      : 0
  };
}

// Authentication endpoints
app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 }),
  body('organization').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, organization, department } = req.body;

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      name,
      role: 'user',
      organization,
      department: department || 'General',
      createdAt: new Date(),
      isActive: true
    };

    users.push(newUser);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        email: newUser.email, 
        role: newUser.role,
        organization: newUser.organization
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        organization: newUser.organization,
        department: newUser.department
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = users.find(u => u.email === email && u.isActive);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        organization: user.organization
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
        department: user.department
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
      department: user.department,
      createdAt: user.createdAt
    }
  });
});

// Update user profile
app.put('/api/auth/profile', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('department').optional().trim()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, department } = req.body;
    if (name) users[userIndex].name = name;
    if (department) users[userIndex].department = department;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        name: users[userIndex].name,
        role: users[userIndex].role,
        organization: users[userIndex].organization,
        department: users[userIndex].department
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// Upload and predict endpoint (protected)
app.post('/api/predict', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imagePath = req.file.path;
    
    // Process image with sharp for optimization
    const processedImagePath = path.join(tempDir, `processed-${req.file.filename}`);
    await sharp(imagePath)
      .resize(128, 128, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toFile(processedImagePath);

    // Send to AI service
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(processedImagePath), {
      filename: req.file.filename,
      contentType: 'image/jpeg'
    });

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    });

    // Update statistics
    stats.totalDetections++;
    if (aiResponse.data.prediction.result === 'Wearing Mask') {
      stats.withMask++;
    } else {
      stats.withoutMask++;
    }
    stats.accuracy = stats.totalDetections > 0 ? 
      (stats.withMask / stats.totalDetections) * 100 : 0;
    stats.lastUpdated = new Date();

    // Add to detection history
    const detection = {
      id: detectionHistory.length + 1,
      userId: req.user.id,
      userEmail: req.user.email,
      organization: req.user.organization,
      filename: req.file.originalname,
      result: aiResponse.data.prediction.result,
      confidence: aiResponse.data.prediction.confidence,
      timestamp: new Date().toISOString(),
      location: req.body.location || 'Unknown'
    };
    detectionHistory.push(detection);

    // Create alert if no mask detected
    if (aiResponse.data.prediction.result === 'Not Wearing Mask') {
      const alert = {
        id: alerts.length + 1,
        userId: req.user.id,
        type: 'compliance_violation',
        message: `Mask compliance violation detected for ${req.user.name}`,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        resolved: false
      };
      alerts.push(alert);
    }

    // Clean up files
    await fs.remove(imagePath);
    await fs.remove(processedImagePath);

    res.json({
      success: true,
      prediction: aiResponse.data.prediction,
      image: aiResponse.data.image,
      filename: req.file.originalname,
      stats: stats,
      detectionId: detection.id
    });

  } catch (error) {
    console.error('Prediction error:', error);
    
    // Clean up files on error
    if (req.file) {
      await fs.remove(req.file.path).catch(console.error);
    }
    
    res.status(500).json({
      error: 'Failed to process image',
      details: error.message
    });
  }
});

// Webcam prediction endpoint (protected)
app.post('/api/predict-webcam', authenticateToken, async (req, res) => {
  try {
    const { imageData, location } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Save temporary image
    const tempImagePath = path.join(tempDir, `webcam-${uuidv4()}.jpg`);
    await fs.writeFile(tempImagePath, imageBuffer);

    // Process image
    const processedImagePath = path.join(tempDir, `processed-webcam-${uuidv4()}.jpg`);
    await sharp(tempImagePath)
      .resize(128, 128, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toFile(processedImagePath);

    // Send to AI service
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(processedImagePath), {
      filename: 'webcam.jpg',
      contentType: 'image/jpeg'
    });

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    });

    // Update statistics
    stats.totalDetections++;
    if (aiResponse.data.prediction.result === 'Wearing Mask') {
      stats.withMask++;
    } else {
      stats.withoutMask++;
    }
    stats.accuracy = stats.totalDetections > 0 ? 
      (stats.withMask / stats.totalDetections) * 100 : 0;
    stats.lastUpdated = new Date();

    // Add to detection history
    const detection = {
      id: detectionHistory.length + 1,
      userId: req.user.id,
      userEmail: req.user.email,
      organization: req.user.organization,
      filename: 'webcam-capture.jpg',
      result: aiResponse.data.prediction.result,
      confidence: aiResponse.data.prediction.confidence,
      timestamp: new Date().toISOString(),
      location: location || 'Webcam'
    };
    detectionHistory.push(detection);

    // Create alert if no mask detected
    if (aiResponse.data.prediction.result === 'Not Wearing Mask') {
      const alert = {
        id: alerts.length + 1,
        userId: req.user.id,
        type: 'compliance_violation',
        message: `Real-time mask compliance violation detected for ${req.user.name}`,
        severity: 'high',
        timestamp: new Date().toISOString(),
        resolved: false
      };
      alerts.push(alert);
    }

    // Clean up files
    await fs.remove(tempImagePath);
    await fs.remove(processedImagePath);

    res.json({
      success: true,
      prediction: aiResponse.data.prediction,
      stats: stats,
      detectionId: detection.id
    });

  } catch (error) {
    console.error('Webcam prediction error:', error);
    res.status(500).json({
      error: 'Failed to process webcam image',
      details: error.message
    });
  }
});

// Get statistics endpoint - user-specific
app.get('/api/stats', authenticateToken, (req, res) => {
  // Get user-specific stats
  const userDetections = detectionHistory.filter(d => d.userId === req.user.id);
  const userWithMask = userDetections.filter(d => d.result === 'Wearing Mask').length;
  const userWithoutMask = userDetections.filter(d => d.result === 'Not Wearing Mask').length;
  
  const userStats = {
    totalDetections: userDetections.length,
    withMask: userWithMask,
    withoutMask: userWithoutMask,
    accuracy: userDetections.length > 0 ? (userWithMask / userDetections.length) * 100 : 0,
    lastUpdated: new Date()
  };

  res.json({
    success: true,
    stats: userStats
  });
});

// Get detection history - user-specific
app.get('/api/history', authenticateToken, (req, res) => {
  // Only show user's own detection history
  const userHistory = detectionHistory.filter(d => d.userId === req.user.id);

  res.json({
    success: true,
    history: userHistory.slice(-100) // Return last 100 detections
  });
});

// Get alerts - user-specific
app.get('/api/alerts', authenticateToken, (req, res) => {
  // Only show user's own alerts
  const userAlerts = alerts.filter(a => a.userId === req.user.id);

  res.json({
    success: true,
    alerts: userAlerts.slice(-50) // Return last 50 alerts
  });
});

// Mark alert as resolved
app.put('/api/alerts/:id/resolve', authenticateToken, (req, res) => {
  const alertId = parseInt(req.params.id);
  const alertIndex = alerts.findIndex(a => a.id === alertId);
  
  if (alertIndex === -1) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  
  // Check permissions
  if (req.user.role === 'user' && alerts[alertIndex].userId !== req.user.id) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  alerts[alertIndex].resolved = true;
  alerts[alertIndex].resolvedBy = req.user.id;
  alerts[alertIndex].resolvedAt = new Date().toISOString();
  
  res.json({
    success: true,
    message: 'Alert resolved successfully',
    alert: alerts[alertIndex]
  });
});

// Get organizations (admin only)
app.get('/api/organizations', authenticateToken, requireRole(['admin']), (req, res) => {
  res.json({
    success: true,
    organizations: organizations
  });
});

// Get users (admin and manager only)
app.get('/api/users', authenticateToken, requireRole(['admin', 'manager']), (req, res) => {
  let userList = users;
  
  // Filter by organization for managers
  if (req.user.role === 'manager') {
    userList = users.filter(u => u.organization === req.user.organization);
  }
  
  // Remove passwords from response
  const safeUsers = userList.map(user => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organization: user.organization,
    department: user.department,
    createdAt: user.createdAt,
    isActive: user.isActive
  }));
  
  res.json({
    success: true,
    users: safeUsers
  });
});

// Create event (manager and admin only)
app.post('/api/events', authenticateToken, requireRole(['admin', 'manager']), [
  body('name').trim().isLength({ min: 2 }),
  body('location').trim().isLength({ min: 2 }),
  body('startDate').isISO8601(),
  body('endDate').isISO8601()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location, startDate, endDate, expectedAttendees } = req.body;
    
    const event = {
      id: events.length + 1,
      name,
      description: description || '',
      location,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      expectedAttendees: expectedAttendees || 0,
      organization: req.user.organization,
      createdBy: req.user.id,
      createdAt: new Date(),
      status: 'active',
      complianceRate: 0,
      totalDetections: 0
    };
    
    events.push(event);
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
    
  } catch (error) {
    console.error('Event creation error:', error);
    res.status(500).json({ error: 'Event creation failed' });
  }
});

// Get events
app.get('/api/events', authenticateToken, (req, res) => {
  let eventList = events;
  
  // Filter by organization for non-admin users
  if (req.user.role !== 'admin') {
    eventList = events.filter(e => e.organization === req.user.organization);
  }
  
  res.json({
    success: true,
    events: eventList
  });
});

// Generate compliance report
app.get('/api/reports/compliance', authenticateToken, requireRole(['admin', 'manager']), (req, res) => {
  const { startDate, endDate, organization } = req.query;
  
  let filteredHistory = detectionHistory;
  
  // Filter by organization for managers
  if (req.user.role === 'manager') {
    filteredHistory = detectionHistory.filter(d => d.organization === req.user.organization);
  }
  
  // Filter by organization if specified (admin only)
  if (organization && req.user.role === 'admin') {
    filteredHistory = detectionHistory.filter(d => d.organization === organization);
  }
  
  // Filter by date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    filteredHistory = filteredHistory.filter(d => {
      const detectionDate = new Date(d.timestamp);
      return detectionDate >= start && detectionDate <= end;
    });
  }
  
  const totalDetections = filteredHistory.length;
  const withMask = filteredHistory.filter(d => d.result === 'Wearing Mask').length;
  const withoutMask = filteredHistory.filter(d => d.result === 'Not Wearing Mask').length;
  const complianceRate = totalDetections > 0 ? (withMask / totalDetections) * 100 : 0;
  
  // Group by organization
  const orgStats = {};
  filteredHistory.forEach(detection => {
    if (!orgStats[detection.organization]) {
      orgStats[detection.organization] = {
        total: 0,
        withMask: 0,
        withoutMask: 0
      };
    }
    orgStats[detection.organization].total++;
    if (detection.result === 'Wearing Mask') {
      orgStats[detection.organization].withMask++;
    } else {
      orgStats[detection.organization].withoutMask++;
    }
  });
  
  // Calculate compliance rates for each organization
  Object.keys(orgStats).forEach(org => {
    const stats = orgStats[org];
    stats.complianceRate = stats.total > 0 ? (stats.withMask / stats.total) * 100 : 0;
  });
  
  const report = {
    period: {
      startDate: startDate || 'All time',
      endDate: endDate || 'Present'
    },
    summary: {
      totalDetections,
      withMask,
      withoutMask,
      complianceRate: Math.round(complianceRate * 100) / 100
    },
    organizationBreakdown: orgStats,
    generatedAt: new Date().toISOString(),
    generatedBy: req.user.name
  };
  
  res.json({
    success: true,
    report
  });
});

// Reset statistics endpoint (admin only)
app.post('/api/stats/reset', authenticateToken, requireRole(['admin']), (req, res) => {
  stats = {
    totalDetections: 0,
    withMask: 0,
    withoutMask: 0,
    accuracy: 0,
    lastUpdated: new Date()
  };
  
  res.json({
    success: true,
    message: 'Statistics reset successfully',
    stats: stats
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏢 SmartOffice Pro Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI Service URL: ${AI_SERVICE_URL}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Configured' : 'Using default (change in production!)'}`);
  console.log(`📈 Office Management API ready`);
  console.log(`🎯 Features: Desk booking, Meeting rooms, Attendance, Analytics`);
});

module.exports = app;