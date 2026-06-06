import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom HTML/CSS DivIcons to bypass Vite Leaflet asset loading bugs and provide premium visuals
const pickupIcon = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full bg-emerald-500 border-4 border-white shadow-xl flex items-center justify-center text-white font-black text-sm pickup-pulsing-icon">P</div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const dropoffIcon = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full bg-rose-500 border-4 border-white shadow-xl flex items-center justify-center text-white font-black text-sm">D</div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const driverIcon = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full bg-amber-500 border-4 border-white shadow-xl flex items-center justify-center text-base">🚗</div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Component to handle map clicks based on active view modes
function MapEvents({ mode, onMapClick, selectionMode }) {
	useMapEvents({
		click(e) {
			const { lat, lng } = e.latlng;
			if (mode === 'admin') {
				onMapClick(lat, lng);
			} else if (mode === 'rider') {
				onMapClick(lat, lng, selectionMode);
			} else if (mode === 'driver') {
				onMapClick(lat, lng);
			}
		},
	});
	return null;
}

// Controller to dynamically pan the map viewport to target coordinate updates
function MapController({ center }) {
	const map = useMap();
	useEffect(() => {
		if (center) {
			map.panTo(center);
		}
	}, [center, map]);
	return null;
}

// Controller to fit map bounds to pickup and dropoff pins
function fitBoundsToRoute(map, pickup, dropoff) {
	if (pickup && dropoff) {
		const bounds = L.latLngBounds(
			[pickup.Latitude, pickup.Longitude],
			[dropoff.Latitude, dropoff.Longitude]
		);
		map.fitBounds(bounds, { padding: [50, 50] });
	}
}

function RouteBoundsController({ pickup, dropoff, routePositions }) {
	const map = useMap();
	useEffect(() => {
		if (routePositions && routePositions.length > 0) {
			const bounds = L.latLngBounds(routePositions);
			map.fitBounds(bounds, { padding: [50, 50] });
		} else if (pickup && dropoff) {
			fitBoundsToRoute(map, pickup, dropoff);
		}
	}, [pickup, dropoff, routePositions, map]);
	return null;
}

