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
  RefreshCw,
  Sliders,
  CreditCard,
  Clock,
  X,
  Coins,
  HelpCircle,
  ArrowUpRight,
  ArrowDownLeft
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

  // Redesign Navigation and Custom Theme States
  const [accentTheme, setAccentTheme] = useState(localStorage.getItem('accentTheme') || 'yellow');
  const [activeTab, setActiveTab] = useState(() => {
    if (userProfile?.role === 'driver') return 'telemetry';
    if (userProfile?.role === 'admin') return 'console';
    return 'book';
  });

  // Dynamic Route/Button Accent Hex code
  const getAccentHex = () => {
    if (accentTheme === 'orange') return '#f97316';
    if (accentTheme === 'green') return '#22c55e';
    return '#facc15'; // default electric yellow
  };

  // Wallet & Cards states (persisted local storage mocks)
  const [walletBalance, setWalletBalance] = useState(() => {
    const cached = localStorage.getItem('walletBalance');
    return cached ? parseFloat(cached) : 1250.00;
  });

  const saveWalletBalance = (val) => {
    setWalletBalance(val);
    localStorage.setItem('walletBalance', val.toString());
  };

  const [linkedCards, setLinkedCards] = useState(() => {
    const cached = localStorage.getItem('linkedCards');
    return cached ? JSON.parse(cached) : [
      { id: 'card_1', brand: 'Visa', last4: '4242', expiry: '12/28', holder: 'Rider Demo' },
      { id: 'card_2', brand: 'Mastercard', last4: '8899', expiry: '09/27', holder: 'Rider Demo' }
    ];
  });

  const saveLinkedCards = (cards) => {
    setLinkedCards(cards);
    localStorage.setItem('linkedCards', JSON.stringify(cards));
  };

  // Payment method option chosen: 'wallet' or 'razorpay'
  const [paymentMethod, setPaymentMethod] = useState('wallet');

  // Razorpay simulated parameters
  const [razorpayKey, setRazorpayKey] = useState(localStorage.getItem('razorpayKey') || 'rzp_test_rideit9928abc');
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [razorpayAmount, setRazorpayAmount] = useState(0);
  const [razorpayPurpose, setRazorpayPurpose] = useState(''); // 'load_wallet' or 'ride_payment'
  const [razorpayCallback, setRazorpayCallback] = useState(null);

  // Ride History state (persisted mock data + dynamic completed rides)
  const [rideHistory, setRideHistory] = useState(() => {
    const cached = localStorage.getItem('rideHistory');
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 'trip_demo_1',
        pickup: 'Kempegowda International Airport (BLR)',
        dropoff: 'Indiranagar Metro Station',
        fare: 620.00,
        currency: 'INR',
        vehicle: 'sedan',
        status: 'completed',
        date: '2026-06-05T14:30:00Z',
        driverName: 'John Doe (Sedan)'
      },
      {
        id: 'trip_demo_2',
        pickup: 'Cubbon Park',
        dropoff: 'Koramangala Sony World Junction',
        fare: 155.00,
        currency: 'INR',
        vehicle: 'bike',
        status: 'completed',
        date: '2026-06-04T10:15:00Z',
        driverName: 'Suresh Kumar (Bike)'
      },
      {
        id: 'trip_demo_3',
        pickup: 'Whitefield (ITPB)',
        dropoff: 'Electronic City Phase 1',
        fare: 350.00,
        currency: 'INR',
        vehicle: 'auto',
        status: 'cancelled',
        date: '2026-06-03T18:45:00Z',
        driverName: 'Rajesh Patil (Auto)'
      }
    ];
  });

  const addRideToHistory = (ride) => {
    setRideHistory(prev => {
      const updated = [ride, ...prev];
      localStorage.setItem('rideHistory', JSON.stringify(updated));
      return updated;
    });
  };

  // Transaction Ledger state (persisted holds, captures, payouts, loads)
  const [transactions, setTransactions] = useState(() => {
    const cached = localStorage.getItem('transactions');
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 'tx_demo_1',
        reference: 'pay_BLR_airportsedan_8293',
        tripId: 'trip_demo_1',
        amount: 620.00,
        currency: 'INR',
        type: 'capture',
        method: 'Razorpay Card',
        status: 'success',
        date: '2026-06-05T14:45:00Z'
      },
      {
        id: 'tx_demo_2',
        reference: 'pay_CUB_korabike_2938',
        tripId: 'trip_demo_2',
        amount: 155.00,
        currency: 'INR',
        type: 'capture',
        method: 'Wallet Balance',
        status: 'success',
        date: '2026-06-04T10:25:00Z'
      },
      {
        id: 'tx_demo_3',
        reference: 'hold_WTF_elecauto_9932',
        tripId: 'trip_demo_3',
        amount: 350.00,
        currency: 'INR',
        type: 'refunded',
        method: 'Wallet Balance',
        status: 'success',
        date: '2026-06-03T18:50:00Z'
      },
      {
        id: 'tx_demo_4',
        reference: 'load_wallet_initial_001',
        tripId: null,
        amount: 1250.00,
        currency: 'INR',
        type: 'wallet_load',
        method: 'Razorpay UPI',
        status: 'success',
        date: '2026-06-03T12:00:00Z'
      }
    ];
  });

  const addTransaction = (tx) => {
    setTransactions(prev => {
      const updated = [tx, ...prev];
      localStorage.setItem('transactions', JSON.stringify(updated));
      return updated;
    });
  };

  // Sync activeTab on login/role switch
  useEffect(() => {
    if (isLoggedIn && userProfile) {
      if (userProfile.role === 'rider') setActiveTab('book');
      else if (userProfile.role === 'driver') setActiveTab('telemetry');
      else if (userProfile.role === 'admin') setActiveTab('console');
    }
  }, [isLoggedIn, userProfile]);

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

  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [isPickupSearching, setIsPickupSearching] = useState(false);
  const [isDropoffSearching, setIsDropoffSearching] = useState(false);

  // Debounced API search for pickup locations
  useEffect(() => {
    if (pickupSearchText.length < 3) {
      setPickupSuggestions([]);
      return;
    }
    const isExactMatch = pickup && pickup.name === pickupSearchText;
    if (isExactMatch) return;

    const delay = setTimeout(async () => {
      setIsPickupSearching(true);
      try {
        const resp = await fetch(`/api/maps/search?q=${encodeURIComponent(pickupSearchText)}`);
        if (resp.ok) {
          const data = await resp.json();
          setPickupSuggestions(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsPickupSearching(false);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [pickupSearchText, pickup]);

  // Debounced API search for dropoff locations
  useEffect(() => {
    if (dropoffSearchText.length < 3) {
      setDropoffSuggestions([]);
      return;
    }
    const isExactMatch = dropoff && dropoff.name === dropoffSearchText;
    if (isExactMatch) return;

    const delay = setTimeout(async () => {
      setIsDropoffSearching(true);
      try {
        const resp = await fetch(`/api/maps/search?q=${encodeURIComponent(dropoffSearchText)}`);
        if (resp.ok) {
          const data = await resp.json();
          setDropoffSuggestions(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsDropoffSearching(false);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [dropoffSearchText, dropoff]);

  const fetchUserCurrentLocation = () => {
    if (!navigator.geolocation) {
      addSystemLog("Geolocation is not supported by this browser.");
      return;
    }
    addSystemLog("Requesting live user location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        addSystemLog(`User coordinates retrieved: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        
        let addressName = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
            headers: { 'Accept-Language': 'en' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              const parts = data.display_name.split(',');
              addressName = parts.slice(0, 3).join(',').trim();
            }
          }
        } catch (err) {
          console.error("OSM reverse geocoding error:", err);
        }

        setPickup({ Latitude: lat, Longitude: lng, name: addressName });
        setPickupSearchText(addressName);
        addSystemLog(`Pickup auto-set to: ${addressName}`);
      },
      (error) => {
        addSystemLog(`Geolocation error: ${error.message}`);
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Auto-fetch current location on Rider Book page load
  useEffect(() => {
    if (isLoggedIn && userProfile && userProfile.role === 'rider' && activeTab === 'book' && !pickup) {
      fetchUserCurrentLocation();
    }
  }, [isLoggedIn, userProfile, activeTab]);

  // Generate and animate nearby vehicles while booking
  useEffect(() => {
    const isBooking = isLoggedIn && userProfile?.role === 'rider' && activeTab === 'book' && (!activeTrip || activeTrip.status === 'completed');
    if (!isBooking) {
      setNearbyVehicles([]);
      return;
    }

    const refLat = pickup ? pickup.Latitude : 12.9716;
    const refLng = pickup ? pickup.Longitude : 77.5946;

    let vehicles = [
      { id: 'v1', type: 'sedan', latitude: refLat + 0.0035, longitude: refLng + 0.0042, angle: 45 },
      { id: 'v2', type: 'suv', latitude: refLat - 0.0051, longitude: refLng + 0.0031, angle: 120 },
      { id: 'v3', type: 'bike', latitude: refLat + 0.0029, longitude: refLng - 0.0063, angle: 280 },
      { id: 'v4', type: 'auto', latitude: refLat - 0.0025, longitude: refLng - 0.0039, angle: 190 }
    ];
    setNearbyVehicles(vehicles);

    const interval = setInterval(() => {
      setNearbyVehicles(prev => {
        if (prev.length === 0) return vehicles;
        return prev.map(v => {
          const deltaLat = (Math.random() - 0.5) * 0.0005;
          const deltaLng = (Math.random() - 0.5) * 0.0005;
          const newAngle = Math.atan2(deltaLat, deltaLng) * (180 / Math.PI);
          return {
            ...v,
            latitude: v.latitude + deltaLat,
            longitude: v.longitude + deltaLng,
            angle: Math.round(newAngle)
          };
        });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoggedIn, userProfile?.role, activeTab, !!activeTrip, pickup?.Latitude, pickup?.Longitude]);

  // Calculate driver ETA to pickup point
  useEffect(() => {
    if (userProfile?.role === 'rider' && activeTrip && (activeTrip.status === 'accepted' || activeTrip.status === 'arrived') && driverLocation && pickup) {
      const getETA = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${driverLocation.Longitude},${driverLocation.Latitude};${pickup.Longitude},${pickup.Latitude}?overview=false`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
              const route = data.routes[0];
              const minutes = Math.round(route.duration / 60);
              const distanceKm = (route.distance / 1000).toFixed(1);
              setDriverETA({
                minutes: minutes < 1 ? 1 : minutes,
                distanceKm: parseFloat(distanceKm)
              });
            }
          }
        } catch (err) {
          console.error("Failed to fetch OSRM ETA:", err);
        }
      };
      const timer = setTimeout(getETA, 500);
      return () => clearTimeout(timer);
    } else {
      setDriverETA(null);
    }
  }, [activeTrip?.status, driverLocation, pickup, userProfile?.role]);

  const startTrackingDriverLocation = () => {
    if (!navigator.geolocation) {
      addSystemLog("Driver GPS tracking is not supported by this browser.");
      return;
    }
    addSystemLog("Starting live Driver GPS tracking...");
    driverLocationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setDriverLocation({ Latitude: lat, Longitude: lng });
        
        if (driverWS.current && driverWS.current.readyState === WebSocket.OPEN && !driverActiveTrip) {
          driverWS.current.send(JSON.stringify({ latitude: lat, longitude: lng }));
          addSystemLog(`Driver live location streamed: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        }
      },
      (err) => {
        addSystemLog(`Driver GPS watch error: ${err.message}`);
        console.error("watchPosition error:", err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const stopTrackingDriverLocation = () => {
    if (driverLocationWatchId.current !== null) {
      navigator.geolocation.clearWatch(driverLocationWatchId.current);
      driverLocationWatchId.current = null;
      addSystemLog("Stopped live Driver GPS tracking.");
    }
  };

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
  const [selectedCityId, setSelectedCityId] = useState('');
  const [isNewCity, setIsNewCity] = useState(false);

  // Live location and ETA states
  const [nearbyVehicles, setNearbyVehicles] = useState([]);
  const [driverETA, setDriverETA] = useState(null);
  const driverLocationWatchId = useRef(null);

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
          setActiveTrip(prev => {
            const updatedTrip = { ...prev, status: 'completed', fare: payload.fare };
            
            // Log capture transaction in ledger
            const captureTx = {
              id: 'tx_' + Math.random().toString(36).substring(2, 9),
              reference: 'pay_' + (prev?.id ? prev.id.slice(0, 8) : 'capt') + '_' + Math.floor(Math.random() * 1000),
              tripId: prev?.id || 'trip_completed',
              amount: payload.fare,
              currency: getCurrencySymbol() === '₹' ? 'INR' : 'USD',
              type: 'capture',
              method: paymentMethod === 'wallet' ? 'Wallet Balance' : 'Razorpay Card',
              status: 'success',
              date: new Date().toISOString()
            };
            addTransaction(captureTx);

            // Add ride to local Ride History list
            const newHistoryItem = {
              id: prev?.id || 'trip_' + Math.random().toString(36).substring(2, 9),
              pickup: pickup ? pickup.name : 'Unknown Pickup Location',
              dropoff: dropoff ? dropoff.name : 'Unknown Dropoff Location',
              fare: payload.fare,
              currency: getCurrencySymbol() === '₹' ? 'INR' : 'USD',
              vehicle: vehicleType,
              status: 'completed',
              date: new Date().toISOString(),
              driverName: 'Dispatched Partner'
            };
            addRideToHistory(newHistoryItem);

            return updatedTrip;
          });
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
    stopTrackingDriverLocation();
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
      startTrackingDriverLocation();
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
      addSystemLog(`Admin: Operational city geofence registered/updated: ${data.name} (${data.currency})`);
      setPolygonPoints([]);
      setSelectedCityId('');
      setIsNewCity(false);
      fetchCities();
      alert(`City geofence ${data.name} successfully registered/updated in database!`);
    } catch (err) {
      alert('Error creating/updating city: ' + err.message);
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

    const fareEstimate = estimatedFares ? estimatedFares[vehicleType] : 0;
    if (paymentMethod === 'wallet' && walletBalance < fareEstimate) {
      alert(`Insufficient wallet balance. Your balance is ${getCurrencySymbol()}${walletBalance.toFixed(2)}, but the estimate is ${getCurrencySymbol()}${fareEstimate.toFixed(2)}. Please load wallet funds or choose Razorpay Card/UPI.`);
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

      // Create and log hold transaction
      const holdTx = {
        id: 'tx_' + Math.random().toString(36).substring(2, 9),
        reference: 'hold_' + trip.id.slice(0, 8) + '_' + Math.floor(Math.random() * 1000),
        tripId: trip.id,
        amount: trip.fare,
        currency: getCurrencySymbol() === '₹' ? 'INR' : 'USD',
        type: 'hold',
        method: paymentMethod === 'wallet' ? 'Wallet Balance' : 'Razorpay Checkout',
        status: 'success',
        date: new Date().toISOString()
      };
      addTransaction(holdTx);

      if (paymentMethod === 'wallet') {
        saveWalletBalance(walletBalance - trip.fare);
        addSystemLog(`Rider: Wallet Hold of ${getCurrencySymbol()}${trip.fare.toFixed(2)} authorized.`);
      } else {
        // Trigger mock Razorpay payment checkout modal
        setRazorpayAmount(trip.fare);
        setRazorpayPurpose('ride_payment');
        setShowRazorpayModal(true);
      }

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

      // Create history record for driver
      const driverRideItem = {
        id: trip.id,
        pickup: `Pickup Pinpoint`,
        dropoff: `Dropoff Pinpoint`,
        fare: trip.fare,
        currency: getCurrencySymbol() === '₹' ? 'INR' : 'USD',
        vehicle: driverProfile?.vehicle_type || 'sedan',
        status: 'completed',
        date: new Date().toISOString(),
        passengerName: 'Passenger Client'
      };
      addRideToHistory(driverRideItem);

      // Log earnings in transaction ledger (90% driver share, 10% platform commission)
      const earningsTx = {
        id: 'tx_' + Math.random().toString(36).substring(2, 9),
        reference: 'earn_' + trip.id.slice(0, 8) + '_' + Math.floor(Math.random() * 1000),
        tripId: trip.id,
        amount: trip.fare * 0.9,
        currency: getCurrencySymbol() === '₹' ? 'INR' : 'USD',
        type: 'earning',
        method: 'Platform Dispatch Payout',
        status: 'success',
        date: new Date().toISOString()
      };
      addTransaction(earningsTx);

      // Increment driver wallet balance
      saveWalletBalance(walletBalance + (trip.fare * 0.9));

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
      if (city?.currency === 'USD') return '$';
    }
    
    // Otherwise check geofence of selected pickup
    if (pickup) {
      // Find city pickup coordinate belongs to
      // Since we don't have ST_Contains client-side, we can see if user searched in landmark list
      const lm = allLandmarks.find(l => l.lat === pickup.Latitude && l.lng === pickup.Longitude);
      if (lm) {
        const matchingCity = cities.find(c => c.name.toLowerCase() === lm.city.toLowerCase());
        if (matchingCity) {
          if (matchingCity.currency === 'INR') return '₹';
          if (matchingCity.currency === 'USD') return '$';
        }
        if (lm.city === 'Bangalore' || lm.city === 'Mumbai') return '₹';
      }
    }

    // Default based on active city configuration
    const activeCityObj = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
    if (activeCityObj) {
      if (activeCityObj.currency === 'INR') return '₹';
      if (activeCityObj.currency === 'USD') return '$';
    }
    if (cityName === 'Bangalore' || cityName === 'Mumbai') return '₹';
    return '$';
  };

  const getMapPickup = () => {
    if (userProfile?.role === 'driver') {
      const activeTripOrOffer = driverActiveTrip || driverTripOffer;
      if (activeTripOrOffer) {
        return {
          Latitude: activeTripOrOffer.pickup_lat,
          Longitude: activeTripOrOffer.pickup_lng,
          name: "Rider Pickup Location"
        };
      }
      return null;
    }
    return pickup;
  };

  const getMapDropoff = () => {
    if (userProfile?.role === 'driver') {
      const activeTripOrOffer = driverActiveTrip || driverTripOffer;
      if (activeTripOrOffer) {
        return {
          Latitude: activeTripOrOffer.dropoff_lat,
          Longitude: activeTripOrOffer.dropoff_lng,
          name: "Rider Dropoff Location"
        };
      }
      return null;
    }
    return dropoff;
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
  return (
    <div className={`w-screen h-screen flex bg-zinc-950 text-zinc-100 font-sans overflow-hidden theme-${accentTheme}`}>
      
      {/* MOCK RAZORPAY CHECKOUT MODAL OVERLAY */}
      {showRazorpayModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#0c2340] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col">
            
            {/* Razorpay Header */}
            <div className="p-6 text-white flex flex-col space-y-2 relative">
              <button 
                onClick={() => setShowRazorpayModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">R</div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">RIDEIT Technologies</h3>
                  <p className="text-[10px] text-blue-300">Razorpay Secure Checkout</p>
                </div>
              </div>
              
              <div className="mt-4 pt-2 border-t border-blue-900/50 flex justify-between items-center">
                <span className="text-[10px] text-blue-200 uppercase tracking-widest font-black">
                  {razorpayPurpose === 'load_wallet' ? 'Load Wallet Credits' : 'Trip Security Hold'}
                </span>
                <span className="text-xl font-black text-emerald-400">
                  {getCurrencySymbol()}{parseFloat(razorpayAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Razorpay Body (White card) */}
            <div className="bg-white text-zinc-800 p-6 flex-1 flex flex-col space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-zinc-400 uppercase">Contact Information</label>
                <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 font-medium">
                  <span className="truncate">{userProfile?.email || 'demo@rideit.com'}</span>
                  <span className="text-right">{userProfile?.phone || '+91 9988776655'}</span>
                </div>
              </div>

              {/* simulated payment methods */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-400 uppercase">Select Payment Method</label>
                
                <div className="space-y-2">
                  {[
                    { id: 'rzp_card', label: 'Cards (Visa, Mastercard, RuPay)', desc: 'Pay via simulated credit/debit card', icon: '💳' },
                    { id: 'rzp_upi', label: 'UPI (Google Pay, PhonePe, Paytm)', desc: 'Instant transfer via simulated VPA', icon: '⚡' },
                    { id: 'rzp_net', label: 'Netbanking', desc: 'All popular banks supported', icon: '🏦' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        // Simulate payment processing on click
                        const paymentBtn = document.getElementById('rzp-pay-btn');
                        if (paymentBtn) paymentBtn.click();
                      }}
                      className="w-full p-3 text-left rounded-xl border border-zinc-200 hover:border-blue-500 hover:bg-blue-50/20 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{method.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-zinc-800">{method.label}</p>
                          <p className="text-[9px] text-zinc-400">{method.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="rzp-pay-btn"
                  onClick={() => {
                    const btn = document.getElementById('rzp-pay-btn');
                    btn.disabled = true;
                    btn.innerHTML = `<span class="animate-pulse">Authorizing securely via Razorpay...</span>`;
                    
                    setTimeout(() => {
                      btn.classList.remove('bg-emerald-600');
                      btn.classList.add('bg-blue-600');
                      btn.innerHTML = `✓ Payment Successful!`;
                      
                      setTimeout(() => {
                        setShowRazorpayModal(false);
                        
                        // Execute transaction completion logic
                        if (razorpayPurpose === 'load_wallet') {
                          saveWalletBalance(walletBalance + parseFloat(razorpayAmount));
                          addTransaction({
                            id: 'tx_' + Math.random().toString(36).substring(2, 9),
                            reference: 'load_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                            tripId: null,
                            amount: parseFloat(razorpayAmount),
                            currency: getCurrencySymbol() === '₹' ? 'INR' : 'USD',
                            type: 'wallet_load',
                            method: 'Razorpay Instant UPI',
                            status: 'success',
                            date: new Date().toISOString()
                          });
                          addSystemLog(`Razorpay: Loaded ${getCurrencySymbol()}${parseFloat(razorpayAmount).toFixed(2)} credits.`);
                        } else if (razorpayCallback) {
                          razorpayCallback();
                        }
                      }, 800);
                    }, 1200);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-md active:scale-95 text-center flex items-center justify-center"
                >
                  Pay Securely via Razorpay
                </button>
              </div>

              <div className="text-center">
                <span className="text-[9px] text-zinc-400 font-semibold flex items-center justify-center">
                  🛡️ PCI-DSS Compliant 128-bit Encryption Key: {razorpayKey.slice(0, 15)}...
                </span>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 1. LANDING VIEW: Sign In / Registration cards */}
      {!isLoggedIn && (
        <div className="w-full h-full flex flex-col md:flex-row bg-zinc-950 overflow-y-auto">
          
          {/* Left Panel - Brand */}
          <div className="w-full md:w-5/12 p-8 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-900 bg-zinc-950/40 backdrop-blur-3xl relative">
            <div className="absolute top-20 right-10 w-48 h-48 rounded-full bg-accent opacity-5 blur-[120px] pointer-events-none"></div>
            
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                <Car className="w-7 h-7 text-zinc-950" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-wider text-white">
                  RIDEIT
                </h1>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                  Modern Geofenced Dispatch Engine
                </p>
              </div>
            </div>

            <div className="space-y-6 my-12 relative z-10">
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight text-white">
                Premium spatial transport solutions.
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Experience precision routing, driver bidding, custom rates, and real-time mapping. Select a persona and log in to explore.
              </p>
            </div>

            <div className="flex items-center space-x-4 text-xs text-zinc-500 font-semibold border-t border-zinc-900 pt-6">
              <span className="flex items-center"><ShieldCheck className="w-4 h-4 text-emerald-400 mr-1.5" /> SECURE JWT</span>
              <span>•</span>
              <span className="flex items-center"><Compass className="w-4 h-4 text-accent mr-1.5" /> GEOMAPPING</span>
            </div>
          </div>

          {/* Right Panel - Auth Selection */}
          <div className="flex-1 p-8 md:p-16 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-8">
            
            {/* Role Tab Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Access Persona</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'rider', label: 'Rider Console', theme: 'border-emerald-500/30 text-emerald-400' },
                  { id: 'driver', label: 'Driver Telemetry', theme: 'border-amber-500/30 text-amber-400' },
                  { id: 'admin', label: 'Admin Panel', theme: 'border-indigo-500/30 text-indigo-400' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedRole(item.id);
                      if (item.id === 'rider') setLoginEmail('rider@rideit.com');
                      else if (item.id === 'driver') setLoginEmail('driver1@rideit.com');
                      else if (item.id === 'admin') setLoginEmail('admin@rideit.com');
                    }}
                    className={`py-3.5 px-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center space-y-2 ${selectedRole === item.id ? 'bg-zinc-900 border-accent text-white shadow-accent' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Login Card */}
            <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center space-x-2">
                  <Unlock className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold text-zinc-200">Authenticate Email Profile</span>
                </div>
                <span className="text-[10px] bg-zinc-800 font-mono text-zinc-400 px-2 py-0.5 rounded-full uppercase">JWT Auth</span>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Authorized Email Address</label>
                  <div className="relative">
                    <input 
                      type="email" 
                      value={loginEmail} 
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. user@rideit.com"
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl py-3 pl-4 pr-10 text-sm focus:outline-none focus:border-accent text-zinc-200 focus-ring-accent"
                      required
                    />
                    <button type="submit" className="absolute right-3 top-3.5 text-accent hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold px-1">
                  <span>Demo accounts pre-seeded</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (selectedRole === 'rider') setLoginEmail('rider@rideit.com');
                      else if (selectedRole === 'driver') setLoginEmail('driver1@rideit.com');
                      else if (selectedRole === 'admin') setLoginEmail('admin@rideit.com');
                    }}
                    className="text-accent hover:underline"
                  >
                    Reset default email
                  </button>
                </div>
              </form>
            </div>

            {/* Registration Sections */}
            {selectedRole === 'rider' && (
              <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 space-y-4">
                <div className="text-sm font-bold text-accent flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Create Rider Account</span>
                </div>
                <form onSubmit={handleRegisterRider} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={riderForm.name}
                    onChange={(e) => setRiderForm({...riderForm, name: e.target.value})}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200"
                    required
                  />
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={riderForm.email}
                    onChange={(e) => setRiderForm({...riderForm, email: e.target.value})}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200"
                    required
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone (e.g. +919988776655)" 
                    value={riderForm.phone}
                    onChange={(e) => setRiderForm({...riderForm, phone: e.target.value})}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200 md:col-span-2"
                    required
                  />
                  <button 
                    type="submit" 
                    className="w-full md:col-span-2 py-3 rounded-xl bg-accent bg-accent-hover text-zinc-950 font-black text-xs hover:shadow-accent transition-all active:scale-95"
                  >
                    Register and Login
                  </button>
                </form>
              </div>
            )}

            {selectedRole === 'driver' && (
              <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 space-y-4">
                <div className="text-sm font-bold text-accent flex items-center space-x-2">
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
                      className="bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200"
                      required
                    />
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={driverForm.email}
                      onChange={(e) => setDriverForm({...driverForm, email: e.target.value})}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200"
                      required
                    />
                    <input 
                      type="tel" 
                      placeholder="Phone (+91...)" 
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm({...driverForm, phone: e.target.value})}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Vehicle Plate Number" 
                      value={driverForm.vehicleNumber}
                      onChange={(e) => setDriverForm({...driverForm, vehicleNumber: e.target.value})}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold block mb-1">Vehicle Type</label>
                      <select 
                        value={driverForm.vehicleType} 
                        onChange={(e) => setDriverForm({...driverForm, vehicleType: e.target.value, vehicleImage: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs text-zinc-200 focus:outline-none focus:border-accent"
                      >
                        <option value="bike">Bike</option>
                        <option value="sedan">Sedan</option>
                        <option value="suv">SUV</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold block mb-1">Base Fare</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={driverForm.baseFare}
                        onChange={(e) => setDriverForm({...driverForm, baseFare: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-accent text-zinc-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold block mb-1">Rate per KM</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={driverForm.perKmRate}
                        onChange={(e) => setDriverForm({...driverForm, perKmRate: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-accent text-zinc-200"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold block mb-1.5">Vehicle Avatar Model</label>
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
                          className={`py-2 rounded-xl border flex flex-col items-center justify-center text-xs transition-all ${driverForm.vehicleImage === avatar.id ? 'bg-accent/15 border-accent text-accent' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                        >
                          <span className="text-xl mb-1">{avatar.icon}</span>
                          <span className="text-[10px] font-bold">{avatar.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3 rounded-xl bg-accent bg-accent-hover text-zinc-950 font-black text-xs hover:shadow-accent transition-all active:scale-95"
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
          
          {/* FAR-LEFT NAVIGATION SIDEBAR */}
          <div className="w-full md:w-20 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-row md:flex-col items-center justify-between p-4 md:py-8 z-30">
            
            {/* Header / Brand Avatar */}
            <div className="flex md:flex-col items-center space-x-3 md:space-x-0 md:space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                <Car className="w-7 h-7 text-zinc-950" />
              </div>
              <div className="hidden md:block text-center">
                <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">
                  {userProfile.role.slice(0, 5)}
                </span>
              </div>
            </div>

            {/* Middle Icons Group (Nav tabs) */}
            <div className="flex md:flex-col items-center justify-center space-x-2 md:space-x-0 md:space-y-5 flex-1 md:my-8">
              
              {/* TAB 1: BOOK RIDE / DISPATCH / TELEMETRY */}
              <button
                onClick={() => setActiveTab(userProfile.role === 'rider' ? 'book' : (userProfile.role === 'driver' ? 'telemetry' : 'console'))}
                className={`p-3 rounded-xl transition-all relative group ${
                  activeTab === 'book' || activeTab === 'telemetry' || activeTab === 'console'
                    ? 'bg-zinc-800 text-accent shadow-inner'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
                title="Dashboard Console"
              >
                {userProfile.role === 'rider' && <MapPin className="w-5 h-5" />}
                {userProfile.role === 'driver' && <Navigation className="w-5 h-5" />}
                {userProfile.role === 'admin' && <Layers className="w-5 h-5" />}
                
                {/* Active Indicator bar */}
                {(activeTab === 'book' || activeTab === 'telemetry' || activeTab === 'console') && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-accent rounded-r hidden md:block"></span>
                )}
              </button>

              {/* TAB 2: RIDE HISTORY */}
              <button
                onClick={() => setActiveTab('history')}
                className={`p-3 rounded-xl transition-all relative group ${
                  activeTab === 'history'
                    ? 'bg-zinc-800 text-accent shadow-inner'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
                title="Ride History"
              >
                <Clock className="w-5 h-5" />
                {activeTab === 'history' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-accent rounded-r hidden md:block"></span>
                )}
              </button>

              {/* TAB 3: PAYMENTS & WALLET */}
              <button
                onClick={() => setActiveTab('payment')}
                className={`p-3 rounded-xl transition-all relative group ${
                  activeTab === 'payment'
                    ? 'bg-zinc-800 text-accent shadow-inner'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
                title="Payments & Balance"
              >
                <CreditCard className="w-5 h-5" />
                {activeTab === 'payment' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-accent rounded-r hidden md:block"></span>
                )}
              </button>

              {/* TAB 4: TRANSACTION LEDGER */}
              <button
                onClick={() => setActiveTab('transactions')}
                className={`p-3 rounded-xl transition-all relative group ${
                  activeTab === 'transactions'
                    ? 'bg-zinc-800 text-accent shadow-inner'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
                title="Transactions Ledger"
              >
                <Coins className="w-5 h-5" />
                {activeTab === 'transactions' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-accent rounded-r hidden md:block"></span>
                )}
              </button>

              {/* TAB 5: SETTINGS */}
              <button
                onClick={() => setActiveTab('settings')}
                className={`p-3 rounded-xl transition-all relative group ${
                  activeTab === 'settings'
                    ? 'bg-zinc-800 text-accent shadow-inner'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
                title="System Settings"
              >
                <Sliders className="w-5 h-5" />
                {activeTab === 'settings' && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-accent rounded-r hidden md:block"></span>
                )}
              </button>

            </div>

            {/* Bottom logout */}
            <div className="flex md:flex-col items-center justify-end">
              <button
                onClick={handleLogout}
                className="p-3 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all active:scale-95"
                title="Sign Out Session"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* LEFT SIDEBAR CONTROLS COLUMN (SUB-SIDEBAR) */}
          <div className="w-full md:w-[440px] h-full flex flex-col border-r border-zinc-900 bg-zinc-950 overflow-y-auto space-y-5 select-none z-20">
            
            {/* Tab header */}
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/60 backdrop-blur-md sticky top-0 z-50">
              <div>
                <h2 className="text-xl font-black tracking-wide text-white capitalize">
                  {activeTab === 'book' ? 'Book a Ride' : (activeTab === 'telemetry' ? 'Driver Console' : (activeTab === 'console' ? 'Admin Control' : activeTab === 'history' ? 'Ride History' : activeTab === 'payment' ? 'Payments & Wallet' : activeTab === 'transactions' ? 'Transactions' : 'Theme Settings'))}
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase mt-0.5">
                  {userProfile.name} • {userProfile.role.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex-1 px-6 pb-6 space-y-5">

              {/* VIEW A: BOOK RIDE (Rider booking console) */}
              {activeTab === 'book' && userProfile.role === 'rider' && (
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-sm">
                    <div className="flex items-center space-x-2 pb-2 border-b border-zinc-850">
                      <User className="w-4 h-4 text-accent" />
                      <span className="text-sm font-bold text-zinc-200">Request Spatial Booking</span>
                    </div>

                    <div className="space-y-4 relative">
                      
                      {/* Pickup Input */}
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pickup Point</label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="Search pickup location..."
                            value={pickupSearchText}
                            onChange={(e) => {
                              setPickupSearchText(e.target.value);
                              setShowPickupSuggestions(true);
                            }}
                            onFocus={() => {
                              setShowPickupSuggestions(true);
                              setShowDropoffSuggestions(false);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 pl-4 pr-10 text-xs text-zinc-200 focus:outline-none focus:border-accent focus-ring-accent"
                            disabled={!!activeTrip}
                          />
                          <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                        </div>

                        {/* Pickup Autocomplete Suggestions list */}
                        {showPickupSuggestions && (pickupSuggestions.length > 0 || isPickupSearching || filteredPickupLandmarks.length > 0) && (
                          <div className="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl max-h-48 overflow-y-auto z-[9999] shadow-2xl p-1.5 space-y-1">
                            {isPickupSearching && (
                              <div className="p-2 text-center text-xs text-zinc-500 italic">Searching locations...</div>
                            )}
                            {!isPickupSearching && pickupSuggestions.map((lm, idx) => (
                              <button
                                key={`api-${idx}`}
                                type="button"
                                onClick={() => {
                                  setPickup({ Latitude: lm.latitude, Longitude: lm.longitude, name: lm.name });
                                  setPickupSearchText(lm.name);
                                  setShowPickupSuggestions(false);
                                  addSystemLog(`Pickup address selected: ${lm.name}`);
                                }}
                                className="w-full py-2.5 px-3 text-left rounded-lg text-xs hover:bg-zinc-800 hover:text-white text-zinc-200 flex items-center justify-between"
                              >
                                <span className="truncate mr-2">{lm.name}</span>
                                <span className="text-[8px] bg-zinc-800 text-accent px-1.5 py-0.5 rounded uppercase font-black shrink-0">GPS</span>
                              </button>
                            ))}
                            {!isPickupSearching && pickupSuggestions.length === 0 && filteredPickupLandmarks.map((lm, idx) => (
                              <button
                                key={`lm-${idx}`}
                                type="button"
                                onClick={() => {
                                  setPickup({ Latitude: lm.lat, Longitude: lm.lng, name: lm.name });
                                  setPickupSearchText(lm.name);
                                  setShowPickupSuggestions(false);
                                  addSystemLog(`Pickup landmark set: ${lm.name}`);
                                }}
                                className="w-full py-2.5 px-3 text-left rounded-lg text-xs hover:bg-zinc-800 hover:text-white text-zinc-300 flex items-center justify-between"
                              >
                                <span className="truncate mr-2">{lm.name}</span>
                                <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase font-black shrink-0">{lm.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dropoff Input */}
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dropoff Point</label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="Search dropoff location..."
                            value={dropoffSearchText}
                            onChange={(e) => {
                              setDropoffSearchText(e.target.value);
                              setShowDropoffSuggestions(true);
                            }}
                            onFocus={() => {
                              setShowDropoffSuggestions(true);
                              setShowPickupSuggestions(false);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 pl-4 pr-10 text-xs text-zinc-200 focus:outline-none focus:border-accent focus-ring-accent"
                            disabled={!!activeTrip}
                          />
                          <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                        </div>

                        {/* Dropoff Autocomplete Suggestions list */}
                        {showDropoffSuggestions && (dropoffSuggestions.length > 0 || isDropoffSearching || filteredDropoffLandmarks.length > 0) && (
                          <div className="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl max-h-48 overflow-y-auto z-[9999] shadow-2xl p-1.5 space-y-1">
                            {isDropoffSearching && (
                              <div className="p-2 text-center text-xs text-zinc-500 italic">Searching locations...</div>
                            )}
                            {!isDropoffSearching && dropoffSuggestions.map((lm, idx) => (
                              <button
                                key={`api-${idx}`}
                                type="button"
                                onClick={() => {
                                  setDropoff({ Latitude: lm.latitude, Longitude: lm.longitude, name: lm.name });
                                  setDropoffSearchText(lm.name);
                                  setShowDropoffSuggestions(false);
                                  addSystemLog(`Dropoff address selected: ${lm.name}`);
                                }}
                                className="w-full py-2.5 px-3 text-left rounded-lg text-xs hover:bg-zinc-800 hover:text-white text-zinc-200 flex items-center justify-between"
                              >
                                <span className="truncate mr-2">{lm.name}</span>
                                <span className="text-[8px] bg-zinc-800 text-accent px-1.5 py-0.5 rounded uppercase font-black shrink-0">GPS</span>
                              </button>
                            ))}
                            {!isDropoffSearching && dropoffSuggestions.length === 0 && filteredDropoffLandmarks.map((lm, idx) => (
                              <button
                                key={`lm-${idx}`}
                                type="button"
                                onClick={() => {
                                  setDropoff({ Latitude: lm.lat, Longitude: lm.lng, name: lm.name });
                                  setDropoffSearchText(lm.name);
                                  setShowDropoffSuggestions(false);
                                  addSystemLog(`Dropoff landmark set: ${lm.name}`);
                                }}
                                className="w-full py-2.5 px-3 text-left rounded-lg text-xs hover:bg-zinc-800 hover:text-white text-zinc-300 flex items-center justify-between"
                              >
                                <span className="truncate mr-2">{lm.name}</span>
                                <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase font-black shrink-0">{lm.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Map Clicking Mode Selector */}
                      {!activeTrip && (
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={fetchUserCurrentLocation}
                            className="py-1.5 px-3 rounded-xl border border-zinc-850 bg-zinc-950 text-zinc-400 hover:text-zinc-200 text-[10px] font-black transition-all flex items-center space-x-1"
                          >
                            <Compass className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Locate Me</span>
                          </button>
                          <span className="text-[10px] text-zinc-500 font-semibold">Or interact directly:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsChooseOnMapActive(!isChooseOnMapActive);
                              setRiderSelectionMode('pickup');
                            }}
                            className={`py-1.5 px-3.5 rounded-xl border text-[11px] font-black transition-all ${isChooseOnMapActive ? 'bg-accent border-accent text-zinc-950' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                          >
                            {isChooseOnMapActive ? `Pinning ${riderSelectionMode.toUpperCase()} on map` : 'Choose on map'}
                          </button>
                        </div>
                      )}

                    </div>

                    {/* Verified coordinates status bar */}
                    <div className="space-y-2 p-3 bg-zinc-950 rounded-xl border border-zinc-850/80 text-[10px] font-mono">
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className="flex items-center"><CircleDot className="w-3 h-3 text-emerald-400 mr-1.5" /> Pickup:</span>
                        <span className="text-zinc-200 max-w-[260px] truncate">
                          {pickup ? pickup.name : 'Awaiting Selection'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className="flex items-center"><MapPin className="w-3 h-3 text-rose-500 mr-1.5" /> Dropoff:</span>
                        <span className="text-zinc-200 max-w-[260px] truncate">
                          {dropoff ? dropoff.name : 'Awaiting Selection'}
                        </span>
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    {pickup && dropoff && !activeTrip && (
                      <div className="space-y-1.5 pt-2 border-t border-zinc-850">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Choose Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('wallet')}
                            className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${paymentMethod === 'wallet' ? 'bg-accent/10 border-accent text-white shadow-sm' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span>Wallet Balance</span>
                              <Coins className="w-4 h-4 text-accent" />
                            </div>
                            <span className="text-[10px] text-zinc-500 block mt-1">Available: {getCurrencySymbol()}{walletBalance.toFixed(2)}</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('razorpay')}
                            className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${paymentMethod === 'razorpay' ? 'bg-accent/10 border-accent text-white shadow-sm' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span>Razorpay Direct</span>
                              <CreditCard className="w-4 h-4 text-accent" />
                            </div>
                            <span className="text-[10px] text-zinc-500 block mt-1">Direct pay via UPI/Card</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Vehicle Type Choice with Fares */}
                    {pickup && dropoff && !activeTrip && (
                      <div className="space-y-2 pt-2 border-t border-zinc-850">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-sans">Choose Vehicle Class & Fare</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['bike', 'sedan', 'suv', 'auto'].map((cType) => {
                            const fare = estimatedFares ? estimatedFares[cType] : 0;
                            return (
                              <button
                                key={cType}
                                type="button"
                                onClick={() => setVehicleType(cType)}
                                className={`p-2.5 rounded-xl border text-left transition-all ${vehicleType === cType ? 'bg-accent/15 border-accent text-white shadow-sm' : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-900/60 text-zinc-400'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-lg">{vehicleDetails[cType].emoji}</span>
                                  <span className="text-xs font-black text-accent">{getCurrencySymbol()}{fare.toFixed(2)}</span>
                                </div>
                                <div className="mt-1 font-bold text-[10px] capitalize text-zinc-200">{vehicleDetails[cType].label}</div>
                                <div className="text-[8px] text-zinc-500 leading-tight mt-0.5">{vehicleDetails[cType].desc}</div>
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
                        className="w-full py-3 rounded-xl bg-accent bg-accent-hover text-zinc-950 font-black text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-accent transition-all active:scale-95"
                      >
                        Request Spatial Booking
                      </button>
                    ) : (
                      <div className="space-y-3 pt-2 border-t border-zinc-850">
                        {driverETA && (activeTrip.status === 'accepted' || activeTrip.status === 'arrived') && (
                          <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400 font-bold flex items-center">
                                <Car className="w-4 h-4 text-accent mr-1.5 animate-bounce" />
                                Driver is arriving
                              </span>
                              <span className="text-accent font-black text-sm">{driverETA.minutes} min</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden relative">
                              <div className="absolute top-0 bottom-0 left-0 bg-accent rounded-full animate-pulse" style={{ width: '45%' }}></div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                              <span>Distance: {driverETA.distanceKm} km away</span>
                              <span>Live GPS tracked</span>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs p-3.5 bg-zinc-950 rounded-xl border border-zinc-850">
                          <span className="text-zinc-500 font-semibold">Ride Status:</span>
                          <span className="font-extrabold text-accent uppercase tracking-wider animate-pulse">{activeTrip.status}</span>
                        </div>
                        {activeTrip.status === 'completed' && (
                          <button
                            onClick={resetRiderState}
                            className="w-full py-3 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-xs font-bold text-zinc-300"
                          >
                            Order Another Ride
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW B: TELEMETRY CONSOLE (Driver console) */}
              {activeTab === 'telemetry' && userProfile.role === 'driver' && (
                <div className="space-y-5">
                  
                  {/* Approval Check Alert banner */}
                  {!driverProfile?.is_approved && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
                      <div className="flex items-center space-x-2 font-bold text-sm">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
                        <span>Awaiting Admin Approval</span>
                      </div>
                      <p className="leading-relaxed text-[11px] text-zinc-400">
                        Your driver profile is currently pending administrator verification. You will be able to go online and accept spatial ride requests once approved.
                      </p>
                    </div>
                  )}

                  {/* Driver control panel */}
                  <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-zinc-800 justify-between">
                      <div className="flex items-center space-x-2">
                        <Navigation className="w-4 h-4 text-accent" />
                        <span className="text-sm font-bold text-zinc-200">Driver Telemetry Console</span>
                      </div>
                      <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full ${isDriverOnline ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10' : 'bg-zinc-800 text-zinc-500'}`}>
                        {isDriverOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {/* Driver details and Custom pricing overview */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase font-bold">Vehicle details</span>
                        <span className="font-bold text-zinc-300">{driverProfile?.vehicle_number} ({driverProfile?.vehicle_type})</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase font-bold">Base Fare</span>
                        <span className="font-bold text-zinc-300">{getCurrencySymbol()}{driverProfile?.base_fare?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase font-bold">Per KM Rate</span>
                        <span className="font-bold text-zinc-300">{getCurrencySymbol()}{driverProfile?.per_km_rate?.toFixed(2)}/km</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase font-bold">Avatar Class</span>
                        <span className="text-lg">{driverProfile ? vehicleDetails[driverProfile.vehicle_image]?.emoji : '🚗'}</span>
                      </div>
                    </div>

                    {/* Online Toggle button */}
                    {driverProfile?.is_approved && (
                      <button
                        onClick={handleDriverOnlineToggle}
                        className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${isDriverOnline ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/10' : 'bg-accent bg-accent-hover text-zinc-950 hover:shadow-accent'}`}
                      >
                        {isDriverOnline ? 'Disconnect Telemetry (Go Offline)' : 'Establish Connection (Go Online)'}
                      </button>
                    )}

                    {/* GPS Coordinates stream */}
                    {isDriverOnline && (
                      <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 text-xs space-y-1.5">
                        <div className="flex justify-between items-center text-zinc-400">
                          <span>Driver Coordinates:</span>
                          <span className="font-mono text-accent font-extrabold">{driverLocation.Latitude.toFixed(5)}, {driverLocation.Longitude.toFixed(5)}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 leading-tight">
                          *To simulate movement, click anywhere inside the map area.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Active Ride Offer popup */}
                  {driverTripOffer && (
                    <div className="p-5 rounded-2xl border border-accent/30 bg-accent/5 animate-pulse space-y-3 shadow-accent">
                      <div className="flex items-center space-x-2 text-xs font-black text-accent uppercase tracking-widest">
                        <Layers className="w-4 h-4" />
                        <span>Incoming Spatial Ride Offer</span>
                      </div>
                      <div className="text-xs text-zinc-400 space-y-1 p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-850">
                        <p>Estimated Fare: <span className="text-emerald-400 font-extrabold text-sm">{getCurrencySymbol()}{driverTripOffer.fare.toFixed(2)}</span></p>
                        <p className="text-[10px] mt-1 text-zinc-500 font-mono">Trip: {driverTripOffer.trip_id.slice(0, 8)}...</p>
                      </div>
                      <button
                        onClick={acceptRide}
                        className="w-full py-3 rounded-xl bg-accent bg-accent-hover text-zinc-950 font-black text-xs shadow-md active:scale-95 transition-all"
                      >
                        Accept Ride Offer & Recalculate
                      </button>
                    </div>
                  )}

                  {/* Accepted trip workflow steps */}
                  {driverActiveTrip && (
                    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold pb-2 border-b border-zinc-800">
                        <span className="text-zinc-500">Assigned Trip Status:</span>
                        <span className="text-accent uppercase font-black tracking-wider animate-pulse">{driverActiveTrip.status}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={triggerDriverArrived}
                          disabled={driverActiveTrip.status !== 'accepted'}
                          className="py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] uppercase focus-ring-accent"
                        >
                          Arrived
                        </button>
                        <button
                          onClick={triggerDriverStartRide}
                          disabled={driverActiveTrip.status !== 'arrived'}
                          className="py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] uppercase focus-ring-accent"
                        >
                          Start
                        </button>
                        <button
                          onClick={triggerDriverCompleteRide}
                          disabled={driverActiveTrip.status !== 'en_route'}
                          className="py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] uppercase focus-ring-accent"
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Driver logs removed for premium UI presentation */}

                </div>
              )}

              {/* VIEW C: ADMIN CONSOLE (Verify Drivers & Geofence config) */}
              {activeTab === 'console' && userProfile.role === 'admin' && (
                <div className="space-y-5">
                  
                  {/* Admin Tab Switch */}
                  <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setAdminTab('drivers')}
                      className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${adminTab === 'drivers' ? 'bg-accent text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Verify Drivers
                    </button>
                    <button
                      onClick={() => setAdminTab('cities')}
                      className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${adminTab === 'cities' ? 'bg-accent text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Geofence Config
                    </button>
                  </div>

                  {/* Tab 1: Verify Drivers List */}
                  {adminTab === 'drivers' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Registered Driver Profiles</span>
                        <button 
                          onClick={() => fetchDrivers(token)}
                          className="text-[10px] text-accent font-bold hover:underline flex items-center"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                        </button>
                      </div>

                      <div className="space-y-3.5">
                        {driversList.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic p-6 text-center bg-zinc-900 rounded-2xl border border-zinc-850">No drivers registered yet.</p>
                        ) : (
                          driversList.map((drv) => (
                            <div key={drv.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-850 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-extrabold text-sm text-zinc-200">{drv.user?.name || "Driver Profile"}</h4>
                                  <p className="text-[10px] text-zinc-500">{drv.user?.email || "No Email"}</p>
                                </div>
                                <span className={`text-[8px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${drv.is_approved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                                  {drv.is_approved ? 'Approved' : 'Pending'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px] p-2.5 bg-zinc-950 rounded-xl border border-zinc-850/80 font-mono text-zinc-400">
                                <p>Plate: <span className="text-zinc-200">{drv.vehicle_number}</span></p>
                                <p>Class: <span className="text-zinc-200 capitalize">{drv.vehicle_type}</span></p>
                                <p>Base Fare: <span className="text-accent">{getCurrencySymbol()}{drv.base_fare?.toFixed(2)}</span></p>
                                <p>Per KM: <span className="text-accent">{getCurrencySymbol()}{drv.per_km_rate?.toFixed(2)}</span></p>
                              </div>

                              {!drv.is_approved && (
                                <button
                                  onClick={() => handleApproveDriver(drv.id)}
                                  className="w-full py-2.5 rounded-xl bg-accent bg-accent-hover text-zinc-950 font-black text-xs transition-all active:scale-95"
                                >
                                  Approve Application
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
                    <div className="space-y-4 p-5 rounded-2xl bg-zinc-900 border border-zinc-850">
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase block">Select Operational City</label>
                        <select 
                          value={selectedCityId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedCityId(val);
                            if (val === 'new') {
                              setIsNewCity(true);
                              setCityName('');
                              setCityCurrency('INR');
                              setCityBaseFare('50.00');
                              setCityPerKmRate('15.00');
                              setCityCommissionRate('10.00');
                              setCityMatchingRadius('8.00');
                              setCityAllowedVehicles(['bike', 'sedan', 'suv', 'auto']);
                              setPolygonPoints([]);
                            } else {
                              setIsNewCity(false);
                              const city = cities.find(c => c.id === val);
                              if (city) {
                                setCityName(city.name);
                                setCityCurrency(city.currency);
                                setCityBaseFare(city.base_fare ? city.base_fare.toString() : '0');
                                setCityPerKmRate(city.per_km_rate ? city.per_km_rate.toString() : '0');
                                setCityCommissionRate(city.commission_rate ? city.commission_rate.toString() : '0');
                                setCityMatchingRadius(city.matching_radius_km ? city.matching_radius_km.toString() : '5.00');
                                setCityAllowedVehicles(city.allowed_vehicle_types || ['bike', 'sedan', 'suv', 'auto']);
                                
                                // Load boundary geofence
                                if (city.boundary_geojson) {
                                  try {
                                    const geoJSON = typeof city.boundary_geojson === 'string' 
                                      ? JSON.parse(city.boundary_geojson) 
                                      : city.boundary_geojson;
                                    if (geoJSON.type === 'Polygon' && geoJSON.coordinates && geoJSON.coordinates[0]) {
                                      const pts = geoJSON.coordinates[0].map(pt => [pt[1], pt[0]]);
                                      if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
                                        pts.pop();
                                      }
                                      setPolygonPoints(pts);
                                    } else {
                                      setPolygonPoints([]);
                                    }
                                  } catch (err) {
                                    console.error("Error parsing boundary: ", err);
                                    setPolygonPoints([]);
                                  }
                                } else {
                                  setPolygonPoints([]);
                                }
                              }
                            }
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-3 text-xs text-zinc-200 focus:outline-none focus:border-accent"
                        >
                          <option value="">-- Choose an existing city or add new --</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name} ({city.currency})
                            </option>
                          ))}
                          <option value="new">➕ Register a New City...</option>
                        </select>
                      </div>

                      {isNewCity && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase block">New City Name</label>
                          <input 
                            type="text"
                            placeholder="Enter city name (e.g. London)"
                            value={cityName}
                            onChange={(e) => setCityName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-zinc-200 focus:outline-none focus:border-accent focus-ring-accent"
                            required
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase block">Currency</label>
                          <select 
                            value={cityCurrency}
                            onChange={(e) => setCityCurrency(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-2 text-xs text-zinc-200 focus:outline-none focus:border-accent"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="INR">INR (₹)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase block">Search Radius (KM)</label>
                          <input 
                            type="number"
                            step="0.5"
                            value={cityMatchingRadius}
                            onChange={(e) => setCityMatchingRadius(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-accent focus-ring-accent text-zinc-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase block">Base Fare</label>
                          <input 
                            type="number" 
                            value={cityBaseFare}
                            onChange={(e) => setCityBaseFare(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-accent text-zinc-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase block">Per KM</label>
                          <input 
                            type="number" 
                            value={cityPerKmRate}
                            onChange={(e) => setCityPerKmRate(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-accent text-zinc-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase block">Commission %</label>
                          <input 
                            type="number" 
                            value={cityCommissionRate}
                            onChange={(e) => setCityCommissionRate(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs focus:outline-none focus:border-accent text-zinc-200"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Allowed Vehicle Classes</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'bike', label: 'Bike', icon: '🏍️' },
                            { id: 'sedan', label: 'Sedan', icon: '🚗' },
                            { id: 'suv', label: 'SUV', icon: '🚙' },
                            { id: 'auto', label: 'Auto', icon: '🛺' }
                          ].map((v) => {
                            const isAllowed = cityAllowedVehicles.includes(v.id);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  if (isAllowed) {
                                    setCityAllowedVehicles(prev => prev.filter(x => x !== v.id));
                                  } else {
                                    setCityAllowedVehicles(prev => [...prev, v.id]);
                                  }
                                }}
                                className={`py-1.5 rounded-lg border flex flex-col items-center justify-center text-[10px] font-bold transition-all ${isAllowed ? 'bg-accent/20 border-accent text-accent' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                              >
                                <span className="text-sm">{v.icon}</span>
                                <span>{v.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 text-[11px] flex justify-between items-center">
                        <span className="text-zinc-500 font-semibold">Boundary Nodes Plotted:</span>
                        <span className="font-extrabold text-accent font-mono">{polygonPoints.length}</span>
                      </div>

                      {polygonPoints.length > 0 && (
                        <button
                          onClick={() => setPolygonPoints([])}
                          className="w-full py-2 border border-zinc-800 bg-zinc-950 rounded-lg hover:bg-zinc-900 text-[10px] font-bold text-rose-400 focus:outline-none"
                        >
                          Clear Plotted boundary Nodes
                        </button>
                      )}

                      <button
                        onClick={saveGeofenceCity}
                        disabled={polygonPoints.length < 3 || !cityName}
                        className="w-full py-3 rounded-xl bg-accent bg-accent-hover text-zinc-950 font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-accent transition-all active:scale-95"
                      >
                        {isNewCity ? "Register Operational City geofence" : "Update Operational City geofence"}
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* VIEW D: RIDE HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
                    <span>Summary of past spatial rides</span>
                    <span className="font-mono bg-zinc-900 border border-zinc-850 px-2.5 py-0.5 rounded-full text-accent font-black">
                      {rideHistory.length} Total
                    </span>
                  </div>

                  <div className="space-y-3">
                    {rideHistory.map((ride) => (
                      <div key={ride.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-850 space-y-3 flex flex-col hover:border-zinc-800 transition-all">
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-850/60">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{vehicleDetails[ride.vehicle]?.emoji || '🚗'}</span>
                            <div>
                              <p className="text-xs font-black text-zinc-200 capitalize">{ride.vehicle} Class</p>
                              <p className="text-[9px] text-zinc-500 font-mono">{new Date(ride.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            ride.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {ride.status}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-zinc-400">
                          <p className="flex items-start truncate"><CircleDot className="w-3.5 h-3.5 text-emerald-400 mr-2 shrink-0 mt-0.5" /> <span className="truncate">{ride.pickup}</span></p>
                          <p className="flex items-start truncate"><MapPin className="w-3.5 h-3.5 text-rose-500 mr-2 shrink-0 mt-0.5" /> <span className="truncate">{ride.dropoff}</span></p>
                        </div>

                        <div className="pt-2 border-t border-zinc-850/60 flex justify-between items-center text-[10px] text-zinc-500">
                          <span>{ride.driverName ? `Driver: ${ride.driverName}` : ride.passengerName ? `Passenger: ${ride.passengerName}` : 'Partner: Dispatched'}</span>
                          <span className="text-xs font-black text-accent font-mono">{ride.currency === 'INR' ? '₹' : '$'}{ride.fare.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW E: PAYMENTS & WALLET */}
              {activeTab === 'payment' && (
                <div className="space-y-5">
                  
                  {/* wallet credit balance card */}
                  <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md relative overflow-hidden flex flex-col justify-between h-48">
                    {/* Background glow logo */}
                    <div className="absolute -bottom-8 -right-8 w-36 h-36 rounded-full bg-accent opacity-5 blur-2xl"></div>
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Available Balance</p>
                        <h3 className="text-3xl font-black text-white font-mono mt-1">
                          {getCurrencySymbol()}{walletBalance.toFixed(2)}
                        </h3>
                      </div>
                      <span className="text-xs font-mono bg-zinc-800 border border-zinc-700/60 text-accent px-2 py-0.5 rounded uppercase font-black">
                        {userProfile.role === 'rider' ? 'RIDER ACCOUNT' : 'EARNINGS LEDGER'}
                      </span>
                    </div>

                    <div className="pt-4 flex space-x-3 relative z-10">
                      {userProfile.role === 'rider' ? (
                        <>
                          <button
                            onClick={() => {
                              const amount = prompt("Enter amount to add via Razorpay (₹ / $):", "500");
                              if (amount && !isNaN(amount)) {
                                setRazorpayAmount(parseFloat(amount));
                                setRazorpayPurpose('load_wallet');
                                setShowRazorpayModal(true);
                              }
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-accent bg-accent-hover text-zinc-950 text-xs font-black transition-all active:scale-95 shadow-md flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4 mr-1.5" /> Load Wallet
                          </button>
                          <button
                            onClick={() => alert("Simulated Razorpay direct checkout linked.")}
                            className="py-2.5 px-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-xs font-bold text-zinc-300 transition-all active:scale-95"
                          >
                            Link UPI
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            if (walletBalance <= 0) {
                              alert("No earnings available for payout.");
                              return;
                            }
                            const amount = walletBalance;
                            saveWalletBalance(0);
                            addTransaction({
                              id: 'tx_' + Math.random().toString(36).substring(2, 9),
                              reference: 'payout_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                              tripId: null,
                              amount: amount,
                              currency: getCurrencySymbol() === '₹' ? 'INR' : 'USD',
                              type: 'payout',
                              method: 'IMPS Direct Transfer',
                              status: 'success',
                              date: new Date().toISOString()
                            });
                            alert(`Payout of ${getCurrencySymbol()}${amount.toFixed(2)} initiated to your linked bank account via Razorpay Route.`);
                            addSystemLog(`Driver: Payout of ${getCurrencySymbol()}${amount.toFixed(2)} captured.`);
                          }}
                          className="w-full py-2.5 rounded-xl bg-accent bg-accent-hover text-zinc-950 text-xs font-black transition-all active:scale-95 shadow-md"
                        >
                          Request Instant Payout
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Razorpay Configuration Details */}
                  <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-850 space-y-3">
                    <h4 className="text-xs font-black text-zinc-200 uppercase tracking-wider flex items-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2" /> razorpay API Integration
                    </h4>
                    
                    <div className="space-y-3.5 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold block">RAZORPAY KEY ID</label>
                        <input
                          type="text"
                          value={razorpayKey}
                          onChange={(e) => {
                            setRazorpayKey(e.target.value);
                            localStorage.setItem('razorpayKey', e.target.value);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none focus:border-accent"
                        />
                      </div>
                      
                      <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 text-[10px] text-zinc-500 leading-normal flex items-start">
                        <Info className="w-4 h-4 text-accent mr-2 shrink-0 mt-0.5" />
                        <p>
                          This key represents the dynamic client-side authorization profile. Direct card payments and wallet top-ups generate callbacks mapped through this gateway.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cards Section */}
                  {userProfile.role === 'rider' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
                        <span>Linked Debit/Credit Cards</span>
                        <button
                          onClick={() => {
                            const last4 = prompt("Enter last 4 digits of Card:", "1122");
                            if (last4 && last4.length === 4) {
                              const newCard = {
                                id: 'card_' + Math.random().toString(36).substring(2, 9),
                                brand: 'Visa',
                                last4: last4,
                                expiry: '06/30',
                                holder: userProfile.name
                              };
                              saveLinkedCards([...linkedCards, newCard]);
                            }
                          }}
                          className="text-accent hover:underline flex items-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Card
                        </button>
                      </div>

                      <div className="space-y-2">
                        {linkedCards.map((card) => (
                          <div key={card.id} className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">💳</span>
                              <div>
                                <p className="text-xs font-bold text-zinc-200">{card.brand} •••• {card.last4}</p>
                                <p className="text-[9px] text-zinc-500">{card.holder} | Expires {card.expiry}</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                saveLinkedCards(linkedCards.filter(c => c.id !== card.id));
                              }}
                              className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* VIEW F: TRANSACTION HISTORY */}
              {activeTab === 'transactions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
                    <span>Financial transaction records</span>
                    <span className="font-mono bg-zinc-900 border border-zinc-850 px-2.5 py-0.5 rounded-full text-accent font-black">
                      {transactions.length} Entries
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-between hover:border-zinc-800 transition-all">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            tx.type === 'capture' || tx.type === 'earning'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : tx.type === 'hold'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {tx.type === 'capture' || tx.type === 'earning' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs font-black text-zinc-200 capitalize">{tx.type.replace('_', ' ')}</p>
                              <span className="text-[8px] bg-zinc-950 text-zinc-500 px-1 py-0.5 rounded font-mono font-bold">{tx.method}</span>
                            </div>
                            <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{tx.reference} | {new Date(tx.date).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <span className={`text-xs font-black font-mono ${
                          tx.type === 'capture' || tx.type === 'earning' || tx.type === 'wallet_load'
                            ? 'text-emerald-400'
                            : tx.type === 'hold'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}>
                          {tx.type === 'capture' || tx.type === 'earning' || tx.type === 'wallet_load' ? '+' : '-'}
                          {tx.currency === 'INR' ? '₹' : '$'}{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW G: THEME & SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-5">
                  
                  {/* Theme customizer color selector */}
                  <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-850 space-y-4">
                    <label className="text-xs font-black text-zinc-200 uppercase tracking-wider block">Customize Action Color Theme</label>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Select your preferred vibrant 10% accent color mapping. It dynamically updates buttons, routes, alerts, and system focus rings instantly.
                    </p>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'yellow', label: 'Electric Yellow', hex: '#facc15', bg: 'bg-yellow-400' },
                        { id: 'orange', label: 'Safety Orange', hex: '#f97316', bg: 'bg-orange-500' },
                        { id: 'green', label: 'Neon Green', hex: '#22c55e', bg: 'bg-emerald-500' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setAccentTheme(item.id);
                            localStorage.setItem('accentTheme', item.id);
                            addSystemLog(`Theme updated to ${item.label}`);
                          }}
                          className={`p-3.5 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all ${
                            accentTheme === item.id 
                              ? 'bg-zinc-800 border-accent text-white shadow-accent' 
                              : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full ${item.bg} block`}></span>
                          <span className="text-[9px] font-black">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Profile Details overview */}
                  <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-850 space-y-3">
                    <label className="text-xs font-black text-zinc-200 uppercase tracking-wider block">Profile Credentials</label>
                    
                    <div className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-2 gap-2 pb-2 border-b border-zinc-850/60">
                        <span className="text-zinc-500">Authorized Name:</span>
                        <span className="text-zinc-200 font-bold text-right">{userProfile.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pb-2 border-b border-zinc-850/60">
                        <span className="text-zinc-500">Email Address:</span>
                        <span className="text-zinc-200 font-bold text-right truncate">{userProfile.email}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pb-2 border-b border-zinc-850/60">
                        <span className="text-zinc-500">Phone Code:</span>
                        <span className="text-zinc-200 font-bold text-right">{userProfile.phone || 'Not Added'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-zinc-500">Access Token (JWT):</span>
                        <span className="text-zinc-400 font-mono text-right truncate">{token.slice(0, 15)}...</span>
                      </div>
                    </div>
                  </div>

                  {/* Driver specific vehicle editing if driver */}
                  {userProfile.role === 'driver' && driverProfile && (
                    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-850 space-y-3">
                      <label className="text-xs font-black text-zinc-200 uppercase tracking-wider block">Vehicle Setup</label>
                      <div className="space-y-3 text-xs text-zinc-400">
                        <div className="grid grid-cols-2 gap-2 pb-2 border-b border-zinc-850/60">
                          <span>Plate Number:</span>
                          <span className="text-zinc-200 font-bold text-right">{driverProfile.vehicle_number}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pb-2 border-b border-zinc-850/60">
                          <span>Vehicle Class:</span>
                          <span className="text-zinc-200 font-bold text-right capitalize">{driverProfile.vehicle_type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span>Base / Per KM Rates:</span>
                          <span className="text-zinc-200 font-bold text-right">{getCurrencySymbol()}{driverProfile.base_fare.toFixed(2)} / {getCurrencySymbol()}{driverProfile.per_km_rate.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* System Developer Settings */}
                  <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-850 space-y-3">
                    <label className="text-xs font-black text-zinc-200 uppercase tracking-wider block font-sans">Developer telemetry details</label>
                    <div className="space-y-2 text-[10px] font-mono text-zinc-400">
                      <p>WS Status: <span className="text-emerald-400">CONNECTIVITY VERIFIED</span></p>
                      <p>OSRM Server: <span className="text-accent">https://router.project-osrm.org</span></p>
                      <p>Local time: <span className="text-zinc-300">2026-06-06T15:35:21+05:30</span></p>
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>

          {/* RIGHT COLUMN VIEWPORT: Map section */}
          <div className="flex-1 h-full p-6 relative bg-zinc-900">
            <Map 
              mode={userProfile.role === 'admin' ? 'admin' : (userProfile.role === 'driver' ? 'driver' : 'rider')}
              cities={cities}
              pickup={getMapPickup()}
              dropoff={getMapDropoff()}
              driverLocation={
                userProfile.role === 'rider' && activeTrip && activeTrip.status !== 'completed' 
                  ? driverLocation 
                  : (userProfile.role === 'driver' ? driverLocation : null)
              }
              polygonPoints={polygonPoints}
              selectionMode={riderSelectionMode}
              onMapClick={handleMapClick}
              mapCenter={
                getMapPickup() 
                  ? [getMapPickup().Latitude, getMapPickup().Longitude] 
                  : (driverLocation ? [driverLocation.Latitude, driverLocation.Longitude] : [12.9716, 77.5946])
              }
              accentColor={getAccentHex()}
              nearbyVehicles={nearbyVehicles}
            />
          </div>

        </div>
      )}

    </div>
  );
}
