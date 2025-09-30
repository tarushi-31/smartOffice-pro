import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Plus, 
  MapPin, 
  Clock, 
  Users, 
  Monitor,
  Video,
  Building2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const BookingTab = ({ floors, desks, meetingRooms, user }) => {
  const [activeBookingType, setActiveBookingType] = useState('desk');
  const [selectedResource, setSelectedResource] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingForm, setBookingForm] = useState({
    startDate: '',
    endDate: '',
    title: '',
    description: '',
    attendees: 1
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchMyBookings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/bookings/my-bookings`, {
        headers: getAuthHeaders()
      });
      setMyBookings(response.data.bookings);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedResource) return;

    setLoading(true);
    try {
      const endpoint = activeBookingType === 'desk' ? 'desk' : 'meeting-room';
      const payload = {
        [activeBookingType === 'desk' ? 'deskId' : 'roomId']: selectedResource.id,
        startDate: bookingForm.startDate,
        endDate: bookingForm.endDate,
        ...(activeBookingType === 'meeting' && {
          title: bookingForm.title,
          description: bookingForm.description,
          attendees: bookingForm.attendees
        })
      };

      await axios.post(`${API_BASE_URL}/bookings/${endpoint}`, payload, {
        headers: getAuthHeaders()
      });

      toast.success(`${activeBookingType === 'desk' ? 'Desk' : 'Meeting room'} booked successfully!`);
      setShowBookingForm(false);
      setSelectedResource(null);
      setBookingForm({
        startDate: '',
        endDate: '',
        title: '',
        description: '',
        attendees: 1
      });
      fetchMyBookings();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await axios.put(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {}, {
        headers: getAuthHeaders()
      });
      toast.success('Booking cancelled successfully!');
      fetchMyBookings();
    } catch (error) {
      toast.error('Failed to cancel booking');
    }
  };

  const getResourceLocation = (resource, type) => {
    const floor = floors.find(f => f.id === resource.floorId);
    return floor ? `${floor.name} - ${type === 'desk' ? `Desk ${resource.number}` : resource.name}` : resource.name;
  };

  const availableResources = activeBookingType === 'desk' 
    ? desks.filter(desk => desk.status === 'available')
    : meetingRooms.filter(room => room.status === 'available');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Calendar className="w-8 h-8 text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Resource Booking</h2>
            <p className="text-gray-600">Book desks and meeting rooms for your work</p>
          </div>
        </div>

        {/* Booking Type Selector */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => {
              setActiveBookingType('desk');
              setSelectedResource(null);
              setShowBookingForm(false);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
              activeBookingType === 'desk'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Book Desk</span>
          </button>
          <button
            onClick={() => {
              setActiveBookingType('meeting');
              setSelectedResource(null);
              setShowBookingForm(false);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
              activeBookingType === 'meeting'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Book Meeting Room</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Selection */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Available {activeBookingType === 'desk' ? 'Desks' : 'Meeting Rooms'}
          </h3>
          
          {availableResources.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No available {activeBookingType === 'desk' ? 'desks' : 'meeting rooms'} at the moment</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {availableResources.map((resource) => (
                <button
                  key={resource.id}
                  onClick={() => {
                    setSelectedResource(resource);
                    setShowBookingForm(true);
                  }}
                  className="w-full p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {activeBookingType === 'desk' ? (
                        <Monitor className="w-6 h-6 text-purple-600" />
                      ) : (
                        <Video className="w-6 h-6 text-purple-600" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {activeBookingType === 'desk' ? `Desk ${resource.number}` : resource.name}
                        </p>
                        <p className="text-sm text-gray-600">{getResourceLocation(resource, activeBookingType)}</p>
                        {activeBookingType === 'meeting' && (
                          <p className="text-xs text-gray-500">Capacity: {resource.capacity} people</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {resource.hasMonitor && activeBookingType === 'desk' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Monitor</span>
                      )}
                      {resource.hasProjector && activeBookingType === 'meeting' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Projector</span>
                      )}
                      {resource.hasVideoConference && activeBookingType === 'meeting' && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Video Conf</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Booking Form */}
        <AnimatePresence>
          {showBookingForm && selectedResource && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Book {activeBookingType === 'desk' ? 'Desk' : 'Meeting Room'}
                </h3>
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setSelectedResource(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  {activeBookingType === 'desk' ? (
                    <Monitor className="w-5 h-5 text-purple-600" />
                  ) : (
                    <Video className="w-5 h-5 text-purple-600" />
                  )}
                  <span className="font-medium text-purple-900">
                    {activeBookingType === 'desk' ? `Desk ${selectedResource.number}` : selectedResource.name}
                  </span>
                </div>
                <p className="text-sm text-purple-700 mt-1">{getResourceLocation(selectedResource, activeBookingType)}</p>
              </div>

              <form onSubmit={handleBooking} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={bookingForm.startDate}
                      onChange={(e) => setBookingForm({...bookingForm, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={bookingForm.endDate}
                      onChange={(e) => setBookingForm({...bookingForm, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {activeBookingType === 'meeting' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Title</label>
                      <input
                        type="text"
                        required
                        value={bookingForm.title}
                        onChange={(e) => setBookingForm({...bookingForm, title: e.target.value})}
                        placeholder="e.g., Team Standup, Client Meeting"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                      <textarea
                        value={bookingForm.description}
                        onChange={(e) => setBookingForm({...bookingForm, description: e.target.value})}
                        rows={2}
                        placeholder="Meeting agenda or notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Expected Attendees</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedResource.capacity}
                        value={bookingForm.attendees}
                        onChange={(e) => setBookingForm({...bookingForm, attendees: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Max capacity: {selectedResource.capacity} people</p>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBookingForm(false);
                      setSelectedResource(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Booking...' : 'Confirm Booking'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My Bookings */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Bookings</h3>
          
          {myBookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">You haven't made any bookings yet</p>
              <p className="text-sm text-gray-400">Select a desk or meeting room above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {booking.type === 'desk' ? (
                      <Monitor className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Video className="w-5 h-5 text-green-600" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {booking.type === 'desk' ? `Desk ${booking.resource.number}` : booking.title}
                      </p>
                      <p className="text-sm text-gray-600">{booking.resource.floorName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(booking.startDate).toLocaleDateString()} • {new Date(booking.startDate).toLocaleTimeString()} - {new Date(booking.endDate).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {booking.status}
                    </span>
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingTab;


