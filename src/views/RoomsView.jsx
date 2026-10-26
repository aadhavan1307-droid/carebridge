import React, { useState } from 'react';

export default function RoomsView({ rooms }) {
  const [selectedType, setSelectedType] = useState('');

  const filteredRooms = rooms.filter(r => !selectedType || r.room_type === selectedType);

  const roomTypes = [
    { type: 'ICU', label: 'Intensive Care Unit (ICU)' },
    { type: 'EMERGENCY_BAY', label: 'Emergency Bays' },
    { type: 'OPERATING_ROOM', label: 'Operating Rooms (OR)' },
    { type: 'GENERAL_WARD', label: 'General Wards' }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>Hospital Rooms & Bed Layout Map</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-Time Occupancy, Care Level Capability & Installed Equipment Infrastructure
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${selectedType === '' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => setSelectedType('')}
          >
            All Rooms ({rooms.length})
          </button>
          {roomTypes.map(rt => (
            <button
              key={rt.type}
              className={`btn ${selectedType === rt.type ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setSelectedType(rt.type)}
            >
              {rt.type}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Rooms */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {filteredRooms.map(room => {
          const isOccupied = room.status === 'OCCUPIED';
          const isMaintenance = room.status === 'MAINTENANCE';

          return (
            <div
              key={room.id}
              className="card"
              style={{
                padding: '16px',
                borderColor: isOccupied ? 'rgba(239, 68, 68, 0.4)' : isMaintenance ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>
                  {room.room_number}
                </div>
                <span className={`badge ${isOccupied ? 'badge-danger' : isMaintenance ? 'badge-warning' : 'badge-success'}`}>
                  {room.status}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Type: <strong style={{ color: 'var(--text-main)' }}>{room.room_type}</strong> | Care: {room.care_level}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                Equipment: {room.equipment?.length > 0 ? room.equipment.join(', ') : 'Standard Bed'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
