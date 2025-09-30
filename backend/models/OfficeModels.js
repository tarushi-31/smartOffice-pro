// SmartOffice Pro - Data Models
// This file contains all the data structures for the office management system

const offices = [
  {
    id: 1,
    name: 'SmartOffice HQ',
    address: '123 Innovation Drive, Tech City',
    floors: 5,
    totalDesks: 120,
    totalMeetingRooms: 15,
    capacity: 150,
    timezone: 'UTC-8',
    createdAt: new Date()
  },
  {
    id: 2,
    name: 'SmartOffice Branch',
    address: '456 Business Ave, Downtown',
    floors: 3,
    totalDesks: 80,
    totalMeetingRooms: 10,
    capacity: 100,
    timezone: 'UTC-8',
    createdAt: new Date()
  }
];

const floors = [
  { id: 1, officeId: 1, number: 1, name: 'Ground Floor - Reception', deskCount: 20, roomCount: 3 },
  { id: 2, officeId: 1, number: 2, name: 'Second Floor - Development', deskCount: 30, roomCount: 4 },
  { id: 3, officeId: 1, number: 3, name: 'Third Floor - Sales & Marketing', deskCount: 25, roomCount: 3 },
  { id: 4, officeId: 1, number: 4, name: 'Fourth Floor - Management', deskCount: 20, roomCount: 3 },
  { id: 5, officeId: 1, number: 5, name: 'Fifth Floor - Executive', deskCount: 15, roomCount: 2 }
];

const desks = [];
const meetingRooms = [];
const bookings = [];
const employeePresence = [];
const visitorLogs = [];
const environmentalData = [];

// Generate desks for each floor
floors.forEach(floor => {
  for (let i = 1; i <= floor.deskCount; i++) {
    desks.push({
      id: `${floor.id}-${i}`,
      floorId: floor.id,
      officeId: floor.officeId,
      number: i,
      type: i <= Math.floor(floor.deskCount * 0.7) ? 'standard' : 'premium',
      hasMonitor: Math.random() > 0.3,
      hasStandingDesk: Math.random() > 0.8,
      isAccessible: Math.random() > 0.9,
      status: 'available', // available, occupied, maintenance
      lastCleaned: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    });
  }
});

// Generate meeting rooms for each floor
floors.forEach(floor => {
  for (let i = 1; i <= floor.roomCount; i++) {
    meetingRooms.push({
      id: `${floor.id}-room-${i}`,
      floorId: floor.id,
      officeId: floor.officeId,
      name: `Room ${floor.number}${String.fromCharCode(64 + i)}`,
      capacity: Math.floor(Math.random() * 8) + 4, // 4-12 people
      type: i === 1 ? 'conference' : i === 2 ? 'huddle' : 'meeting',
      hasProjector: Math.random() > 0.4,
      hasWhiteboard: Math.random() > 0.2,
      hasVideoConference: Math.random() > 0.6,
      status: 'available',
      lastCleaned: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    });
  }
});

// Sample users for reference (not used for fake bookings)
const sampleUsers = [
  { id: 1, name: 'John Smith', email: 'john@smartoffice.com', department: 'Engineering' },
  { id: 2, name: 'Sarah Johnson', email: 'sarah@smartoffice.com', department: 'Marketing' },
  { id: 3, name: 'Mike Chen', email: 'mike@smartoffice.com', department: 'Sales' },
  { id: 4, name: 'Emily Davis', email: 'emily@smartoffice.com', department: 'HR' }
];

// Start with empty bookings - users will create their own
// No fake bookings - this makes it realistic for interviews

// Start with empty employee presence data
// Users will create their own attendance records

// Start with empty visitor logs - real visitors will be recorded
// Start with empty environmental data - real sensors will provide data

module.exports = {
  offices,
  floors,
  desks,
  meetingRooms,
  bookings,
  employeePresence,
  visitorLogs,
  environmentalData,
  sampleUsers
};
