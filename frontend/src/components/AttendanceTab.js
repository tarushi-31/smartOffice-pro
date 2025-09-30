import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  UserCheck, 
  Camera, 
  CheckCircle, 
  XCircle, 
  Thermometer, 
  Clock,
  MapPin,
  AlertTriangle,
  Loader2,
  Monitor,
  Building2
} from 'lucide-react';
import Webcam from 'react-webcam';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AttendanceTab = ({ desks, floors, user }) => {
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [temperature, setTemperature] = useState('');
  const [activeAttendance, setActiveAttendance] = useState(null);
  const webcamRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const captureAndCheckIn = useCallback(async () => {
    if (!webcamRef.current || !selectedDesk) return;

    setLoading(true);
    const imageSrc = webcamRef.current.getScreenshot();
    
    try {
      const response = await axios.post(`${API_BASE_URL}/attendance/check-in`, {
        deskId: selectedDesk.id,
        imageData: imageSrc,
        temperature: parseFloat(temperature) || (36.5 + Math.random() * 0.5)
      }, {
        headers: getAuthHeaders()
      });

      setAttendanceResult(response.data);
      setActiveAttendance(response.data.attendance);
      toast.success('Check-in successful!');
      setShowCamera(false);
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedDesk, temperature]);

  const checkOut = async () => {
    if (!activeAttendance) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/attendance/check-out`, {
        attendanceId: activeAttendance.id
      }, {
        headers: getAuthHeaders()
      });

      toast.success('Check-out successful!');
      setActiveAttendance(null);
      setAttendanceResult(null);
    } catch (error) {
      console.error('Check-out error:', error);
      toast.error('Check-out failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDeskLocation = (desk) => {
    const floor = floors.find(f => f.id === desk.floorId);
    return floor ? `${floor.name} - Desk ${desk.number}` : `Desk ${desk.number}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <UserCheck className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Employee Check-In/Out</h2>
            <p className="text-gray-600">Smart access control with face mask detection</p>
          </div>
        </div>
      </div>

      {/* Active Attendance Status */}
      {activeAttendance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-900">Currently Checked In</h3>
                <p className="text-green-700">
                  {getDeskLocation(desks.find(d => d.id === activeAttendance.deskId))}
                </p>
                <p className="text-sm text-green-600">
                  Checked in: {new Date(activeAttendance.checkIn).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <button
              onClick={checkOut}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Out'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Desk Selection */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Your Desk</h3>
        
        {!selectedDesk ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {desks.filter(desk => desk.status === 'available').map(desk => (
              <button
                key={desk.id}
                onClick={() => setSelectedDesk(desk)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <Monitor className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">Desk {desk.number}</p>
                    <p className="text-sm text-gray-600">{getDeskLocation(desk)}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {desk.hasMonitor && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Monitor</span>}
                      {desk.hasStandingDesk && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Standing</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Monitor className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Desk {selectedDesk.number}</p>
                  <p className="text-sm text-gray-600">{getDeskLocation(selectedDesk)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDesk(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                Change
              </button>
            </div>

            {/* Temperature Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Body Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="36.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Camera Section */}
            {!showCamera ? (
              <button
                onClick={() => setShowCamera(true)}
                className="w-full flex items-center justify-center space-x-2 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span>Start Check-In with Camera</span>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    className="w-full h-96 object-cover"
                    videoConstraints={{
                      width: 1280,
                      height: 720,
                      facingMode: "user"
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-white">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">LIVE</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowCamera(false)}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={captureAndCheckIn}
                        disabled={loading}
                        className="px-4 py-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-900 rounded-lg font-semibold transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing...</span>
                          </div>
                        ) : (
                          'Check In'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Safety Check</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    The system will check for proper face mask usage and record your temperature for safety compliance.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Check-In Results */}
      {attendanceResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-6 ${
            attendanceResult.maskCompliance 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-center space-x-3 mb-4">
            {attendanceResult.maskCompliance ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <XCircle className="w-8 h-8 text-red-600" />
            )}
            <div>
              <h3 className={`text-lg font-semibold ${
                attendanceResult.maskCompliance ? 'text-green-900' : 'text-red-900'
              }`}>
                {attendanceResult.maskCompliance ? 'Check-In Successful' : 'Safety Violation Detected'}
              </h3>
              <p className={`text-sm ${
                attendanceResult.maskCompliance ? 'text-green-700' : 'text-red-700'
              }`}>
                {attendanceResult.maskCompliance 
                  ? 'Face mask compliance verified. Welcome to the office!'
                  : 'Face mask compliance not detected. Please ensure proper safety measures.'
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Thermometer className="w-4 h-4 text-gray-600" />
              <span>Temperature: {attendanceResult.attendance.temperature.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span>Check-in: {new Date(attendanceResult.attendance.checkIn).toLocaleTimeString()}</span>
            </div>
          </div>

          {!attendanceResult.maskCompliance && (
            <div className="mt-4 p-3 bg-red-100 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Alert:</strong> A safety violation has been recorded. Please ensure proper face mask usage.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Instructions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Monitor className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">1. Select Desk</h4>
            <p className="text-sm text-gray-600">Choose your assigned desk from available options</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Camera className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">2. Camera Check</h4>
            <p className="text-sm text-gray-600">AI verifies face mask compliance and records temperature</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">3. Access Granted</h4>
            <p className="text-sm text-gray-600">Complete check-in and start your work session</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTab;