export default function Map({
	mode,
	cities = [],
	pickup,
	dropoff,
	driverLocation,
	polygonPoints = [],
	selectionMode,
	onMapClick,
	mapCenter = [12.9716, 77.5946], // Default Bangalore center coordinates
	accentColor = '#facc15', // Dynamic action accent color
	nearbyVehicles = [] // Animated nearby vehicles list
}) {
	const [routePositions, setRoutePositions] = useState([]);

	useEffect(() => {
		if (pickup && dropoff) {
			const url = `https://router.project-osrm.org/route/v1/driving/${pickup.Longitude},${pickup.Latitude};${dropoff.Longitude},${dropoff.Latitude}?overview=full&geometries=geojson`;
			fetch(url)
				.then(res => res.json())
				.then(data => {
					if (data.routes && data.routes.length > 0) {
						const coords = data.routes[0].geometry.coordinates; // [[lng, lat], [lng, lat], ...]
						const routeLatLngs = coords.map(coord => [coord[1], coord[0]]); // [lat, lng]
						setRoutePositions(routeLatLngs);
					} else {
						// fallback to straight line
						setRoutePositions([
							[pickup.Latitude, pickup.Longitude],
							[dropoff.Latitude, dropoff.Longitude]
						]);
					}
				})
				.catch(err => {
					console.error("Error fetching OSRM route:", err);
					setRoutePositions([
						[pickup.Latitude, pickup.Longitude],
						[dropoff.Latitude, dropoff.Longitude]
					]);
				});
		} else {
			setRoutePositions([]);
		}
	}, [pickup, dropoff]);

	return (
		<div className="w-full h-full relative overflow-hidden rounded-2xl shadow-inner border border-zinc-800 bg-zinc-950">
			<MapContainer center={mapCenter} zoom={13} scrollWheelZoom={true}>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>

				{/* Render existing operational cities geofences */}
				{cities && cities.map((city) => {
					if (!city.boundary_geojson) return null;
					try {
						const geoJSON = typeof city.boundary_geojson === 'string' ? JSON.parse(city.boundary_geojson) : city.boundary_geojson;
						if (geoJSON.type === 'Polygon' && geoJSON.coordinates) {
							const positions = geoJSON.coordinates[0].map(pt => [pt[1], pt[0]]);
							return (
								<Polygon 
									key={city.id} 
									positions={positions} 
									pathOptions={{ color: accentColor, fillColor: accentColor, fillOpacity: 0.08, weight: 1.5, dashArray: '4, 4' }} 
								/>
							);
						}
					} catch (e) {
						console.error("Failed to parse city boundary: ", e);
					}
					return null;
				})}

				{/* Admin - currently drawn geofence ring */}
				{mode === 'admin' && polygonPoints.length > 0 && (
					<>
						<Polygon positions={polygonPoints} pathOptions={{ color: accentColor, fillColor: accentColor, fillOpacity: 0.15 }} />
						{polygonPoints.map((pt, idx) => (
							<Marker key={`poly-${idx}`} position={pt} icon={L.divIcon({
								html: `<div class="w-3 h-3 rounded-full border border-white" style="background-color: ${accentColor}"></div>`,
								className: 'custom-node',
								iconSize: [12, 12],
								iconAnchor: [6, 6],
							})} />
						))}
					</>
				)}

				{/* Rider - pickup point pin */}
				{pickup && (
					<Marker position={[pickup.Latitude, pickup.Longitude]} icon={pickupIcon} />
				)}

				{/* Rider - dropoff point pin */}
				{dropoff && (
					<Marker position={[dropoff.Latitude, dropoff.Longitude]} icon={dropoffIcon} />
				)}

				{/* Driver - current location vehicle icon */}
				{driverLocation && (
					<Marker position={[driverLocation.Latitude, driverLocation.Longitude]} icon={driverIcon} />
				)}

				{/* Render nearby vehicles while booking */}
				{nearbyVehicles && nearbyVehicles.map((vehicle) => {
					const vehicleEmojis = {
						bike: '🏍️',
						sedan: '🚗',
						suv: '🚙',
						auto: '🛺'
					};
					const emoji = vehicleEmojis[vehicle.type] || '🚗';
					const nearbyIcon = L.divIcon({
						html: `<div class="w-8 h-8 rounded-full bg-amber-500 border-4 border-white shadow-2xl flex items-center justify-center text-base hover:scale-110 transition-transform">${emoji}</div>`,
						className: 'custom-marker',
						iconSize: [32, 32],
						iconAnchor: [16, 16],
					});
					return (
						<Marker 
							key={vehicle.id} 
							position={[vehicle.latitude, vehicle.longitude]} 
							icon={nearbyIcon} 
						/>
					);
				})}

				{/* Draw Route Polyline once pickup & dropoff are selected */}
				{pickup && dropoff && (
					<Polyline 
						positions={routePositions.length > 0 ? routePositions : [
							[pickup.Latitude, pickup.Longitude],
							[dropoff.Latitude, dropoff.Longitude]
						]} 
						pathOptions={{ color: accentColor, weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} 
					/>
				)}

				{/* Map Actions Listeners */}
				<MapEvents mode={mode} onMapClick={onMapClick} selectionMode={selectionMode} />
				
				{/* Map View Controllers */}
				{driverLocation && <MapController center={[driverLocation.Latitude, driverLocation.Longitude]} />}
				{pickup && dropoff && <RouteBoundsController pickup={pickup} dropoff={dropoff} routePositions={routePositions} />}
			</MapContainer>

			{/* Floating help tooltip overlay */}
			<div className="absolute bottom-4 left-4 z-[999] bg-zinc-900/90 border border-zinc-800 backdrop-blur-md py-2 px-4 rounded-full text-xs font-semibold text-zinc-300 shadow-md">
				{mode === 'admin' && "Admin mode: Click map nodes to draw operational city geofence (double-click to close loop)."}
				{mode === 'rider' && (selectionMode === 'pickup' ? "Rider mode: Click map to set pickup pin." : "Rider mode: Click map to set dropoff pin.")}
				{mode === 'driver' && "Driver mode: Click map to trigger simulated GPS coordinates updates."}
			</div>
		</div>
	);
}
