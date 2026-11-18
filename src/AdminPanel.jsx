// Owner: Person 2 (Admin Approval & Hall Management Module)
import { useState } from 'react';

export default function AdminPanel({ halls, bookings, onRefresh, showToast }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [remarks, setRemarks] = useState({});
  const [newHall, setNewHall] = useState({
    name: '',
    type: 'Seminar Hall',
    building: '',
    capacity: '',
    facilities: ''
  });

  async function handleUnlock(e) {
    e.preventDefault();
    setPinError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || 'Incorrect PIN');
        return;
      }
      setUnlocked(true);
      setPin('');
      showToast('Admin mode unlocked', 'success');
    } catch {
      setPinError('Could not connect to server.');
    }
  }

  async function updateBookingStatus(id, status) {
    try {
      const res = await fetch(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminRemark: remarks[id] || '' })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to update status', 'error');
        return;
      }
      showToast(`Booking ${id} marked as ${status}`, 'success');
      onRefresh();
    } catch {
      showToast('Server error while updating booking.', 'error');
    }
  }

  async function handleAddHall(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/halls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHall)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not add hall', 'error');
        return;
      }
      setNewHall({ name: '', type: 'Seminar Hall', building: '', capacity: '', facilities: '' });
      showToast(`Added "${data.name}" to campus venues`, 'success');
      onRefresh();
    } catch {
      showToast('Server error while adding hall.', 'error');
    }
  }

  async function toggleMaintenance(hall) {
    try {
      const res = await fetch(`/api/halls/${hall.id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      showToast(
        `${hall.name} is now ${hall.underMaintenance ? 'Active' : 'Under Maintenance'}`,
        'success'
      );
      onRefresh();
    } catch {
      showToast('Failed to update venue status.', 'error');
    }
  }

  if (!unlocked) {
    return (
      <section className="admin-lock card">
        <div className="lock-badge">Admin Access</div>
        <h2>Venue Coordinator Console</h2>
        <p className="muted">
          Enter the coordinator PIN to approve/reject allocation requests and manage halls.
        </p>
        <form className="pin-form" onSubmit={handleUnlock}>
          <input
            type="password"
            placeholder="Enter PIN (Demo: 1234)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">
            Unlock Panel
          </button>
        </form>
        {pinError && <p className="error-text">{pinError}</p>}
        <p className="hint-text">Tip for demo/viva: Default Admin PIN is <strong>1234</strong></p>
      </section>
    );
  }

  const pendingBookings = bookings.filter((b) => b.status === 'Pending');
  const processedBookings = bookings.filter((b) => b.status !== 'Pending');

  return (
    <div className="admin-grid">
      {/* Pending Approval Queue */}
      <section className="card">
        <div className="section-head">
          <div>
            <h2>Pending Allocation Requests ({pendingBookings.length})</h2>
            <p className="muted">Review conflicts and approve or reject incoming bookings.</p>
          </div>
          <button className="btn btn-ghost" onClick={() => setUnlocked(false)}>
            Lock Admin
          </button>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="empty-box">No pending requests right now. All caught up!</div>
        ) : (
          <div className="stack">
            {pendingBookings.map((b) => (
              <div key={b.id} className="booking-row pending-card">
                <div className="booking-main">
                  <div className="row-top">
                    <span className="code-tag">{b.id}</span>
                    <strong>{b.eventTitle}</strong>
                    <span className="badge badge-pending">Pending</span>
                  </div>
                  <p className="meta">
                    {b.hallName} • {b.date} • {b.startTime}–{b.endTime} • {b.attendees} attendees
                  </p>
                  <p className="meta">
                    By <strong>{b.organizer}</strong> ({b.department})
                    {b.notes ? ` — "${b.notes}"` : ''}
                  </p>
                </div>

                <div className="admin-actions">
                  <input
                    type="text"
                    placeholder="Optional remark..."
                    value={remarks[b.id] || ''}
                    onChange={(e) => setRemarks({ ...remarks, [b.id]: e.target.value })}
                  />
                  <div className="btn-group">
                    <button
                      className="btn btn-success"
                      onClick={() => updateBookingStatus(b.id, 'Approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => updateBookingStatus(b.id, 'Rejected')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {processedBookings.length > 0 && (
          <div className="processed-list">
            <h3>Recent Decisions</h3>
            {processedBookings.slice(0, 5).map((b) => (
              <div key={b.id} className="mini-row">
                <div>
                  <strong>{b.eventTitle}</strong>{' '}
                  <span className="muted">
                    ({b.hallName}, {b.date} {b.startTime}–{b.endTime})
                  </span>
                </div>
                <span className={`badge badge-${b.status.toLowerCase()}`}>{b.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Venue Management */}
      <section className="card">
        <h2>Manage Venues & Maintenance</h2>
        <p className="muted">Add new seminar halls or pause bookings during maintenance.</p>

        <form className="form-grid" onSubmit={handleAddHall}>
          <input
            placeholder="Hall Name (e.g. Seminar Hall C)"
            value={newHall.name}
            onChange={(e) => setNewHall({ ...newHall, name: e.target.value })}
            required
          />
          <select
            value={newHall.type}
            onChange={(e) => setNewHall({ ...newHall, type: e.target.value })}
          >
            <option>Seminar Hall</option>
            <option>Auditorium</option>
            <option>Conference Room</option>
          </select>
          <input
            placeholder="Building / Floor"
            value={newHall.building}
            onChange={(e) => setNewHall({ ...newHall, building: e.target.value })}
            required
          />
          <input
            type="number"
            min="10"
            placeholder="Capacity"
            value={newHall.capacity}
            onChange={(e) => setNewHall({ ...newHall, capacity: e.target.value })}
            required
          />
          <input
            className="span-2"
            placeholder="Facilities (comma separated: Projector, AC, Mic)"
            value={newHall.facilities}
            onChange={(e) => setNewHall({ ...newHall, facilities: e.target.value })}
          />
          <button type="submit" className="btn btn-primary span-2">
            + Add Venue
          </button>
        </form>

        <div className="venue-manage-list">
          {halls.map((h) => (
            <div key={h.id} className="mini-row">
              <div>
                <strong>{h.name}</strong>{' '}
                <span className="muted">
                  ({h.capacity} seats • {h.building})
                </span>
              </div>
              <button
                className={`btn btn-sm ${h.underMaintenance ? 'btn-success' : 'btn-ghost'}`}
                onClick={() => toggleMaintenance(h)}
              >
                {h.underMaintenance ? 'Set Active' : 'Mark Maintenance'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
