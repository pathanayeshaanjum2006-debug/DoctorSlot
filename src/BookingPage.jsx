import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock3, ShieldCheck, Star, Stethoscope } from 'lucide-react';
import { onValue, ref } from 'firebase/database';
import { database } from './firebase.js';

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function appointmentSlotKey(slot) {
  return slot.replace(/[^A-Za-z0-9_-]/g, '_');
}

export default function BookingPage({ doctor, user, userProfile, setPage, onConfirm }) {
  const availableDates = useMemo(() => Array.from({ length: 14 }, (_, offset) => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    return {
      key: localDateKey(day),
      weekday: day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      day: day.getDate(),
      month: day.toLocaleDateString('en-US', { month: 'short' }),
      label: day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    };
  }), []);
  const [date, setDate] = useState(() => localDateKey(new Date()));
  const [time, setTime] = useState(doctor.slots?.[0] || '');
  const [details, setDetails] = useState({
    name: userProfile?.displayName || user?.displayName || '',
    email: user?.email || '',
    phone: userProfile?.phone || '',
    reason: '',
  });
  const [bookedSlots, setBookedSlots] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const doctorUid = String(doctor.userId || doctor.id);
  const slots = Array.isArray(doctor.slots) ? doctor.slots : [];
  const selectedDate = availableDates.find((item) => item.key === date) || availableDates[0];

  useEffect(() => {
    if (!database || !doctorUid || !date) return undefined;
    const subscriptions = slots.map((slot) => {
      const key = appointmentSlotKey(slot);
      return onValue(ref(database, `bookedSlots/${doctorUid}/${date}/${key}`), (snapshot) => {
        setBookedSlots((current) => ({ ...current, [key]: snapshot.exists() }));
      }, (loadError) => {
        console.error('Unable to load appointment slot availability:', loadError);
        setBookedSlots((current) => ({ ...current, [key]: true }));
      });
    });
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [doctorUid, date, slots]);

  useEffect(() => {
    setTime((current) => slots.includes(current) ? current : slots[0] || '');
  }, [doctor.id, slots]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!details.name.trim() || !details.email.trim() || !details.phone.trim()) {
      setError('Please fill in your name, email, and phone number.');
      return;
    }
    if (!selectedDate || date < localDateKey(new Date())) {
      setError('Choose a valid future appointment date.');
      return;
    }
    if (!time || !slots.includes(time)) {
      setError('Choose an available appointment time.');
      return;
    }
    if (bookedSlots[appointmentSlotKey(time)]) {
      setError('That time was just booked. Choose another available time.');
      return;
    }
    if (doctor.acceptingAppointments === false || doctor.verificationStatus !== 'approved') {
      setError('This doctor is not currently accepting appointments.');
      return;
    }

    setSubmitting(true);
    setError('Saving your appointment…');
    try {
      const saved = await onConfirm({
        doctor,
        doctorUid,
        doctorId: String(doctor.id),
        date: selectedDate.label,
        dateKey: date,
        time,
        slotKey: appointmentSlotKey(time),
        patient: details.name.trim(),
        patientEmail: details.email.trim(),
        patientPhone: details.phone.trim(),
        reason: details.reason.trim() || 'General consultation',
        status: 'Pending',
      });
      setError(saved ? '' : 'Appointment was not confirmed. Check the message below and try again.');
    } catch (submitError) {
      console.error('Unable to submit appointment:', submitError);
      setError('Appointment could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="page-shell booking-page"><div className="breadcrumb"><button onClick={() => setPage('doctors')}>Find a doctor</button><ChevronRight size={14} /><span>Book appointment</span></div>
    <button className="back-link" onClick={() => setPage('profile')}><ArrowLeft size={16} /> Back to doctor profile</button>
    <div className="booking-layout"><form className="booking-form" onSubmit={submit}>
      <div className="form-heading"><span className="section-kicker">JUST A FEW DETAILS</span><h1>Book your visit.</h1><p>Choose an upcoming date and a free appointment time.</p></div>
      <div className="form-section"><div className="form-section-title"><span>01</span><div><h2>Choose a date</h2><p>Appointments are available over the next two weeks.</p></div></div>
        <div className="date-choice-grid">{availableDates.map((item) => <button type="button" key={item.key} className={`date-choice ${date === item.key ? 'selected' : ''}`} onClick={() => setDate(item.key)}><span>{item.weekday}</span><strong>{item.day}</strong><small>{item.month}</small></button>)}</div>
      </div>
      <div className="form-section"><div className="form-section-title"><span>02</span><div><h2>Choose a time</h2><p>Times are shown in your local timezone.</p></div></div>
        {slots.length ? <div className="booking-time-grid">{slots.map((slot) => {
          const reserved = Boolean(bookedSlots[appointmentSlotKey(slot)]);
          return <button type="button" key={slot} disabled={reserved} className={`time-slot ${time === slot ? 'chosen' : ''}`} onClick={() => setTime(slot)}><Clock3 size={15} />{slot}{reserved && <span>Booked</span>}</button>;
        })}</div> : <div className="empty-inline">This doctor has not published appointment times yet.</div>}
      </div>
      <div className="form-section patient-fields-section"><div className="form-section-title"><span>03</span><div><h2>Your details</h2><p>These details are attached to this booking.</p></div></div>
        <div className="patient-fields"><label>Full name<input value={details.name} onChange={(event) => setDetails((current) => ({ ...current, name: event.target.value }))} required /></label><label>Email address<input type="email" value={details.email} onChange={(event) => setDetails((current) => ({ ...current, email: event.target.value }))} required /></label><label>Phone number<input type="tel" value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} required /></label><label>What brings you in? <span className="optional">(optional)</span><textarea rows="3" placeholder="Share a short reason for the visit" value={details.reason} onChange={(event) => setDetails((current) => ({ ...current, reason: event.target.value }))}></textarea></label></div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-btn confirm-btn" type="submit" disabled={submitting || !slots.length}>{submitting ? 'Saving appointment…' : 'Request appointment'} <ArrowRight size={16} /></button>
      <p className="form-privacy"><ShieldCheck size={14} /> Your booking details are stored with your appointment.</p>
    </form>
    <aside className="booking-summary"><div className="summary-header"><span className="section-kicker">YOUR APPOINTMENT</span><span className="summary-step">STEP 1 OF 1</span></div>
      <div className="summary-doctor"><div className={`avatar ${doctor.color} avatar-small`} aria-hidden="true">{doctor.avatar}</div><div><strong>{doctor.name}</strong><span>{doctor.title} · {doctor.specialty}</span><div className="rating"><Star size={13} fill="currentColor" /> {doctor.rating} <span>({doctor.reviews})</span></div></div></div>
      <div className="summary-line"><CalendarDays size={16} /><span>{selectedDate?.label}</span></div><div className="summary-line"><Clock3 size={16} /><span>{time || 'Select a time'} <small>· 30 min</small></span></div><div className="summary-line"><Stethoscope size={16} /><span>{doctor.hospital}</span></div>
      <div className="summary-price"><span>Consultation fee</span><strong>${doctor.fee}</strong></div><div className="summary-total"><span>Total due at visit</span><strong>${doctor.fee}</strong></div><div className="summary-secure"><ShieldCheck size={16} /><span>Secure booking. No payment required now.</span></div>
    </aside></div>
  </main>;
}
