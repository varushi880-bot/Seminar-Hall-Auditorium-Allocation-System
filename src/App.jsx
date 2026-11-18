// Owner: Person 1 (Frontend, Availability Checker, Booking Flow & Schedule)
import { useEffect, useState } from 'react';
import AdminPanel from './AdminPanel.jsx';

const TODAY = new Date().toISOString().split('T')[0];

export default function App() {
  const [activeTab, setActiveTab] = useState('venues');
  const [halls, setHalls] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Availability slot filter
  const [slotFilter, setSlotFilter] = useState({
    date: TODAY,
    startTime: '10:00',
    endTime: '12:00',
    attendees: ''
  });

  // Schedule filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Booking modal state
  const [selectedHall, setSelectedHall] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    eventTitle: '',
    organizer: '',
    department: '',
    date: TODAY,
    startTime: '10:00',
    endTime: '12:00',
    attendees: '',
    notes: ''
  });
  const [conflictInfo, setConflictInfo] = useState(null);

  function showToast(message, type = 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchData(filter = slotFilter) {
    try {
      const params = new URLSearchParams({
        date: filter.date,
        startTime: filter.startTime,
        endTime: filter.endTime,
        ...(filter.attendees ? { attendees: filter.attendees } : {})
      });
      const [hallsRes, bookingsRes] = await Promise.all([
        fetch(`/api/halls?${params.toString()}`),
        fetch('/api/bookings')
      ]);
      const [hallsData, bookingsData] = await Promise.all([
        hallsRes.json(),
        bookingsRes.json()
      ]);
      setHalls(hallsData);
      setBookings(bookingsData);
    } catch {
      showToast('Unable to reach backend API. Make sure the server is running.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(slotFilter);
  }, [slotFilter.date, slotFilter.startTime, slotFilter.endTime, slotFilter.attendees]);

  function openBookingModal(hall) {
    setSelectedHall(hall);
    setConflictInfo(null);
    setBookingForm({
      eventTitle: '',
      organizer: '',
      department: '',
      date: slotFilter.date,
      startTime: slotFilter.startTime,
      endTime: slotFilter.endTime,
      attendees: slotFilter.attendees || Math.min(50, hall.capacity),
      notes: ''
    });
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();
    setConflictInfo(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hallId: selectedHall.id,
          ...bookingForm
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setConflictInfo({
          error: data.error || 'Booking failed',
          alternatives: data.alternatives || []
        });
        return;
      }
      showToast(`Booking ${data.id} submitted for approval!`, 'success');
      setSelectedHall(null);
      fetchData();
      setActiveTab('schedule');
    } catch {
      showToast('Server error while creating booking.', 'error');
    }
  }

  async function handleCancelBooking(id) {
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(`Booking ${id} cancelled`, 'info');
      fetchData();
    } catch {
      showToast('Could not cancel booking.', 'error');
    }
  }

  // Stats
  const availableCount = halls.filter((h) => h.availability === 'Available' && h.fitsCapacity).length;
  const pendingCount = bookings.filter((b) => b.status === 'Pending').length;
  const approvedCount = bookings.filter((b) => b.status === 'Approved').length;

  const filteredBookings = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.eventTitle.toLowerCase().includes(q) ||
      b.organizer.toLowerCase().includes(q) ||
      b.department.toLowerCase().includes(q) ||
      b.hallName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">CV</div>
          <div>
            <h1>CampusVenue</h1>
            <p>Seminar Hall & Auditorium Allocation System</p>
          </div>
        </div>

        <nav className="tabs">
          <button
            className={activeTab === 'venues' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('venues')}
          >
            Venues & Booking
          </button>
          <button
            className={activeTab === 'schedule' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule ({bookings.length})
          </button>
          <button
            className={activeTab === 'admin' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('admin')}
          >
            Admin Panel {pendingCount > 0 && <span className="pill-count">{pendingCount}</span>}
          </button>
        </nav>
      </header>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <main className="container">
        {/* Quick Stats */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Venues</span>
            <strong className="stat-value">{halls.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Available for Slot</span>
            <strong className="stat-value accent-green">{availableCount}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pending Approval</span>
            <strong className="stat-value accent-amber">{pendingCount}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Approved Events</span>
            <strong className="stat-value accent-indigo">{approvedCount}</strong>
          </div>
        </section>

        {/* TAB 1: VENUES & LIVE AVAILABILITY */}
        {activeTab === 'venues' && (
          <>
            <section className="card filter-bar">
              <div className="filter-group">
                <label>Date</label>
                <input
                  type="date"
                  value={slotFilter.date}
                  onChange={(e) => setSlotFilter({ ...slotFilter, date: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={slotFilter.startTime}
                  onChange={(e) => setSlotFilter({ ...slotFilter, startTime: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={slotFilter.endTime}
                  onChange={(e) => setSlotFilter({ ...slotFilter, endTime: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>Min Attendees</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 100"
                  value={slotFilter.attendees}
                  onChange={(e) => setSlotFilter({ ...slotFilter, attendees: e.target.value })}
                />
              </div>
            </section>

            {loading ? (
              <div className="empty-box">Loading campus venues...</div>
            ) : (
              <section className="venue-grid">
                {halls.map((hall) => {
                  const canBook = hall.availability === 'Available' && hall.fitsCapacity;
                  return (
                    <article
                      key={hall.id}
                      className={`card venue-card ${!hall.fitsCapacity ? 'dimmed' : ''}`}
                    >
                      <div className="venue-top">
                        <span className="type-chip">{hall.type}</span>
                        <span className={`badge badge-${hall.availability.toLowerCase()}`}>
                          {hall.availability}
                        </span>
                      </div>

                      <h3>{hall.name}</h3>
                      <p className="muted">{hall.building}</p>
                      <p className="capacity-line">
                        Capacity: <strong>{hall.capacity} seats</strong>
                        {!hall.fitsCapacity && (
                          <span className="warn-inline"> (Too small for filter)</span>
                        )}
                      </p>

                      <div className="chips">
                        {hall.facilities.map((f) => (
                          <span key={f} className="facility-chip">
                            {f}
                          </span>
                        ))}
                      </div>

                      {hall.conflict && (
                        <div className="conflict-note">
                          Slot occupied by <strong>{hall.conflict.eventTitle}</strong> (
                          {hall.conflict.startTime}–{hall.conflict.endTime})
                        </div>
                      )}

                      <button
                        className={`btn ${canBook ? 'btn-primary' : 'btn-ghost'} full-btn`}
                        disabled={hall.underMaintenance}
                        onClick={() => openBookingModal(hall)}
                      >
                        {hall.underMaintenance
                          ? 'Under Maintenance'
                          : hall.availability === 'Booked'
                          ? 'Book Another Time'
                          : 'Request Allocation'}
                      </button>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}

        {/* TAB 2: SCHEDULE & BOOKING TRACKER */}
        {activeTab === 'schedule' && (
          <section className="card">
            <div className="section-head">
              <div>
                <h2>Allocation Schedule</h2>
                <p className="muted">Track all seminar hall & auditorium bookings across campus.</p>
              </div>
              <div className="schedule-controls">
                <input
                  type="text"
                  placeholder="Search event, organizer, hall..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="All">All Statuses</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="empty-box">No bookings match your filter.</div>
            ) : (
              <div className="stack">
                {filteredBookings.map((b) => (
                  <div key={b.id} className="booking-row">
                    <div className="booking-main">
                      <div className="row-top">
                        <span className="code-tag">{b.id}</span>
                        <strong>{b.eventTitle}</strong>
                        <span className={`badge badge-${b.status.toLowerCase()}`}>{b.status}</span>
                      </div>
                      <p className="meta">
                        <strong>{b.hallName}</strong> ({b.hallBuilding}) • {b.date} • {b.startTime}–
                        {b.endTime} • {b.attendees} seats
                      </p>
                      <p className="meta">
                        Organizer: {b.organizer} ({b.department})
                        {b.adminRemark && (
                          <span className="remark-tag"> • Admin Note: {b.adminRemark}</span>
                        )}
                      </p>
                    </div>

                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleCancelBooking(b.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: ADMIN PANEL (Owned by Person 2) */}
        {activeTab === 'admin' && (
          <AdminPanel
            halls={halls}
            bookings={bookings}
            onRefresh={() => fetchData()}
            showToast={showToast}
          />
        )}
      </main>

      {/* BOOKING REQUEST MODAL */}
      {selectedHall && (
        <div className="modal-backdrop" onClick={() => setSelectedHall(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <div>
                <h2>Request {selectedHall.name}</h2>
                <p className="muted">
                  {selectedHall.building} • Max {selectedHall.capacity} seats
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedHall(null)}>
                ✕
              </button>
            </div>

            <form className="form-grid" onSubmit={handleBookingSubmit}>
              <input
                className="span-2"
                placeholder="Event / Seminar Title *"
                value={bookingForm.eventTitle}
                onChange={(e) => setBookingForm({ ...bookingForm, eventTitle: e.target.value })}
                required
              />
              <input
                placeholder="Organizer Name *"
                value={bookingForm.organizer}
                onChange={(e) => setBookingForm({ ...bookingForm, organizer: e.target.value })}
                required
              />
              <input
                placeholder="Department / Club *"
                value={bookingForm.department}
                onChange={(e) => setBookingForm({ ...bookingForm, department: e.target.value })}
                required
              />
              <input
                type="date"
                value={bookingForm.date}
                onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                required
              />
              <input
                type="number"
                min="1"
                placeholder="Expected Attendees *"
                value={bookingForm.attendees}
                onChange={(e) => setBookingForm({ ...bookingForm, attendees: e.target.value })}
                required
              />
              <input
                type="time"
                value={bookingForm.startTime}
                onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                required
              />
              <input
                type="time"
                value={bookingForm.endTime}
                onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
                required
              />
              <textarea
                className="span-2"
                rows="2"
                placeholder="Special requirements (mics, projector, seating setup)..."
                value={bookingForm.notes}
                onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
              />

              {conflictInfo && (
                <div className="conflict-alert span-2">
                  <strong>{conflictInfo.error}</strong>
                  {conflictInfo.alternatives?.length > 0 && (
                    <div className="alt-box">
                      <span>Available alternatives for this slot:</span>
                      <div className="alt-buttons">
                        {conflictInfo.alternatives.map((alt) => (
                          <button
                            key={alt.id}
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              const found = halls.find((h) => h.id === alt.id);
                              if (found) {
                                setSelectedHall(found);
                                setConflictInfo(null);
                              }
                            }}
                          >
                            Switch to {alt.name} ({alt.capacity} seats)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions span-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedHall(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Allocation Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
