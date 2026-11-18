// Owner: Person 2 (Backend, Allocation Engine & Admin APIs)
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 5000;
const ADMIN_PIN = '1234';

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Data Persistence Helpers ----------
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- Core Allocation / Conflict Logic ----------
function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function isTimeOverlap(startA, endA, startB, endB) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

function findConflict(bookings, { hallId, date, startTime, endTime, ignoreId = null }) {
  return bookings.find(
    (b) =>
      b.id !== ignoreId &&
      b.hallId === hallId &&
      b.date === date &&
      b.status !== 'Rejected' &&
      isTimeOverlap(startTime, endTime, b.startTime, b.endTime)
  );
}

function suggestAlternativeHalls(data, { date, startTime, endTime, attendees, excludeHallId }) {
  return data.halls
    .filter((h) => {
      if (h.id === excludeHallId || h.underMaintenance) return false;
      if (attendees && h.capacity < Number(attendees)) return false;
      const conflict = findConflict(data.bookings, {
        hallId: h.id,
        date,
        startTime,
        endTime
      });
      return !conflict;
    })
    .map((h) => ({ id: h.id, name: h.name, capacity: h.capacity, building: h.building }));
}

// ---------- Routes: Halls ----------
app.get('/api/halls', (req, res) => {
  const { date, startTime, endTime, attendees } = req.query;
  const data = readData();
  const minCap = Number(attendees) || 0;

  const hallsWithStatus = data.halls.map((hall) => {
    let availability = 'Available';
    let conflict = null;

    if (hall.underMaintenance) {
      availability = 'Maintenance';
    } else if (date && startTime && endTime && toMinutes(startTime) < toMinutes(endTime)) {
      const found = findConflict(data.bookings, {
        hallId: hall.id,
        date,
        startTime,
        endTime
      });
      if (found) {
        availability = 'Booked';
        conflict = {
          id: found.id,
          eventTitle: found.eventTitle,
          startTime: found.startTime,
          endTime: found.endTime,
          status: found.status
        };
      }
    }

    const fitsCapacity = minCap === 0 || hall.capacity >= minCap;
    return { ...hall, availability, fitsCapacity, conflict };
  });

  res.json(hallsWithStatus);
});

app.post('/api/halls', (req, res) => {
  const { name, type, building, capacity, facilities } = req.body;
  if (!name || !building || !capacity || Number(capacity) <= 0) {
    return res.status(400).json({ error: 'Name, building, and valid capacity are required.' });
  }

  const data = readData();
  const newHall = {
    id: `H${Date.now().toString().slice(-4)}`,
    name: name.trim(),
    type: type || 'Seminar Hall',
    building: building.trim(),
    capacity: Number(capacity),
    facilities: Array.isArray(facilities)
      ? facilities.map((f) => f.trim()).filter(Boolean)
      : String(facilities || '')
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
    underMaintenance: false
  };

  data.halls.push(newHall);
  writeData(data);
  res.status(201).json(newHall);
});

app.patch('/api/halls/:id/toggle', (req, res) => {
  const data = readData();
  const hall = data.halls.find((h) => h.id === req.params.id);
  if (!hall) return res.status(404).json({ error: 'Hall not found.' });

  hall.underMaintenance = !hall.underMaintenance;
  writeData(data);
  res.json(hall);
});

// ---------- Routes: Bookings ----------
app.get('/api/bookings', (req, res) => {
  const { status, date } = req.query;
  const data = readData();
  const hallMap = Object.fromEntries(data.halls.map((h) => [h.id, h]));

  let list = data.bookings.map((b) => ({
    ...b,
    hallName: hallMap[b.hallId]?.name || 'Unknown Hall',
    hallBuilding: hallMap[b.hallId]?.building || ''
  }));

  if (status && status !== 'All') {
    list = list.filter((b) => b.status === status);
  }
  if (date) {
    list = list.filter((b) => b.date === date);
  }

  list.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  res.json(list);
});

app.post('/api/bookings', (req, res) => {
  const { hallId, eventTitle, organizer, department, date, startTime, endTime, attendees, notes } =
    req.body;

  if (!hallId || !eventTitle || !organizer || !department || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Please fill in all required booking fields.' });
  }
  if (toMinutes(startTime) >= toMinutes(endTime)) {
    return res.status(400).json({ error: 'End time must be later than start time.' });
  }

  const data = readData();
  const hall = data.halls.find((h) => h.id === hallId);
  if (!hall) return res.status(404).json({ error: 'Selected hall does not exist.' });
  if (hall.underMaintenance) {
    return res.status(409).json({ error: `${hall.name} is currently under maintenance.` });
  }

  const attendeeCount = Number(attendees) || 1;
  if (attendeeCount > hall.capacity) {
    const alternatives = suggestAlternativeHalls(data, {
      date,
      startTime,
      endTime,
      attendees: attendeeCount,
      excludeHallId: hallId
    });
    return res.status(400).json({
      error: `${hall.name} holds max ${hall.capacity} people (requested ${attendeeCount}).`,
      alternatives
    });
  }

  const conflict = findConflict(data.bookings, { hallId, date, startTime, endTime });
  if (conflict) {
    const alternatives = suggestAlternativeHalls(data, {
      date,
      startTime,
      endTime,
      attendees: attendeeCount,
      excludeHallId: hallId
    });
    return res.status(409).json({
      error: `Time conflict with "${conflict.eventTitle}" (${conflict.startTime}–${conflict.endTime}).`,
      alternatives
    });
  }

  const newBooking = {
    id: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
    hallId,
    eventTitle: eventTitle.trim(),
    organizer: organizer.trim(),
    department: department.trim(),
    date,
    startTime,
    endTime,
    attendees: attendeeCount,
    notes: (notes || '').trim(),
    status: 'Pending',
    adminRemark: '',
    createdAt: new Date().toISOString()
  };

  data.bookings.push(newBooking);
  writeData(data);
  res.status(201).json({ ...newBooking, hallName: hall.name });
});

app.patch('/api/bookings/:id/status', (req, res) => {
  const { status, adminRemark } = req.body;
  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const data = readData();
  const booking = data.bookings.find((b) => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  if (status === 'Approved') {
    const conflict = findConflict(data.bookings, {
      hallId: booking.hallId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      ignoreId: booking.id
    });
    if (conflict) {
      return res.status(409).json({
        error: `Cannot approve: overlaps with "${conflict.eventTitle}" (${conflict.startTime}–${conflict.endTime}).`
      });
    }
  }

  booking.status = status;
  if (adminRemark !== undefined) booking.adminRemark = adminRemark.trim();
  writeData(data);
  res.json(booking);
});

app.delete('/api/bookings/:id', (req, res) => {
  const data = readData();
  const idx = data.bookings.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Booking not found.' });

  data.bookings.splice(idx, 1);
  writeData(data);
  res.json({ deleted: true, id: req.params.id });
});

// ---------- Route: Admin Auth (Demo PIN) ----------
app.post('/api/admin/verify', (req, res) => {
  const { pin } = req.body;
  if (String(pin) === ADMIN_PIN) {
    return res.json({ authorized: true });
  }
  return res.status(401).json({ error: 'Invalid Admin PIN. (Demo PIN is 1234)' });
});

// ---------- Serve React Frontend in Production ----------
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Seminar Hall Allocation API running on http://localhost:${PORT}`);
});
