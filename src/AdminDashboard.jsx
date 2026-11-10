import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Search, Stethoscope, Users, X } from 'lucide-react';
import { onValue, push, ref, serverTimestamp, update } from 'firebase/database';
import { database } from './firebase.js';

const emptyDoctor = () => ({
  rowId: crypto.randomUUID(),
  name: '',
  specialty: '',
  title: '',
  hospital: '',
  city: '',
  years: '',
  fee: '',
  slots: '09:00 AM, 11:00 AM, 02:00 PM',
});

const doctorSlotKey = (slot) => slot.replace(/[^A-Za-z0-9_-]/g, '_');

function formatDoctor(id, data) {
  return {
    ...data,
    id,
    name: data.name || 'Doctor',
    specialty: data.specialty || 'General practice',
  };
}

export default function AdminDashboard({ appointments = [], onUpdateAppointmentStatus = () => {} }) {
  const [doctors, setDoctors] = useState([]);
  const [applications, setApplications] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(() => [emptyDoctor()]);
  const [patientSearch, setPatientSearch] = useState('');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentFilter, setAppointmentFilter] = useState('All');
  const [saving, setSaving] = useState(false);
  const [reviewingUid, setReviewingUid] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!database) return undefined;
    return onValue(ref(database, 'doctors'), (snapshot) => {
      const records = snapshot.val();
      setDoctors(records ? Object.entries(records).map(([id, data]) => formatDoctor(id, data)) : []);
    }, (loadError) => {
      console.error('Unable to load doctors for admin:', loadError);
      setError('Could not load doctors. Check the Realtime Database rules.');
    });
  }, []);

  useEffect(() => {
    if (!database) return undefined;
    return onValue(ref(database, 'doctorApplications'), (snapshot) => {
      const records = snapshot.val();
      setApplications(records ? Object.entries(records).map(([userId, data]) => ({ ...data, userId })) : []);
    }, (loadError) => {
      console.error('Unable to load provider applications:', loadError);
      setError('Could not load doctor applications. Check the Realtime Database rules.');
    });
  }, []);

  useEffect(() => {
    if (!database) return undefined;
    return onValue(ref(database, 'users'), (snapshot) => {
      const records = snapshot.val();
      setAccounts(records ? Object.entries(records).map(([uid, data]) => ({ ...data, uid })) : []);
    }, (loadError) => {
      console.error('Unable to load platform accounts:', loadError);
      setError('Could not load patient accounts. Check the admin read rule for users.');
    });
  }, []);

  const updateDoctorForm = (index, field, value) => {
    setForm((current) => current.map((doctor, doctorIndex) => doctorIndex === index
      ? { ...doctor, [field]: value }
      : doctor));
  };

  const addDoctors = async (event) => {
    event.preventDefault();
    if (!database) {
      setError('Firebase is not configured. Add the Firebase values to .env and restart the app.');
      return;
    }

    if (form.some((doctor) => !doctor.slots.split(',').some((slot) => slot.trim()))) {
      setError('Add at least one appointment time for every doctor.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updates = {};
      for (const doctor of form) {
        const doctorRef = push(ref(database, 'doctors'));
        if (!doctorRef.key) throw new Error('Realtime Database did not create a doctor ID.');
        const slots = [...new Set(doctor.slots.split(',').map((slot) => slot.trim()).filter(Boolean))];
        updates[`doctors/${doctorRef.key}`] = {
          userId: doctorRef.key,
          name: doctor.name.trim(),
          specialty: doctor.specialty.trim(),
          title: doctor.title.trim(),
          hospital: doctor.hospital.trim(),
          city: doctor.city.trim(),
          years: Number(doctor.years),
          fee: Number(doctor.fee),
          rating: 5,
          reviews: 0,
          avatar: '🩺',
          color: 'mint',
          verificationStatus: 'approved',
          acceptingAppointments: true,
          slots,
          slotAvailability: Object.fromEntries(slots.map((slot) => [doctorSlotKey(slot), true])),
          about: '',
          qualifications: [],
          languages: 'English',
        };
      }
      await update(ref(database), updates);
      setForm([emptyDoctor()]);
      setNotice(`${form.length} doctor ${form.length === 1 ? 'profile' : 'profiles'} added. Patients can now find and book ${form.length === 1 ? 'this doctor' : 'them'}.`);
    } catch (saveError) {
      console.error('Unable to add doctor:', saveError);
      setError('Could not add doctor. Confirm this account is admin and publish the current database.rules.json.');
    } finally {
      setSaving(false);
    }
  };

  const reviewApplication = async (application, status) => {
    if (!database || reviewingUid) return;
    setReviewingUid(application.userId);
    setError('');
    setNotice('');
    try {
      const updates = {
        [`doctorApplications/${application.userId}/status`]: status,
        [`doctorApplications/${application.userId}/reviewedAt`]: serverTimestamp(),
      };
      if (status === 'Approved') {
        updates[`users/${application.userId}/role`] = 'doctor';
        updates[`doctors/${application.userId}`] = {
          userId: application.userId,
          name: application.name,
          specialty: application.specialty,
          title: application.title,
          hospital: application.hospital,
          city: application.city,
          years: Number(application.years || 0),
          fee: Number(application.fee || 0),
          rating: 5,
          reviews: 0,
          avatar: '🩺',
          color: 'mint',
          acceptingAppointments: true,
          verificationStatus: 'approved',
          slots: Array.isArray(application.slots) ? application.slots : [],
          slotAvailability: application.slotAvailability || Object.fromEntries((application.slots || []).map((slot) => [doctorSlotKey(slot), true])),
          about: '',
          qualifications: Array.isArray(application.qualifications) ? application.qualifications : [],
          languages: 'English',
        };
      }
      await update(ref(database), updates);
      setNotice(`${application.name}'s application was ${status.toLowerCase()}.`);
    } catch (reviewError) {
      console.error('Unable to review doctor application:', reviewError);
      setError('Could not update this application. Confirm the current database rules are published.');
    } finally {
      setReviewingUid('');
    }
  };

  const patients = accounts.filter((account) => account.role === 'patient' && `${account.displayName || ''} ${account.email || ''}`.toLowerCase().includes(patientSearch.toLowerCase()));
  const filteredAppointments = appointments.filter((appointment) => {
    const matchesStatus = appointmentFilter === 'All' || appointment.status === appointmentFilter;
    const searchText = `${appointment.patient || ''} ${appointment.patientEmail || ''} ${appointment.doctor?.name || ''} ${appointment.doctor?.specialty || ''}`.toLowerCase();
    return matchesStatus && searchText.includes(appointmentSearch.toLowerCase());
  });
  const pendingCount = appointments.filter((appointment) => appointment.status === 'Pending').length;
  const confirmedCount = appointments.filter((appointment) => appointment.status === 'Confirmed').length;
  const completedCount = appointments.filter((appointment) => appointment.status === 'Completed').length;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayCount = appointments.filter((appointment) => appointment.dateKey === todayKey).length;

  return <>
    <div className="dashboard-stats">
      <div className="stat-card"><span className="stat-icon mint"><Stethoscope size={18} /></span><div><span>Doctor profiles</span><strong>{doctors.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Available to patients</span></div>
      <div className="stat-card"><span className="stat-icon lilac"><Users size={18} /></span><div><span>Registered patients</span><strong>{accounts.filter((account) => account.role === 'patient').length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Patient accounts</span></div>
      <div className="stat-card"><span className="stat-icon peach"><CalendarDays size={18} /></span><div><span>Total appointments</span><strong>{appointments.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">All booking activity</span></div>
      <div className="stat-card"><span className="stat-icon yellow"><Clock3 size={18} /></span><div><span>Pending</span><strong>{pendingCount.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Needs review</span></div>
      <div className="stat-card"><span className="stat-icon mint"><CheckCircle2 size={18} /></span><div><span>Confirmed</span><strong>{confirmedCount.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Upcoming care</span></div>
      <div className="stat-card"><span className="stat-icon lilac"><BadgeCheck size={18} /></span><div><span>Completed</span><strong>{completedCount.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Visit history</span></div>
      <div className="stat-card"><span className="stat-icon peach"><CalendarDays size={18} /></span><div><span>Today</span><strong>{todayCount.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Appointments today</span></div>
    </div>
    <section className="admin-section">
      <div className="panel-title"><div><h2>Doctor applications</h2><p>{applications.filter((application) => application.status === 'Pending').length} awaiting review.</p></div></div>
      {applications.length ? <div className="appointment-list">{applications.map((application) => <div className="provider-row" key={application.userId}>
        <div className="patient-mini-avatar">{(application.name || 'D').slice(0, 1).toUpperCase()}</div>
        <div className="provider-patient"><strong>{application.name}</strong><span>{application.title} · {application.specialty}</span><span>{application.hospital} · {application.city}</span><span>License: {application.licenseNumber}</span></div>
        <div className="provider-time"><strong>{application.years} years</strong><span>${application.fee} / visit</span></div>
        <span className={`status-pill status-${(application.status || 'Pending').toLowerCase()}`}><i></i>{application.status || 'Pending'}</span>
        <div className="provider-buttons">{application.status === 'Pending' ? <><button className="accept-btn" onClick={() => reviewApplication(application, 'Approved')} disabled={Boolean(reviewingUid)}>{reviewingUid === application.userId ? 'Saving…' : 'Approve'}</button><button className="reject-btn" onClick={() => reviewApplication(application, 'Rejected')} disabled={Boolean(reviewingUid)}>Reject</button></> : <span className="details-btn">Reviewed</span>}</div>
      </div>)}</div> : <div className="empty-inline">No doctor applications are waiting for review.</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <p className="stat-trend" role="status">{notice}</p>}
    </section>
    <section className="admin-section">
      <div className="panel-title"><div><h2>Add doctors</h2><p>Create profiles patients can search and book.</p></div><button className="outline-btn" type="button" onClick={() => setForm((current) => [...current, emptyDoctor()])}><Plus size={15} /> Add another</button></div>
      <form className="admin-doctor-form" onSubmit={addDoctors}>
        {form.map((doctor, index) => <div className="form-section" key={doctor.rowId}>
          <div className="form-section-title"><span>{String(index + 1).padStart(2, '0')}</span><div><h2>Doctor {index + 1}</h2><p>Enter the provider details and available appointment times.</p></div>{form.length > 1 && <button className="text-link" type="button" onClick={() => setForm((current) => current.filter((entry) => entry.rowId !== doctor.rowId))} aria-label={`Remove doctor ${index + 1}`}><X size={15} /> Remove</button>}</div>
          <div className="patient-fields" style={{ paddingLeft: 0 }}>
            <label>Doctor name<input value={doctor.name} onChange={(event) => updateDoctorForm(index, 'name', event.target.value)} required /></label>
            <label>Specialty<input value={doctor.specialty} onChange={(event) => updateDoctorForm(index, 'specialty', event.target.value)} required /></label>
            <label>Professional title<input value={doctor.title} onChange={(event) => updateDoctorForm(index, 'title', event.target.value)} required /></label>
            <label>Hospital or clinic<input value={doctor.hospital} onChange={(event) => updateDoctorForm(index, 'hospital', event.target.value)} required /></label>
            <label>City<input value={doctor.city} onChange={(event) => updateDoctorForm(index, 'city', event.target.value)} required /></label>
            <label>Years of experience<input type="number" min="0" value={doctor.years} onChange={(event) => updateDoctorForm(index, 'years', event.target.value)} required /></label>
            <label>Consultation fee<input type="number" min="0" step="0.01" value={doctor.fee} onChange={(event) => updateDoctorForm(index, 'fee', event.target.value)} required /></label>
            <label>Appointment times<input value={doctor.slots} onChange={(event) => updateDoctorForm(index, 'slots', event.target.value)} required /></label>
          </div>
        </div>)}
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <p className="stat-trend" role="status">{notice}</p>}
        <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Adding doctors…' : `Save ${form.length} ${form.length === 1 ? 'doctor' : 'doctors'}`}</button>
      </form>
    </section>
    <section className="admin-section">
      <div className="panel-title"><div><h2>Doctor directory</h2><p>{doctors.length} profiles available for booking.</p></div></div>
      {doctors.length ? <div className="appointment-list">{doctors.map((doctor) => <div className="appointment-row" key={doctor.id}><div className="patient-mini-avatar">{doctor.name.slice(0, 1).toUpperCase()}</div><div className="appointment-info"><strong>{doctor.name}</strong><span>{doctor.title || doctor.specialty} · {doctor.specialty}</span><span>{doctor.hospital || 'Independent practice'} · {doctor.city || ''}</span></div><span className="status-pill status-confirmed"><i></i>Bookable</span></div>)}</div> : <div className="empty-inline">No doctors yet. Add a profile above to make it available for patient bookings.</div>}
    </section>
    <section className="admin-section">
      <div className="panel-title"><div><h2>Patient accounts</h2><p>{accounts.filter((account) => account.role === 'patient').length} registered patients.</p></div></div>
      <label className="listing-search"><Search size={18} /><input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Search patient name or email" /><button type="button" aria-label="Clear patient search" onClick={() => setPatientSearch('')}><X size={15} /></button></label>
      {patients.length ? <div className="appointment-list">{patients.map((patient) => <div className="appointment-row" key={patient.uid}><div className="patient-mini-avatar">{(patient.displayName || patient.email || 'P').slice(0, 1).toUpperCase()}</div><div className="appointment-info"><strong>{patient.displayName || 'Patient'}</strong><span>{patient.email || 'No email on file'}</span><span>Account: {patient.status || 'Active'}</span></div><span className="status-pill status-confirmed"><i></i>{patient.status || 'Active'}</span></div>)}</div> : <div className="empty-inline">No matching patient accounts.</div>}
    </section>
    <section className="admin-section">
      <div className="panel-title"><div><h2>Appointment management</h2><p>Search bookings and filter by current status.</p></div><label className="sort-control"><span>Status</span><select value={appointmentFilter} onChange={(event) => setAppointmentFilter(event.target.value)}><option>All</option><option>Pending</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select></label></div>
      <label className="listing-search"><Search size={18} /><input value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} placeholder="Search patient or doctor" /><button type="button" aria-label="Clear appointment search" onClick={() => setAppointmentSearch('')}><X size={15} /></button></label>
      {filteredAppointments.length ? <div className="appointment-list">{filteredAppointments.map((appointment) => <div className="provider-row" key={appointment.id}><div className="patient-mini-avatar">{(appointment.patient || 'P').slice(0, 1).toUpperCase()}</div><div className="provider-patient"><strong>{appointment.patient || 'Patient'}</strong><span>{appointment.patientEmail || ''}</span><span>{appointment.doctor?.name || 'Doctor'} · {appointment.doctor?.specialty || ''}</span></div><div className="provider-time"><strong>{appointment.date}</strong><span>{appointment.time}</span></div><span className={`status-pill status-${appointment.status.toLowerCase()}`}><i></i>{appointment.status}</span><div className="provider-buttons">{['Pending', 'Confirmed'].includes(appointment.status) && <button className="reject-btn" onClick={() => onUpdateAppointmentStatus(appointment.id, 'Cancelled')}>Cancel</button>}</div></div>)}</div> : <div className="empty-inline">No appointments match these filters.</div>}
    </section>
  </>;
}
