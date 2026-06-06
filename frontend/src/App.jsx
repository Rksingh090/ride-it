import React, { useState, useEffect, useRef } from 'react';
import Map from './components/Map';
import { 
  ShieldAlert, 
  MapPin, 
  Navigation, 
  Layers, 
  Car, 
  User, 
  Unlock, 
  Activity, 
  DollarSign,
  CheckCircle2,
  Info,
  CircleDot,
  LogOut,
  Check,
  ArrowRight,
  Search,
  Plus,
  Compass,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

// Predefined landmark points for Bangalore, San Francisco, and Mumbai for the search feature
const landmarkData = {
  "Bangalore": [
    { name: "Kempegowda International Airport (BLR)", lat: 13.1986, lng: 77.7066 },
    { name: "Majestic (KSR Bengaluru Station)", lat: 12.9779, lng: 77.5730 },
    { name: "Indiranagar Metro Station", lat: 12.9784, lng: 77.6408 },
    { name: "Koramangala Sony World Junction", lat: 12.9348, lng: 77.6258 },
    { name: "Cubbon Park", lat: 12.9738, lng: 77.5913 },
    { name: "Lalbagh Botanical Garden", lat: 12.9507, lng: 77.5844 },
    { name: "Whitefield (ITPB)", lat: 12.9866, lng: 77.7381 },
    { name: "Electronic City Phase 1", lat: 12.8496, lng: 77.6804 }
  ],
  "San Francisco": [
    { name: "San Francisco International Airport (SFO)", lat: 37.6213, lng: -122.3790 },
    { name: "Golden Gate Bridge", lat: 37.8199, lng: -122.4783 },
    { name: "Fisherman's Wharf", lat: 37.8080, lng: -122.4177 },
    { name: "Union Square", lat: 37.7876, lng: -122.4074 },
    { name: "Coit Tower", lat: 37.8024, lng: -122.4058 },
    { name: "Chinatown", lat: 37.7941, lng: -122.4078 },
    { name: "Lombard Street", lat: 37.8021, lng: -122.4187 },
    { name: "SOMA (South of Market)", lat: 37.7785, lng: -122.4056 }
  ],
  "Mumbai": [
    { name: "Chhatrapati Shivaji Maharaj Airport (BOM)", lat: 19.0896, lng: 72.8656 },
    { name: "Gateway of India", lat: 18.9220, lng: 72.8347 },
    { name: "Marine Drive", lat: 18.9430, lng: 72.8228 },
    { name: "Bandra-Worli Sea Link", lat: 19.0252, lng: 72.8170 },
    { name: "Juhu Beach", lat: 19.0988, lng: 72.8264 },
    { name: "Siddhivinayak Temple", lat: 19.0166, lng: 72.8302 },
    { name: "Nariman Point", lat: 18.9256, lng: 72.8242 }
  ]
};

const allLandmarks = Object.entries(landmarkData).flatMap(([city, items]) => 
  items.map(item => ({ ...item, city }))
);

const vehicleDetails = {
  bike: { label: "Car/Bike Taxi", emoji: "🏍️", desc: "Eco-friendly, fast commuting" },
  sedan: { label: "Standard Sedan", emoji: "🚗", desc: "Comfortable everyday sedan rides" },
  suv: { label: "Premium SUV", emoji: "🚙", desc: "Spacious luxury for groups" },
  auto: { label: "Auto Rickshaw", emoji: "🛺", desc: "Classic street cruising" }
};

export default function App() {
  // Authentication & Session states
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userProfile, setUserProfile] = useState(JSON.parse(localStorage.getItem('userProfile')) || null);
  const [driverProfile, setDriverProfile] = useState(JSON.parse(localStorage.getItem('driverProfile')) || null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);

  // App settings/lists loaded from backend
  const [cities, setCities] = useState([]);
  const [driversList, setDriversList] = useState([]); // Admin list of drivers

  // Landing Page flow states
  const [selectedRole, setSelectedRole] = useState('rider'); // 'rider', 'driver', 'admin'
  const [loginEmail, setLoginEmail] = useState('');
  
  // Registration form states
  const [riderForm, setRiderForm] = useState({ name: '', email: '', phone: '' });
  const [driverForm, setDriverForm] = useState({
    name: '', email: '', phone: '', vehicleType: 'sedan', vehicleNumber: '',
    baseFare: '5.00', perKmRate: '2.00', vehicleImage: 'sedan'
  });

  // Rider states
  const [pickup, setPickup] = useState(null); // { Latitude, Longitude, name }
  const [dropoff, setDropoff] = useState(null); // { Latitude, Longitude, name }
  const [riderSelectionMode, setRiderSelectionMode] = useState('pickup'); // 'pickup' or 'dropoff'
  const [vehicleType, setVehicleType] = useState('sedan');
  const [activeTrip, setActiveTrip] = useState(null); 
  const [riderLogs, setRiderLogs] = useState([]);
  
  // Rider location search states
  const [pickupSearchText, setPickupSearchText] = useState('');
  const [dropoffSearchText, setDropoffSearchText] = useState('');
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [isChooseOnMapActive, setIsChooseOnMapActive] = useState(false);

  // Driver states
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [driverLocation, setDriverLocation] = useState({ Latitude: 12.9716, Longitude: 77.5946 }); // Bangalore default
  const [driverTripOffer, setDriverTripOffer] = useState(null); 
  const [driverActiveTrip, setDriverActiveTrip] = useState(null); 
  const [driverLogs, setDriverLogs] = useState([]);

  // Admin states
  const [adminTab, setAdminTab] = useState('drivers'); // 'drivers' or 'cities'
  const [cityName, setCityName] = useState('Bangalore');
  const [cityBaseFare, setCityBaseFare] = useState('50.00');
  const [cityPerKmRate, setCityPerKmRate] = useState('15.00');
  const [cityCommissionRate, setCityCommissionRate] = useState('10.00');
  const [cityCurrency, setCityCurrency] = useState('INR'); // USD or INR
  const [cityMatchingRadius, setCityMatchingRadius] = useState('8.00'); // in km
  const [cityAllowedVehicles, setCityAllowedVehicles] = useState(['bike', 'sedan', 'suv', 'auto']);
  const [polygonPoints, setPolygonPoints] = useState([]); // Array of [lat, lng]

  // WebSocket references
  const riderWS = useRef(null);
  const driverWS = useRef(null);
  const driverUpdateInterval = useRef(null);

  // System logs
  const [systemLogs, setSystemLogs] = useState([]);

  const addSystemLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Helper to load operational cities list
  const fetchCities = async () => {
    try {
      const resp = await fetch('/api/cities');
      if (resp.ok) {
        const data = await resp.json();
        setCities(data || []);
      }
    } catch (err) {
      console.error("Error fetching cities: ", err);
    }
  };

  // Helper to load registered drivers list (admin-only)
  const fetchDrivers = async (jwtToken) => {
    try {
      const resp = await fetch('/api/admin/drivers', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setDriversList(data || []);
      }
    } catch (err) {
      console.error("Error fetching drivers list: ", err);
    }
  };

  useEffect(() => {
    fetchCities();
    if (isLoggedIn && token && userProfile?.role === 'admin') {
      fetchDrivers(token);
    }
  }, [isLoggedIn, token, userProfile]);

  // Session Login Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail) return;
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          alert("Account not found. Please register as a Rider or Driver below!");
          return;
        }
        throw new Error('Authentication failed');
      }
      const data = await resp.json();
      
      setToken(data.token);
      setUserProfile(data.user);
      setDriverProfile(data.driver || null);
      setIsLoggedIn(true);

      localStorage.setItem('token', data.token);
      localStorage.setItem('userProfile', JSON.stringify(data.user));
      localStorage.setItem('driverProfile', JSON.stringify(data.driver || null));

      addSystemLog(`Logged in successfully: ${data.user.name} (${data.user.role.toUpperCase()})`);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleRegisterRider = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/auth/register-rider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riderForm),
      });
      if (!resp.ok) throw new Error('Registration failed');
      const data = await resp.json();
      alert(`Rider account registered successfully! Logging in as ${data.name}...`);
      
      // Auto login after registration
      setLoginEmail(data.email);
      const loginResp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      const loginData = await loginResp.json();
      setToken(loginData.token);
      setUserProfile(loginData.user);
      setDriverProfile(null);
      setIsLoggedIn(true);
      localStorage.setItem('token', loginData.token);
      localStorage.setItem('userProfile', JSON.stringify(loginData.user));
      localStorage.setItem('driverProfile', null);
      
      setRiderForm({ name: '', email: '', phone: '' });
    } catch (err) {
      alert('Rider registration failed: ' + err.message);
    }
  };

  const handleRegisterDriver = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: driverForm.name,
        email: driverForm.email,
        phone: driverForm.phone,
        vehicle_type: driverForm.vehicleType,
        vehicle_number: driverForm.vehicleNumber,
        base_fare: parseFloat(driverForm.baseFare),
        per_km_rate: parseFloat(driverForm.perKmRate),
        vehicle_image: driverForm.vehicleImage
      };
      
      const resp = await fetch('/api/auth/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('Registration failed');
      const data = await resp.json();
      alert(`Driver profile registered successfully! Note: Your account is currently PENDING admin approval. You can log in to view status.`);
      
      setLoginEmail(payload.email);
      setDriverForm({
        name: '', email: '', phone: '', vehicleType: 'sedan', vehicleNumber: '',
        baseFare: '5.00', perKmRate: '2.00', vehicleImage: 'sedan'
      });
    } catch (err) {
      alert('Driver registration failed: ' + err.message);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUserProfile(null);
    setDriverProfile(null);
    setIsLoggedIn(false);
    localStorage.clear();
    disconnectRiderWS();
    disconnectDriverWS();
    addSystemLog('Session logged out');
    
    // Reset inputs
    setPickup(null);
    setDropoff(null);
    setActiveTrip(null);
    setDriverActiveTrip(null);
    setDriverTripOffer(null);
    setIsDriverOnline(false);
  };

  // WebSocket Rider Connection
  const connectRiderWS = (jwtToken, id) => {
    disconnectRiderWS();
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${loc.host}/ws/rider?id=${id}&token=${jwtToken}`;
    addSystemLog(`Connecting Rider WebSocket client: ${id}...`);

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => addSystemLog('Rider WebSocket connection established.');
    ws.onclose = () => addSystemLog('Rider WebSocket disconnected.');
    ws.onerror = (e) => addSystemLog('Rider WebSocket connection error.');
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        addSystemLog(`Rider WS Message: ${payload.event}`);
        
        if (payload.event === 'ride_accepted') {
          setActiveTrip(prev => ({ 
            ...prev, 
            status: 'accepted', 
            driver_id: payload.driver_id,
            fare: payload.fare 
          }));
          setRiderLogs(prev => [...prev, `Ride accepted by driver! Custom driver rates applied. Final Fare: ${getCurrencySymbol()}${payload.fare.toFixed(2)}`]);
        } else if (payload.event === 'driver_location') {
          setDriverLocation({ Latitude: payload.latitude, Longitude: payload.longitude });
          setRiderLogs(prev => [...prev, `Driver GPS update: (${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)})`]);
        } else if (payload.event === 'driver_arrived') {
          setActiveTrip(prev => ({ ...prev, status: 'arrived' }));
          setRiderLogs(prev => [...prev, "Driver has arrived at your pickup point!"]);
        } else if (payload.event === 'ride_started') {
          setActiveTrip(prev => ({ ...prev, status: 'en_route' }));
          setRiderLogs(prev => [...prev, "Trip started! En route to destination."]);
        } else if (payload.event === 'ride_completed') {
          setActiveTrip(prev => ({ ...prev, status: 'completed', fare: payload.fare }));
          setRiderLogs(prev => [...prev, `Trip completed. Hope you had a nice ride! Final charged: ${getCurrencySymbol()}${payload.fare.toFixed(2)}`]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    riderWS.current = ws;
  };

  const disconnectRiderWS = () => {
    if (riderWS.current) {
      riderWS.current.close();
      riderWS.current = null;
    }
  };

  // WebSocket Driver Connection
  const connectDriverWS = (jwtToken, id) => {
    disconnectDriverWS();
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${loc.host}/ws/driver?id=${id}&token=${jwtToken}`;
    addSystemLog(`Connecting Driver WebSocket client: ${id}...`);

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => addSystemLog('Driver WebSocket connection established. Status: ONLINE');
    ws.onclose = () => {
      addSystemLog('Driver WebSocket disconnected. Status: OFFLINE');
      stopDriverSimulation();
    };
    ws.onerror = (e) => addSystemLog('Driver WebSocket connection error.');
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        addSystemLog(`Driver WS Message: ${payload.event}`);
        
        if (payload.event === 'ride_offer') {
          setDriverTripOffer(payload);
          setDriverLogs(prev => [...prev, `Received ride request offer! Trip fare: ${getCurrencySymbol()}${payload.fare.toFixed(2)}`]);
        } else if (payload.event === 'ride_completed') {
          setDriverActiveTrip(prev => ({ ...prev, status: 'completed' }));
          setDriverLogs(prev => [...prev, "Trip completed. Payment captured."]);
          setDriverTripOffer(null);
          stopDriverSimulation();
        }
      } catch (err) {
        console.error(err);
      }
    };
    driverWS.current = ws;
  };

  const disconnectDriverWS = () => {
    if (driverWS.current) {
      driverWS.current.close();
      driverWS.current = null;
    }
    stopDriverSimulation();
  };

  const stopDriverSimulation = () => {
    if (driverUpdateInterval.current) {
      clearInterval(driverUpdateInterval.current);
      driverUpdateInterval.current = null;
    }
  };

  // Handle online/offline toggle for approved drivers
  const handleDriverOnlineToggle = () => {
    if (!driverProfile?.is_approved) {
      alert("Your profile is pending admin approval. You cannot go online.");
      return;
    }
    if (isDriverOnline) {
      disconnectDriverWS();
      setIsDriverOnline(false);
    } else {
      connectDriverWS(token, userProfile.id);
      setIsDriverOnline(true);
      // Stream initial coordinates
      setTimeout(() => {
        if (driverWS.current && driverWS.current.readyState === WebSocket.OPEN) {
          driverWS.current.send(JSON.stringify({ latitude: driverLocation.Latitude, longitude: driverLocation.Longitude }));
        }
      }, 1000);
    }
  };

  // Auto connect/disconnect sockets on login/logout
  useEffect(() => {
    if (isLoggedIn && token && userProfile) {
      if (userProfile.role === 'rider') {
        connectRiderWS(token, userProfile.id);
      }
    }
    return () => {
      disconnectRiderWS();
      disconnectDriverWS();
    };
  }, [isLoggedIn, token, userProfile]);

  // Map click handling
  const handleMapClick = (lat, lng, riderMode) => {
    if (userProfile?.role === 'admin' && adminTab === 'cities') {
      setPolygonPoints(prev => [...prev, [lat, lng]]);
      addSystemLog(`City geofence node added: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    } else if (userProfile?.role === 'rider' && isChooseOnMapActive) {
      if (riderMode === 'pickup') {
        setPickup({ Latitude: lat, Longitude: lng, name: `Pinpoint location (${lat.toFixed(4)}, ${lng.toFixed(4)})` });
        setPickupSearchText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        addSystemLog(`Pickup pinned: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        setRiderSelectionMode('dropoff'); // Switch mode helper
      } else {
        setDropoff({ Latitude: lat, Longitude: lng, name: `Pinpoint location (${lat.toFixed(4)}, ${lng.toFixed(4)})` });
        setDropoffSearchText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        addSystemLog(`Dropoff pinned: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        setIsChooseOnMapActive(false); // Done choosing on map
      }
    } else if (userProfile?.role === 'driver' && isDriverOnline && !driverActiveTrip) {
      setDriverLocation({ Latitude: lat, Longitude: lng });
      addSystemLog(`Driver GPS manually moved: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      if (driverWS.current && driverWS.current.readyState === WebSocket.OPEN) {
        driverWS.current.send(JSON.stringify({ latitude: lat, longitude: lng }));
      }
    }
  };

  // Admin operational city save
  const saveGeofenceCity = async () => {
    if (polygonPoints.length < 3) {
      alert('Please click at least 3 points on the map to define a geofence loop.');
      return;
    }
    try {
      const closedPoints = [...polygonPoints, polygonPoints[0]];
      const geoJSON = {
        type: "Polygon",
        coordinates: [
          closedPoints.map(pt => [pt[1], pt[0]]) // GeoJSON order is [longitude, latitude]
        ]
      };

      const payload = {
        name: cityName,
        boundary: geoJSON,
        base_fare: parseFloat(cityBaseFare),
        per_km_rate: parseFloat(cityPerKmRate),
        commission_rate: parseFloat(cityCommissionRate),
        allowed_vehicle_types: cityAllowedVehicles,
        is_active: true,
        currency: cityCurrency,
        matching_radius_km: parseFloat(cityMatchingRadius)
      };

      const resp = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errMsg = await resp.text();
        throw new Error(errMsg || 'Failed to register city');
      }

      const data = await resp.json();
      addSystemLog(`Admin: Operational city geofence registered: ${data.name} (${data.currency})`);
      setPolygonPoints([]);
      fetchCities();
      alert(`City geofence ${data.name} successfully registered in database!`);
    } catch (err) {
      alert('Error creating city: ' + err.message);
    }
  };

  const handleApproveDriver = async (driverID) => {
    try {
      const resp = await fetch('/api/admin/drivers/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ driver_id: driverID })
      });
      if (!resp.ok) throw new Error('Approve failed');
      addSystemLog(`Admin: Approved driver ID ${driverID}`);
      fetchDrivers(token);
      alert("Driver successfully approved!");
    } catch (err) {
      alert("Failed to approve driver: " + err.message);
    }
  };

  // Rider booking
  const requestRide = async () => {
    if (!pickup || !dropoff) {
      alert('Please select pickup and dropoff points first.');
      return;
    }
    try {
      setRiderLogs(["Sending booking request...", "Awaiting geofenced city lookup..."]);
      const resp = await fetch('/api/rides/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rider_id: userProfile.id,
          pickup_lat: pickup.Latitude,
          pickup_lng: pickup.Longitude,
          dropoff_lat: dropoff.Latitude,
          dropoff_lng: dropoff.Longitude,
          vehicle_type: vehicleType
        })
      });

      if (!resp.ok) {
        const errMsg = await resp.text();
        throw new Error(errMsg || 'Booking hold rejected');
      }

      const trip = await resp.json();
      setActiveTrip(trip);
      setRiderLogs(prev => [
        ...prev, 
        `Operational City geofence matched (ID: ${trip.city_id})`,
        `Estimated fare hold authorized: ${getCurrencySymbol()}${trip.fare.toFixed(2)}`,
        `Searching for online, approved drivers within city search radius...`
      ]);
      addSystemLog(`Rider: Requested ride. Trip ID: ${trip.id}`);
    } catch (err) {
      setRiderLogs(prev => [...prev, `Error: ${err.message}`]);
      alert('Ride Request Failed: ' + err.message);
    }
  };

  // Driver Accept Ride
  const acceptRide = async () => {
    if (!driverTripOffer) return;
    try {
      const resp = await fetch('/api/rides/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          trip_id: driverTripOffer.trip_id,
          driver_id: userProfile.id
        })
      });

      if (!resp.ok) {
        const errMsg = await resp.text();
        throw new Error(errMsg || 'Accept failed');
      }

      const trip = await resp.json();
      setDriverActiveTrip(trip);
      setDriverTripOffer(null);
      setDriverLogs(prev => [...prev, `Trip accepted! Custom rates calculated. Navigating towards pickup.`]);
      addSystemLog(`Driver: Accepted ride. Trip ID: ${trip.id}`);

      // Start simulated movements
      simulateDriverMovement(trip);
    } catch (err) {
      alert('Failed to accept ride: ' + err.message);
    }
  };

  const simulateDriverMovement = (trip) => {
    stopDriverSimulation();
    
    let step = 0;
    const stepsToPickup = 10;
    const stepsToDropoff = 15;
    
    const startLat = driverLocation.Latitude;
    const startLng = driverLocation.Longitude;
    
    const pickupLat = trip.pickup_lat;
    const pickupLng = trip.pickup_lng;
    
    const dropoffLat = trip.dropoff_lat;
    const dropoffLng = trip.dropoff_lng;

    driverUpdateInterval.current = setInterval(() => {
      step++;
      let currentLat, currentLng;

      if (step <= stepsToPickup) {
        const ratio = step / stepsToPickup;
        currentLat = startLat + (pickupLat - startLat) * ratio;
        currentLng = startLng + (pickupLng - startLng) * ratio;
        setDriverLogs(prev => [...prev, `GPS: Simulating route to pickup [${step}/${stepsToPickup}]`]);
      } else if (step <= (stepsToPickup + stepsToDropoff)) {
        const ratio = (step - stepsToPickup) / stepsToDropoff;
        currentLat = pickupLat + (dropoffLat - pickupLat) * ratio;
        currentLng = pickupLng + (dropoffLng - pickupLng) * ratio;
        setDriverLogs(prev => [...prev, `GPS: En route to dropoff [${step - stepsToPickup}/${stepsToDropoff}]`]);
      } else {
        stopDriverSimulation();
        return;
      }

      setDriverLocation({ Latitude: currentLat, Longitude: currentLng });
      if (driverWS.current && driverWS.current.readyState === WebSocket.OPEN) {
        driverWS.current.send(JSON.stringify({ latitude: currentLat, longitude: currentLng }));
      }
    }, 1500);
  };

  const triggerDriverArrived = async () => {
    if (!driverActiveTrip) return;
    try {
      await fetch('/api/rides/arrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ trip_id: driverActiveTrip.id }),
      });
      setDriverActiveTrip(prev => ({ ...prev, status: 'arrived' }));
      setDriverLogs(prev => [...prev, "Dispatched: Arrived at pickup"]);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerDriverStartRide = async () => {
    if (!driverActiveTrip) return;
    try {
      await fetch('/api/rides/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ trip_id: driverActiveTrip.id }),
      });
      setDriverActiveTrip(prev => ({ ...prev, status: 'en_route' }));
      setDriverLogs(prev => [...prev, "Dispatched: Trip started, en route!"]);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerDriverCompleteRide = async () => {
    if (!driverActiveTrip) return;
    try {
      const resp = await fetch('/api/rides/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ trip_id: driverActiveTrip.id }),
      });
      const trip = await resp.json();
      setDriverActiveTrip(trip);
      setDriverLogs(prev => [...prev, `Dispatched: Ride completed. Fare captured: ${getCurrencySymbol()}${trip.fare.toFixed(2)}`]);
      stopDriverSimulation();
    } catch (err) {
      console.error(err);
    }
  };

  const resetRiderState = () => {
    setPickup(null);
    setDropoff(null);
    setPickupSearchText('');
    setDropoffSearchText('');
    setActiveTrip(null);
    setRiderLogs([]);
    setRiderSelectionMode('pickup');
  };

  // Helper helper to get active currency symbol based on rider/admin/driver active context
  const getCurrencySymbol = () => {
    // Check active trip first
    const tripToUse = activeTrip || driverActiveTrip || driverTripOffer;
    if (tripToUse && tripToUse.city_id) {
      const city = cities.find(c => c.id === tripToUse.city_id);
      if (city?.currency === 'INR') return '₹';
    }
    
    // Otherwise check geofence of selected pickup
    if (pickup) {
      // Find city pickup coordinate belongs to
      // Since we don't have ST_Contains client-side, we can see if user searched in landmark list
      const lm = allLandmarks.find(l => l.lat === pickup.Latitude && l.lng === pickup.Longitude);
      if (lm) {
        if (lm.city === 'Bangalore' || lm.city === 'Mumbai') return '₹';
      }
    }

    // Default based on active city configuration
    if (cityName === 'Bangalore' || cityName === 'Mumbai') return '₹';
    return '$';
  };

  // Filter landmarks based on search text
  const filteredPickupLandmarks = pickupSearchText.length > 1
    ? allLandmarks.filter(lm => lm.name.toLowerCase().includes(pickupSearchText.toLowerCase()))
    : [];

  const filteredDropoffLandmarks = dropoffSearchText.length > 1
    ? allLandmarks.filter(lm => lm.name.toLowerCase().includes(dropoffSearchText.toLowerCase()))
    : [];

  // Helper to select dynamic mock vehicle price calculations
  const calculateMockFares = () => {
    if (!pickup || !dropoff) return null;
    // Calculate approximate great-circle math distance
    const rad = Math.PI / 180;
    const lat1 = pickup.Latitude * rad;
    const lat2 = dropoff.Latitude * rad;
    const theta = (pickup.Longitude - dropoff.Longitude) * rad;
    let dist = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(theta);
    dist = Math.acos(dist) * 6371 * 1.3; // distance in km with routing factor
    if (isNaN(dist)) dist = 5.0;

    // Use default values for pricing
    const base = parseFloat(cityBaseFare) || 5.0;
    const perKm = parseFloat(cityPerKmRate) || 2.0;

    return {
      bike: base * 0.5 + (dist * perKm * 0.6),
      sedan: base + (dist * perKm),
      suv: base * 1.8 + (dist * perKm * 1.5),
      auto: base * 0.7 + (dist * perKm * 0.8)
    };
  };

  const estimatedFares = calculateMockFares();

  // RENDER COMPONENT
  return (
    <div className="w-screen h-screen flex bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* 1. LANDING VIEW: Sign In / Registration cards */}
      {!isLoggedIn && (
        <div className="w-full h-full flex flex-col md:flex-row bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-y-auto">
          
          {/* Logo Brand Panel */}
          <div className="w-full md:w-5/12 p-8 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40 backdrop-blur-3xl">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Car className="w-7 h-7 text-slate-950" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-wider bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-300 bg-clip-text text-transparent">
                  RIDEIT
                </h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                  Modern Geofenced Dispatch Engine
                </p>
              </div>
            </div>

            <div className="space-y-6 my-12">
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight text-white">
                Premium spatial transport solutions.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Experience precision routing, driver bidding, custom rates, and real-time mapping. Select a persona and log in to explore.
              </p>
            </div>

            <div className="flex items-center space-x-4 text-xs text-slate-500 font-semibold border-t border-slate-900 pt-6">
              <span className="flex items-center"><ShieldCheck className="w-4 h-4 text-emerald-400 mr-1.5" /> SECURE JWT</span>
              <span>•</span>
              <span className="flex items-center"><Compass className="w-4 h-4 text-indigo-400 mr-1.5" /> GEOMAPPING</span>
            </div>
          </div>

          {/* Form and Selection Panel */}
          <div className="flex-1 p-8 md:p-16 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-8">
            
            {/* Role Tab Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Access Persona</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'rider', label: 'Rider Console', color: 'border-emerald-500/30 text-emerald-400' },
                  { id: 'driver', label: 'Driver Telemetry', color: 'border-amber-500/30 text-amber-400' },
                  { id: 'admin', label: 'Admin Panel', color: 'border-indigo-500/30 text-indigo-400' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedRole(item.id);
                      if (item.id === 'rider') setLoginEmail('rider@rideit.com');
                      else if (item.id === 'driver') setLoginEmail('driver1@rideit.com');
                      else if (item.id === 'admin') setLoginEmail('admin@rideit.com');
                    }}
                    className={`py-3.5 px-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center space-y-2 ${selectedRole === item.id ? 'bg-slate-900 border-white text-white shadow-xl shadow-white/5 scale-105' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Login Section */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Unlock className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-slate-200">Authenticate Email Profile</span>
                </div>
                <span className="text-[10px] bg-slate-800 font-mono text-slate-400 px-2 py-0.5 rounded-full uppercase">JWT Auth</span>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Authorized Email Address</label>
                  <div className="relative">
                    <input 
                      type="email" 
                      value={loginEmail} 
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. user@rideit.com"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pl-4 pr-10 text-sm focus:outline-none focus:border-amber-500 text-slate-200"
                      required
                    />
                    <button type="submit" className="absolute right-3 top-3.5 text-amber-400 hover:text-amber-300">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
                  <span>Demo accounts pre-seeded</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (selectedRole === 'rider') setLoginEmail('rider@rideit.com');
                      else if (selectedRole === 'driver') setLoginEmail('driver1@rideit.com');
                      else if (selectedRole === 'admin') setLoginEmail('admin@rideit.com');
                    }}
                    className="text-amber-500 hover:underline"
                  >
                    Reset default email
                  </button>
                </div>
              </form>
            </div>

            {/* Registration Sections */}
            {selectedRole === 'rider' && (
              <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-4">
                <div className="text-sm font-bold text-emerald-400 flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Create Rider Account</span>
                </div>
                <form onSubmit={handleRegisterRider} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={riderForm.name}
                    onChange={(e) => setRiderForm({...riderForm, name: e.target.value})}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={riderForm.email}
                    onChange={(e) => setRiderForm({...riderForm, email: e.target.value})}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone (e.g. +15550005)" 
                    value={riderForm.phone}
                    onChange={(e) => setRiderForm({...riderForm, phone: e.target.value})}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-emerald-500 md:col-span-2"
                    required
                  />
                  <button 
                    type="submit" 
                    className="w-full md:col-span-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-xs hover:shadow-lg hover:shadow-emerald-600/10 active:scale-95 transition-all"
                  >
                    Register and Login
                  </button>
                </form>
              </div>
            )}

            {selectedRole === 'driver' && (
              <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-4">
                <div className="text-sm font-bold text-amber-400 flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Apply as Driver Partner</span>
                </div>
                <form onSubmit={handleRegisterDriver} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      value={driverForm.name}
                      onChange={(e) => setDriverForm({...driverForm, name: e.target.value})}
                      className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={driverForm.email}
                      onChange={(e) => setDriverForm({...driverForm, email: e.target.value})}
                      className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                    <input 
                      type="tel" 
                      placeholder="Phone (+1555...)" 
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm({...driverForm, phone: e.target.value})}
                      className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Vehicle Plate Number" 
                      value={driverForm.vehicleNumber}
                      onChange={(e) => setDriverForm({...driverForm, vehicleNumber: e.target.value})}
                      className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Vehicle Type</label>
                      <select 
                        value={driverForm.vehicleType} 
                        onChange={(e) => setDriverForm({...driverForm, vehicleType: e.target.value, vehicleImage: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs text-slate-200"
                      >
                        <option value="bike">Bike</option>
                        <option value="sedan">Sedan</option>
                        <option value="suv">SUV</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Base Fare ($ / ₹)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={driverForm.baseFare}
                        onChange={(e) => setDriverForm({...driverForm, baseFare: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Rate per KM</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={driverForm.perKmRate}
                        onChange={(e) => setDriverForm({...driverForm, perKmRate: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Vehicle Avatar Model</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'bike', label: 'Bike Taxi', icon: '🏍️' },
                        { id: 'sedan', label: 'Sedan Cab', icon: '🚗' },
                        { id: 'suv', label: 'Luxury SUV', icon: '🚙' },
                        { id: 'auto', label: 'Rickshaw', icon: '🛺' }
                      ].map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setDriverForm({...driverForm, vehicleImage: avatar.id})}
                          className={`py-2 rounded-xl border flex flex-col items-center justify-center text-xs transition-all ${driverForm.vehicleImage === avatar.id ? 'bg-amber-500/15 border-amber-500 text-amber-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                        >
                          <span className="text-xl mb-1">{avatar.icon}</span>
                          <span className="text-[10px] font-bold">{avatar.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-black text-xs hover:shadow-lg hover:shadow-amber-600/10 active:scale-95 transition-all"
                  >
                    Submit Application
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 2. MAIN APP VIEW (LOCKED TO PERSONA) */}
      {isLoggedIn && userProfile && (
        <div className="w-full h-full flex flex-col md:flex-row overflow-hidden relative">
          
          {/* LEFT SIDEBAR CONTROLS COLUMN */}
          <div className="w-full md:w-[480px] h-full flex flex-col border-r border-slate-900 bg-slate-950 overflow-y-auto space-y-5">
            
            {/* Universal Profile Header */}
            <div className="p-6 border-b border-slate-900 flex items-center justify-between bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg">
                  <Car className="w-6 h-6 text-slate-950" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-wider text-white">RIDEIT</h2>
                  <p className="text-[9px] text-slate-500 font-black tracking-widest uppercase">
                    {userProfile.role} mode
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 active:scale-95 transition-all"
                title="Sign Out Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Dynamic Dashboard Sidebar Panel based on Role */}
            <div className="flex-1 px-6 pb-6 space-y-5">

              {/* A. RIDER DASHBOARD */}
              {userProfile.role === 'rider' && (
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
                      <User className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-bold text-slate-200">Request Spatial Booking</span>
                    </div>

                    {/* SEARCH FOR PICKUP / DROPOFF */}
                    <div className="space-y-4 relative">
                      
                      {/* Pickup Input */}
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup Point</label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="Type pickup location landmark..."
                            value={pickupSearchText}
                            onChange={(e) => {
                              setPickupSearchText(e.target.value);
                              setShowPickupSuggestions(true);
                            }}
                            onFocus={() => {
                              setShowPickupSuggestions(true);
                              setShowDropoffSuggestions(false);
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                            disabled={!!activeTrip}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                        </div>

                        {/* Pickup Autocomplete Suggestions list */}
                        {showPickupSuggestions && filteredPickupLandmarks.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl max-h-48 overflow-y-auto z-[9999] shadow-2xl p-1.5 space-y-1">
                            {filteredPickupLandmarks.map((lm, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setPickup({ Latitude: lm.lat, Longitude: lm.lng, name: lm.name });
                                  setPickupSearchText(lm.name);
                                  setShowPickupSuggestions(false);
                                  addSystemLog(`Pickup landmark set: ${lm.name}`);
                                }}
                                className="w-full py-2 px-3 text-left rounded-lg text-xs hover:bg-slate-850 hover:text-white text-slate-300 flex items-center justify-between"
                              >
                                <span className="truncate">{lm.name}</span>
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold">{lm.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dropoff Input */}
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dropoff Point</label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="Type dropoff location landmark..."
                            value={dropoffSearchText}
                            onChange={(e) => {
                              setDropoffSearchText(e.target.value);
                              setShowDropoffSuggestions(true);
                            }}
                            onFocus={() => {
                              setShowDropoffSuggestions(true);
                              setShowPickupSuggestions(false);
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                            disabled={!!activeTrip}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                        </div>

                        {/* Dropoff Autocomplete Suggestions list */}
                        {showDropoffSuggestions && filteredDropoffLandmarks.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl max-h-48 overflow-y-auto z-[9999] shadow-2xl p-1.5 space-y-1">
                            {filteredDropoffLandmarks.map((lm, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setDropoff({ Latitude: lm.lat, Longitude: lm.lng, name: lm.name });
                                  setDropoffSearchText(lm.name);
                                  setShowDropoffSuggestions(false);
                                  addSystemLog(`Dropoff landmark set: ${lm.name}`);
                                }}
                                className="w-full py-2 px-3 text-left rounded-lg text-xs hover:bg-slate-850 hover:text-white text-slate-300 flex items-center justify-between"
                              >
                                <span className="truncate">{lm.name}</span>
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold">{lm.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Choose on Map switch */}
                      {!activeTrip && (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-slate-400 font-semibold">Or interact directly with the map:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsChooseOnMapActive(!isChooseOnMapActive);
                              setRiderSelectionMode('pickup');
                            }}
                            className={`py-1.5 px-3.5 rounded-xl border text-[11px] font-black transition-all ${isChooseOnMapActive ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'}`}
                          >
                            {isChooseOnMapActive ? `Choosing ${riderSelectionMode.toUpperCase()} on map` : 'Choose on map'}
                          </button>
                        </div>
                      )}

                    </div>

                    {/* Coordinates verification display */}
                    <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[10px] font-mono">
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="flex items-center"><CircleDot className="w-3 h-3 text-emerald-400 mr-1.5" /> Pickup:</span>
                        <span className="text-slate-300 max-w-[240px] truncate">
                          {pickup ? pickup.name : 'Not selected'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="flex items-center"><MapPin className="w-3 h-3 text-rose-500 mr-1.5" /> Dropoff:</span>
                        <span className="text-slate-300 max-w-[240px] truncate">
                          {dropoff ? dropoff.name : 'Not selected'}
                        </span>
                      </div>
                    </div>

                    {/* Vehicle Type Choice */}
                    {pickup && dropoff && !activeTrip && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choose Class & Estimated Fare</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['bike', 'sedan', 'suv', 'auto'].map((cType) => {
                            const fare = estimatedFares ? estimatedFares[cType] : 0;
                            return (
                              <button
                                key={cType}
                                type="button"
                                onClick={() => setVehicleType(cType)}
                                className={`p-2.5 rounded-xl border text-left transition-all ${vehicleType === cType ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-400'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-lg">{vehicleDetails[cType].emoji}</span>
                                  <span className="text-xs font-black text-amber-400">{getCurrencySymbol()}{fare.toFixed(2)}</span>
                                </div>
                                <div className="mt-1 font-bold text-[10px] capitalize text-slate-200">{vehicleDetails[cType].label}</div>
                                <div className="text-[8px] text-slate-500 leading-tight mt-0.5">{vehicleDetails[cType].desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Request Action Button */}
                    {!activeTrip ? (
                      <button
                        onClick={requestRide}
                        disabled={!pickup || !dropoff}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-xs shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-emerald-600/10 active:scale-95 transition-all"
                      >
                        Book Ride Offer
                      </button>
                    ) : (
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center text-xs p-3 bg-slate-950 rounded-xl border border-slate-800">
                          <span className="text-slate-400">Ride Status:</span>
                          <span className="font-extrabold text-amber-400 uppercase tracking-wider animate-pulse">{activeTrip.status}</span>
                        </div>
                        {activeTrip.status === 'completed' && (
                          <button
                            onClick={resetRiderState}
                            className="w-full py-2.5 rounded-xl border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-300"
                          >
                            Order Another Ride
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rider log outputs */}
                  {riderLogs.length > 0 && (
                    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Trip State Operations</span>
                      <div className="w-full max-h-40 overflow-y-auto bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-2">
                        {riderLogs.map((logStr, i) => (
                          <p key={i} className="text-[10px] font-semibold text-emerald-400 font-mono leading-relaxed">
                            &gt; {logStr}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* B. DRIVER DASHBOARD */}
              {userProfile.role === 'driver' && (
                <div className="space-y-5">
                  
                  {/* Approval Check Alert banner */}
                  {!driverProfile?.is_approved && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
                      <div className="flex items-center space-x-2 font-bold text-sm">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
                        <span>Awaiting Admin Approval</span>
                      </div>
                      <p className="leading-relaxed">
                        Your driver profile is currently pending administrator verification. You will be able to go online and accept spatial ride requests once approved.
                      </p>
                    </div>
                  )}

                  {/* Driver control panel */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-slate-800 justify-between">
                      <div className="flex items-center space-x-2">
                        <Navigation className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-slate-200">Driver Telemetry Console</span>
                      </div>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${isDriverOnline ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                        {isDriverOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {/* Driver details and Custom pricing overview */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Vehicle details</span>
                        <span className="font-bold text-slate-300">{driverProfile?.vehicle_number} ({driverProfile?.vehicle_type})</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Base Fare</span>
                        <span className="font-bold text-slate-300">{getCurrencySymbol()}{driverProfile?.base_fare?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Per KM Rate</span>
                        <span className="font-bold text-slate-300">{getCurrencySymbol()}{driverProfile?.per_km_rate?.toFixed(2)}/km</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Avatar Class</span>
                        <span className="text-lg">{driverProfile ? vehicleDetails[driverProfile.vehicle_image]?.emoji : '🚗'}</span>
                      </div>
                    </div>

                    {/* Online Toggle button */}
                    {driverProfile?.is_approved && (
                      <button
                        onClick={handleDriverOnlineToggle}
                        className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 ${isDriverOnline ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/10' : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:shadow-amber-500/10'}`}
                      >
                        {isDriverOnline ? 'Disconnect Telemetry (Go Offline)' : 'Establish Connection (Go Online)'}
                      </button>
                    )}

                    {/* GPS Coordinates stream */}
                    {isDriverOnline && (
                      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs space-y-1">
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Driver Coordinates:</span>
                          <span className="font-mono text-amber-400 font-extrabold">{driverLocation.Latitude.toFixed(5)}, {driverLocation.Longitude.toFixed(5)}</span>
                        </div>
                        <p className="text-[9px] text-slate-500 leading-tight">
                          *To simulate movement, click anywhere inside the map area.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Active Ride Offer popup */}
                  {driverTripOffer && (
                    <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 animate-pulse space-y-3">
                      <div className="flex items-center space-x-2 text-xs font-black text-amber-400 uppercase tracking-widest">
                        <Layers className="w-4 h-4" />
                        <span>Incoming Spatial Ride Offer</span>
                      </div>
                      <div className="text-xs text-slate-400 space-y-1 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                        <p>Estimated Fare: <span className="text-emerald-400 font-extrabold text-sm">{getCurrencySymbol()}{driverTripOffer.fare.toFixed(2)}</span></p>
                        <p className="text-[10px] mt-1 text-slate-500 font-mono">Trip: {driverTripOffer.trip_id.slice(0, 8)}...</p>
                      </div>
                      <button
                        onClick={acceptRide}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all"
                      >
                        Accept Ride Offer & Recalculate
                      </button>
                    </div>
                  )}

                  {/* Accepted trip workflow steps */}
                  {driverActiveTrip && (
                    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold pb-2 border-b border-slate-800">
                        <span className="text-slate-400">Assigned Trip Status:</span>
                        <span className="text-amber-400 uppercase font-black tracking-wider">{driverActiveTrip.status}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={triggerDriverArrived}
                          disabled={driverActiveTrip.status !== 'accepted'}
                          className="py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] uppercase"
                        >
                          Arrived
                        </button>
                        <button
                          onClick={triggerDriverStartRide}
                          disabled={driverActiveTrip.status !== 'arrived'}
                          className="py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] uppercase"
                        >
                          Start
                        </button>
                        <button
                          onClick={triggerDriverCompleteRide}
                          disabled={driverActiveTrip.status !== 'en_route'}
                          className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] uppercase"
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Driver logs */}
                  {driverLogs.length > 0 && (
                    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Telemetry Event logs</span>
                      <div className="w-full max-h-40 overflow-y-auto bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-2">
                        {driverLogs.map((logStr, i) => (
                          <p key={i} className="text-[10px] font-semibold text-amber-400 font-mono leading-relaxed">
                            &gt; {logStr}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* C. ADMINISTRATOR PANEL */}
              {userProfile.role === 'admin' && (
                <div className="space-y-5">
                  
                  {/* Admin Tab Switch */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setAdminTab('drivers')}
                      className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${adminTab === 'drivers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Verify Drivers
                    </button>
                    <button
                      onClick={() => setAdminTab('cities')}
                      className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${adminTab === 'cities' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Geofence Config
                    </button>
                  </div>

                  {/* Tab 1: Verify Drivers List */}
                  {adminTab === 'drivers' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Driver Profiles</span>
                        <button 
                          onClick={() => fetchDrivers(token)}
                          className="text-[10px] text-indigo-400 font-bold hover:underline flex items-center"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                        </button>
                      </div>

                      <div className="space-y-3.5">
                        {driversList.length === 0 ? (
                          <p className="text-xs text-slate-500 italic p-3 text-center">No drivers registered yet.</p>
                        ) : (
                          driversList.map((drv) => (
                            <div key={drv.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-850 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-extrabold text-sm text-slate-200">{drv.user?.name || "Driver Profile"}</h4>
                                  <p className="text-[10px] text-slate-500">{drv.user?.email || "No Email"}</p>
                                </div>
                                <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full ${drv.is_approved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                                  {drv.is_approved ? 'Approved' : 'Pending'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px] p-2.5 bg-slate-950 rounded-xl border border-slate-850/80 font-mono text-slate-400">
                                <p>Vehicle: <span className="text-slate-200">{drv.vehicle_number}</span></p>
                                <p>Class: <span className="text-slate-200 capitalize">{drv.vehicle_type}</span></p>
                                <p>Base: <span className="text-emerald-400">{getCurrencySymbol()}{drv.base_fare?.toFixed(2)}</span></p>
                                <p>KM Rate: <span className="text-emerald-400">{getCurrencySymbol()}{drv.per_km_rate?.toFixed(2)}</span></p>
                              </div>

                              {!drv.is_approved && (
                                <button
                                  onClick={() => handleApproveDriver(drv.id)}
                                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all active:scale-95"
                                >
                                  Approve Applications
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Geofence Cities configuration */}
                  {adminTab === 'cities' && (
                    <div className="space-y-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block">City Region Name</label>
                        <select 
                          value={cityName}
                          onChange={(e) => {
                            setCityName(e.target.value);
                            // Adjust default currency & pricing defaults
                            if (e.target.value === 'San Francisco') {
                              setCityCurrency('USD');
                              setCityBaseFare('5.00');
                              setCityPerKmRate('2.00');
                              setCityMatchingRadius('5.00');
                            } else {
                              setCityCurrency('INR');
                              setCityBaseFare('50.00');
                              setCityPerKmRate('15.00');
                              setCityMatchingRadius('8.00');
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200"
                        >
                          <option value="Bangalore">Bangalore (INR)</option>
                          <option value="San Francisco">San Francisco (USD)</option>
                          <option value="Mumbai">Mumbai (INR)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Currency</label>
                          <select 
                            value={cityCurrency}
                            onChange={(e) => setCityCurrency(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs text-slate-200"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="INR">INR (₹)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Search Radius (KM)</label>
                          <input 
                            type="number"
                            step="0.5"
                            value={cityMatchingRadius}
                            onChange={(e) => setCityMatchingRadius(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Base Fare</label>
                          <input 
                            type="number" 
                            value={cityBaseFare}
                            onChange={(e) => setCityBaseFare(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Per KM</label>
                          <input 
                            type="number" 
                            value={cityPerKmRate}
                            onChange={(e) => setCityPerKmRate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Commission %</label>
                          <input 
                            type="number" 
                            value={cityCommissionRate}
                            onChange={(e) => setCityCommissionRate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Boundary Nodes Plotted:</span>
                        <span className="font-extrabold text-indigo-400 font-mono">{polygonPoints.length}</span>
                      </div>

                      {polygonPoints.length > 0 && (
                        <button
                          onClick={() => setPolygonPoints([])}
                          className="w-full py-1.5 border border-slate-850 bg-slate-950 rounded-lg hover:bg-slate-900 text-[10px] font-bold text-rose-400"
                        >
                          Clear Plotted boundary Nodes
                        </button>
                      )}

                      <button
                        onClick={saveGeofenceCity}
                        disabled={polygonPoints.length < 3}
                        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all active:scale-95"
                      >
                        Register Operational City geofence
                      </button>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Core Web logging panel at bottom */}
            <div className="flex flex-col border-t border-slate-900 p-6 space-y-3 min-h-[180px] bg-slate-950">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  <span>Telemetry Socket Event logs</span>
                </span>
                {systemLogs.length > 0 && (
                  <button 
                    onClick={() => setSystemLogs([])}
                    className="text-[9px] font-extrabold text-slate-600 hover:text-slate-400"
                  >
                    Clear Logs
                  </button>
                )}
              </div>
              <div className="flex-1 bg-slate-950 border border-slate-900 rounded-xl p-3.5 overflow-y-auto font-mono text-[9px] text-slate-500 space-y-1.5 max-h-40">
                {systemLogs.length === 0 ? (
                  <p className="italic text-slate-700">No telemetry events recorded. Perform actions to trigger streaming WebSocket activity logs.</p>
                ) : (
                  systemLogs.map((logLine, idx) => (
                    <p key={idx} className="leading-relaxed whitespace-pre-wrap">{logLine}</p>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN VIEWPORT: Map section */}
          <div className="flex-1 h-full p-6 relative bg-slate-900">
            <Map 
              mode={userProfile.role === 'admin' ? 'admin' : (userProfile.role === 'driver' ? 'driver' : 'rider')}
              cities={cities}
              pickup={pickup}
              dropoff={dropoff}
              driverLocation={
                userProfile.role === 'rider' && activeTrip && activeTrip.status !== 'completed' 
                  ? driverLocation 
                  : (userProfile.role === 'driver' ? driverLocation : null)
              }
              polygonPoints={polygonPoints}
              selectionMode={riderSelectionMode}
              onMapClick={handleMapClick}
              mapCenter={
                pickup 
                  ? [pickup.Latitude, pickup.Longitude] 
                  : (driverLocation ? [driverLocation.Latitude, driverLocation.Longitude] : [12.9716, 77.5946])
              }
            />
          </div>

        </div>
      )}

    </div>
  );
}
