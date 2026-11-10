import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Clock3, XCircle } from 'lucide-react';
import { onValue, ref, serverTimestamp, set } from 'firebase/database';
import { database } from './firebase.js';

const initialForm = (user) => ({
  name: user?.displayName || '',
  specialty: '',
  title: '',
  licenseNumber: '',
  hospital: '',
  city: '',
  years: '',
  fee: '',
  qualifications: '',
  slots: '09:00 AM, 11:00 AM, 02:00 PM',
});

export default function DoctorApplication({ user, userProfile, onDashboard }) {
  const [form, setForm] = useState(() => initialForm(user));
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!database || !user?.uid) {
      setLoading(false);
      return undefined;
    }
    return onValue(ref(database, `doctorApplications/${user.uid}`), (snapshot) => {
      setApplication(snapshot.exists() ? snapshot.val() : null);
      setLoading(false);
    }, (loadError) => {
      console.error('Unable to load provider application:', loadError);
      setError('Your application status could not be loaded. Check the Realtime Database rules.');
      setLoading(false);
    });
  }, [user?.uid]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submitApplication = async (event) => {
    event.preventDefault();
    if (!database || !user?.uid) {
      setError('Firebase must be configured and you must be signed in to apply.');
      return;
    }
    if (application) return;

    setSaving(true);
    setError('');
    try {
      const splitList = (value) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
      const slots = [...new Set(splitList(form.slots))];
      if (!slots.length) {
        setError('Add at least one appointment time before submitting.');
        setSaving(false);
        return;
      }
      const payload = {
        userId: user.uid,
        name: form.name.trim(),
        email: user.email || '',
        specialty: form.specialty.trim(),
        title: form.title.trim(),
        licenseNumber: form.licenseNumber.trim(),
        hospital: form.hospital.trim(),
        city: form.city.trim(),
        years: Number(form.years),
        fee: Number(form.fee),
        qualifications: splitList(form.qualifications),
        slots,
        slotAvailability: Object.fromEntries(slots.map((slot) => [slot.replace(/[^A-Za-z0-9_-]/g, '_'), true])),
        status: 'Pending',
        submittedAt: serverTimestamp(),
      };
      await set(ref(database, `doctorApplications/${user.uid}`), payload);
      setApplication(payload);
    } catch (saveError) {
      console.error('Unable to submit provider application:', saveError);
      setError('Your application could not be submitted. Check the Realtime Database rules and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (userProfile?.role === 'doctor' || application?.status === 'Approved') {
    return <main className="page-shell dashboard-page"><div className="empty-state"><BadgeCheck size={26} /><h1>Provider access approved</h1><p>Your doctor profile is active. Open your dashboard to review appointment requests.</p><button className="primary-btn" onClick={onDashboard}>Open dashboard <ArrowRight size={16} /></button></div></main>;
  }

  if (userProfile?.role === 'admin') {
    return <main className="page-shell dashboard-page"><div className="empty-state"><BadgeCheck size={26} /><h1>Administrator account</h1><p>Use the admin dashboard to review provider applications and manage doctor profiles.</p><button className="primary-btn" onClick={onDashboard}>Open dashboard <ArrowRight size={16} /></button></div></main>;
  }

  if (loading) return <main className="page-shell dashboard-page"><div className="empty-state"><Clock3 size={24} /><p>Loading application status…</p></div></main>;

  if (application?.status === 'Pending') {
    return <main className="page-shell dashboard-page"><div className="empty-state"><Clock3 size={24} /><h1>Application under review</h1><p>Your provider application is pending admin review. We’ll update this page when it has been reviewed.</p><span className="status-pill status-pending"><i></i>Pending</span></div></main>;
  }

  if (application?.status === 'Rejected') {
    return <main className="page-shell dashboard-page"><div className="empty-state"><XCircle size={24} /><h1>Application not approved</h1><p>Your application was not approved. Contact the platform administrator for details.</p><span className="status-pill status-cancelled"><i></i>Rejected</span></div></main>;
  }

  return <main className="page-shell booking-page"><div className="breadcrumb"><button onClick={onDashboard}>Dashboard</button><ArrowRight size={14} /><span>Provider application</span></div><div className="booking-layout"><form className="booking-form" onSubmit={submitApplication}>
    <div className="form-heading"><span className="section-kicker">PROVIDER NETWORK</span><h1>Apply as a doctor.</h1><p>Submit your professional details for admin verification.</p></div>
    <div className="form-section"><div className="patient-fields">
      <label>Full name<input value={form.name} onChange={(event) => updateField('name', event.target.value)} required /></label>
      <label>Specialty<input value={form.specialty} onChange={(event) => updateField('specialty', event.target.value)} required /></label>
      <label>Professional title<input value={form.title} onChange={(event) => updateField('title', event.target.value)} required /></label>
      <label>License or registration number<input value={form.licenseNumber} onChange={(event) => updateField('licenseNumber', event.target.value)} required /></label>
      <label>Hospital or clinic<input value={form.hospital} onChange={(event) => updateField('hospital', event.target.value)} required /></label>
      <label>City<input value={form.city} onChange={(event) => updateField('city', event.target.value)} required /></label>
      <label>Years of experience<input type="number" min="0" step="1" value={form.years} onChange={(event) => updateField('years', event.target.value)} required /></label>
      <label>Consultation fee<input type="number" min="0" step="0.01" value={form.fee} onChange={(event) => updateField('fee', event.target.value)} required /></label>
      <label>Qualifications<textarea rows="3" value={form.qualifications} onChange={(event) => updateField('qualifications', event.target.value)} placeholder="One qualification per line" required /></label>
      <label>Appointment times<input value={form.slots} onChange={(event) => updateField('slots', event.target.value)} required /></label>
    </div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for verification'} <ArrowRight size={16} /></button>
  </form></div></main>;
}
