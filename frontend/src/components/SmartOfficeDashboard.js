import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Calendar, 
  BarChart3,
  Bell,
  Monitor,
  Video,
  UserCheck
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AttendanceTab from './AttendanceTab';
import BookingTab from './BookingTab';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const SmartOfficeDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [offices, setOffices] = useState([]);
  const [currentOccupancy, setCurrentOccupancy] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [floors, setFloors] = useState([]);
  const [desks, setDesks] = useState([]);
  const [meetingRooms, setMeetingRooms] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch offices
      const officesResponse = await axios.get(`${API_BASE_URL}/offices`, {
        headers: getAuthHeaders()
      });
      setOffices(officesResponse.data.offices);
      
      if (officesResponse.data.offices.length > 0) {
        setSelectedOffice(officesResponse.data.offices[0]);
      }

      // Fetch occupancy data
      const occupancyResponse = await axios.get(`${API_BASE_URL}/occupancy/current`, {
        headers: getAuthHeaders()
      });
      setCurrentOccupancy(occupancyResponse.data);


      // Fetch user bookings
      const bookingsResponse = await axios.get(`${API_BASE_URL}/bookings/my-bookings`, {
        headers: getAuthHeaders()
      });
      setMyBookings(bookingsResponse.data.bookings);

      // Fetch notifications
      const notificationsResponse = await axios.get(`${API_BASE_URL}/notifications`, {
        headers: getAuthHeaders()
      });
      setNotifications(notificationsResponse.data.notifications);
      setUnreadCount(notificationsResponse.data.unreadCount);

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficeDetails = async (officeId) => {
    try {
      // Fetch floors
      const floorsResponse = await axios.get(`${API_BASE_URL}/offices/${officeId}/floors`, {
        headers: getAuthHeaders()
      });
      setFloors(floorsResponse.data.floors);

      // Fetch desks for first floor
      if (floorsResponse.data.floors.length > 0) {
        const firstFloor = floorsResponse.data.floors[0];
        
        const desksResponse = await axios.get(`${API_BASE_URL}/floors/${firstFloor.id}/desks`, {
          headers: getAuthHeaders()
        });
        setDesks(desksResponse.data.desks);

        const roomsResponse = await axios.get(`${API_BASE_URL}/floors/${firstFloor.id}/meeting-rooms`, {
          headers: getAuthHeaders()
        });
        setMeetingRooms(roomsResponse.data.meetingRooms);
      }

    } catch (error) {
      console.error('Failed to fetch office details:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (selectedOffice) {
      fetchOfficeDetails(selectedOffice.id);
    }
  }, [selectedOffice]);

  const markNotificationAsRead = async (notificationId) => {
    try {
      await axios.put(`${API_BASE_URL}/notifications/${notificationId}/read`, {}, {
        headers: getAuthHeaders()
      });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API_BASE_URL}/notifications/mark-all-read`, {}, {
        headers: getAuthHeaders()
      });
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'booking', name: 'Book Resources', icon: Calendar },
    { id: 'attendance', name: 'Check In/Out', icon: UserCheck }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">SmartOffice Pro</h1>
                  <p className="text-sm text-gray-600">AI-Powered Workplace Management</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Office Selector */}
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                <select
                  value={selectedOffice?.id || ''}
                  onChange={(e) => {
                    const office = offices.find(o => o.id === parseInt(e.target.value));
                    setSelectedOffice(office);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {offices.map(office => (
                    <option key={office.id} value={office.id}>{office.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => !notification.isRead && markNotificationAsRead(notification.id)}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                              !notification.isRead ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                !notification.isRead ? 'bg-blue-500' : 'bg-gray-300'
                              }`} />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {new Date(notification.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No notifications yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* User Info */}
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user.name || 'User'}</p>
                  <p className="text-xs text-gray-500">{user.role || 'Employee'} • {user.organization || 'Company'}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <button
                  onClick={onLogout}
                  className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <OverviewTab 
                offices={offices}
                occupancy={currentOccupancy}
                myBookings={myBookings}
                selectedOffice={selectedOffice}
                setActiveTab={setActiveTab}
              />
            </motion.div>
          )}

          {activeTab === 'booking' && (
            <motion.div
              key="booking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <BookingTab 
                floors={floors}
                desks={desks}
                meetingRooms={meetingRooms}
                user={user}
              />
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div
              key="attendance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <AttendanceTab 
                desks={desks}
                floors={floors}
                user={user}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ offices, occupancy, myBookings, selectedOffice, setActiveTab }) => {
  const occupancyData = occupancy.occupancy || {};

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Occupancy</p>
              <p className="text-2xl font-bold text-blue-600">{occupancy.totalActive || 0}</p>
              <p className="text-xs text-gray-500">Active employees</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Desk Utilization</p>
              <p className="text-2xl font-bold text-green-600">
                {selectedOffice && occupancyData[selectedOffice.id] 
                  ? Math.round(occupancyData[selectedOffice.id].utilizationRate)
                  : 0}%
              </p>
              <p className="text-xs text-gray-500">Current usage</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Monitor className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">My Bookings</p>
              <p className="text-2xl font-bold text-orange-600">
                {myBookings.length}
              </p>
              <p className="text-xs text-gray-500">Active bookings</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available Desks</p>
              <p className="text-2xl font-bold text-purple-600">
                {selectedOffice && occupancyData[selectedOffice.id] 
                  ? (occupancyData[selectedOffice.id].totalDesks || 0) - (occupancyData[selectedOffice.id].occupiedDesks || 0)
                  : 0}
              </p>
              <p className="text-xs text-gray-500">Ready to book</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Monitor className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Office Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Office Overview */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Office Status</h3>
          <div className="space-y-4">
            {offices.map(office => {
              const officeOccupancy = occupancyData[office.id] || {};
              return (
                <div key={office.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{office.name}</p>
                      <p className="text-sm text-gray-600">{officeOccupancy.currentEmployees || 0} employees present</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {officeOccupancy.occupiedDesks || 0}/{officeOccupancy.totalDesks || 0}
                    </p>
                    <p className="text-sm text-gray-600">desks occupied</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* My Bookings */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Upcoming Bookings</h3>
          <div className="space-y-3">
            {myBookings.length > 0 ? (
              myBookings.slice(0, 5).map((booking, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {booking.type === 'desk' ? (
                      <Monitor className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Video className="w-5 h-5 text-green-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {booking.type === 'desk' ? `Desk ${booking.resource.number}` : booking.title}
                      </p>
                      <p className="text-xs text-gray-600">{booking.resource.floorName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">
                      {new Date(booking.startDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(booking.startDate).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500 mb-2">No bookings yet</p>
                <p className="text-xs text-gray-400">Book a desk or meeting room to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setActiveTab('booking')}
            className="flex flex-col items-center space-y-2 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Calendar className="w-8 h-8 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Book Today</span>
            <span className="text-xs text-blue-700">Find available desks</span>
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className="flex flex-col items-center space-y-2 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <UserCheck className="w-8 h-8 text-green-600" />
            <span className="text-sm font-medium text-green-900">Quick Check-in</span>
            <span className="text-xs text-green-700">Start your day</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// BookingTab is now imported from separate component file

// AttendanceTab is now imported from separate component file


export default SmartOfficeDashboard;
