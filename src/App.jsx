import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { equalTo, get, onValue, orderByChild, push, query as databaseQuery, ref, runTransaction, serverTimestamp, set, update } from 'firebase/database';
import AdminDashboard from './AdminDashboard.jsx';
import DynamicBookingPage from './BookingPage.jsx';
import DoctorApplication from './DoctorApplication.jsx';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck,
  CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, CreditCard, Heart, LayoutDashboard, Menu, MessageCircle,
  Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Star, Stethoscope,
  UserRound, Users, X,
} from 'lucide-react';
import { auth, database, firebaseConfigured } from './firebase.js';

const doctors = [
  { id: 1, name: 'Dr. Olivia Rhye', specialty: 'Cardiology', title: 'Cardiologist', years: 12, fee: 120, rating: 4.98, reviews: 284, hospital: 'Northstar Medical Center', city: 'New York, NY', avatar: '👩🏻‍⚕️', color: 'peach', slots: ['09:00 AM', '10:30 AM', '02:00 PM'], about: 'I help patients understand their heart health and create a care plan that fits their life. My approach is thoughtful, collaborative, and focused on the whole person.', qualifications: ['MD, Columbia University', 'Fellowship in Cardiology, NYU Langone'], languages: 'English, Spanish' },
  { id: 2, name: 'Dr. Phoenix Baker', specialty: 'Dermatology', title: 'Dermatologist', years: 9, fee: 95, rating: 4.96, reviews: 198, hospital: 'Bloom Dermatology Clinic', city: 'New York, NY', avatar: '👨🏽‍⚕️', color: 'lavender', slots: ['10:00 AM', '11:30 AM', '03:30 PM'], about: 'Skin health is personal. I specialize in evidence-based dermatology and make sure every visit leaves you feeling informed, comfortable, and confident.', qualifications: ['MD, Johns Hopkins University', 'Board certified in Dermatology'], languages: 'English, French' },
  { id: 3, name: 'Dr. Lana Steiner', specialty: 'Pediatrics', title: 'Pediatrician', years: 15, fee: 110, rating: 4.99, reviews: 352, hospital: 'Little Steps Children’s Hospital', city: 'Brooklyn, NY', avatar: '👩🏽‍⚕️', color: 'mint', slots: ['09:30 AM', '01:00 PM', '04:00 PM'], about: 'I believe great pediatric care starts with listening—to children and the people who love them. I partner with families at every stage of their child’s health.', qualifications: ['MD, Boston University', 'Pediatric Residency, Mount Sinai'], languages: 'English, Mandarin' },
  { id: 4, name: 'Dr. Demi Wilkinson', specialty: 'Neurology', title: 'Neurologist', years: 11, fee: 140, rating: 4.93, reviews: 176, hospital: 'Northstar Medical Center', city: 'New York, NY', avatar: '👨🏻‍⚕️', color: 'sky', slots: ['08:30 AM', '12:00 PM', '02:30 PM'], about: 'Neurological symptoms can feel overwhelming. I offer clear answers, compassionate care, and treatment plans grounded in the latest research.', qualifications: ['MD, Yale School of Medicine', 'Neurology Residency, Columbia'], languages: 'English' },
  { id: 5, name: 'Dr. Candice Wu', specialty: 'Dentistry', title: 'Dentist', years: 8, fee: 85, rating: 4.97, reviews: 211, hospital: 'Brightside Dental Studio', city: 'Queens, NY', avatar: '👩🏻‍⚕️', color: 'butter', slots: ['09:00 AM', '11:00 AM', '01:30 PM'], about: 'A healthy smile should never come with stress. I provide gentle, modern dental care and take the time to make every patient feel at ease.', qualifications: ['DDS, University of Pennsylvania', 'Advanced training in restorative dentistry'], languages: 'English, Korean' },
  { id: 6, name: 'Dr. Drew Cano', specialty: 'Orthopedics', title: 'Orthopedic Surgeon', years: 14, fee: 130, rating: 4.95, reviews: 167, hospital: 'Harborview Orthopedic Institute', city: 'Manhattan, NY', avatar: '👨🏾‍⚕️', color: 'blue', slots: ['08:00 AM', '10:00 AM', '03:00 PM'], about: 'Getting back to what you love is the goal. I combine conservative treatment and minimally invasive techniques to help patients move comfortably again.', qualifications: ['MD, University of Michigan', 'Orthopedic Surgery, Hospital for Special Surgery'], languages: 'English, Spanish' },
];

const departments = [
  { name: 'Cardiology', icon: Heart, color: 'rose', count: '24 doctors' },
  { name: 'Dermatology', icon: Sparkles, color: 'lilac', count: '18 doctors' },
  { name: 'Pediatrics', icon: Users, color: 'green', count: '32 doctors' },
  { name: 'Neurology', icon: Activity, color: 'blue', count: '12 doctors' },
  { name: 'Dentistry', icon: Sparkles, color: 'yellow', count: '20 doctors' },
  { name: 'Orthopedics', icon: Stethoscope, color: 'peach', count: '16 doctors' },
];

const ADMIN_EMAIL = 'pathanayeshaanjum2006@gmail.com';

function pageFromPath(pathname) {
  if (pathname === '/') return 'home';
  if (pathname === '/doctors') return 'doctors';
  if (pathname.startsWith('/doctors/')) return 'profile';
  if (pathname.startsWith('/booking/')) return 'booking';
  if (pathname === '/appointments') return 'patient';
  if (pathname === '/apply-doctor') return 'applyDoctor';
  return 'home';
}

function pathForPage(page, doctor) {
  if (page === 'doctors') return '/doctors';
  if (page === 'profile') return doctor ? `/doctors/${encodeURIComponent(doctor.id)}` : '/doctors';
  if (page === 'booking') return doctor ? `/booking/${encodeURIComponent(doctor.id)}` : '/doctors';
  if (page === 'patient') return '/appointments';
  if (page === 'applyDoctor') return '/apply-doctor';
  return '/';
}

const initialAppointments = [
  { id: 'DS-24091', doctor: doctors[0], date: 'May 22, 2025', time: '10:30 AM', patient: 'Alex Morgan', reason: 'Annual heart checkup', status: 'Confirmed' },
  { id: 'DS-24088', doctor: doctors[2], date: 'May 26, 2025', time: '01:00 PM', patient: 'Alex Morgan', reason: 'Regular checkup', status: 'Pending' },
  { id: 'DS-23952', doctor: doctors[1], date: 'May 8, 2025', time: '11:30 AM', patient: 'Alex Morgan', reason: 'Skin consultation', status: 'Completed' },
];

function Avatar({ doctor, small = false }) {
  return <div className={`avatar ${doctor.color} ${small ? 'avatar-small' : ''}`} aria-hidden="true">{doctor.avatar}</div>;
}

function Brand({ onClick }) {
  return <button className="brand" onClick={onClick} aria-label="DoctorSlot home"><span className="brand-icon"><Activity size={20} strokeWidth={2.6} /></span><span>doctor<span className="brand-accent">slot</span><i>.</i></span></button>;
}

function Header({ page, setPage, onDoctors, user, onLogin, onLogout, authLoading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (next) => { setPage(next); setMenuOpen(false); };
  const openAuth = (destination = 'home') => { onLogin(destination); setMenuOpen(false); };
  return <header className="topbar"><div className="nav-wrap">
    <Brand onClick={() => go('home')} />
    <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
    <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`}>
      <button className={page === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => go('home')}>Home</button>
      <button className={page === 'doctors' ? 'nav-link active' : 'nav-link'} onClick={() => { onDoctors(); setMenuOpen(false); }}>Find a doctor</button>
      <button className={page === 'patient' ? 'nav-link active' : 'nav-link'} onClick={() => go('patient')}>My appointments</button>
      <div className="nav-dropdown"><button className="nav-link" onClick={() => go('applyDoctor')}>For providers <ChevronDown size={14} /></button></div>
      {!user && <div className="mobile-auth-links"><button className="nav-link" onClick={() => openAuth()} disabled={authLoading}>{authLoading ? 'Connecting…' : 'Continue with Google'}</button></div>}
    </nav>
    <div className="nav-actions">{user ? <><button className="profile-chip" onClick={() => go('patient')}><span className="profile-avatar">{(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}</span><span>{user.displayName || user.email}</span><ChevronDown size={14} /></button><button className="nav-auth-btn" onClick={onLogout}>Log out</button></> : <button className="primary-btn nav-cta" onClick={() => openAuth()} disabled={authLoading}>{authLoading ? 'Connecting…' : 'Continue with Google'}</button>}<button className="primary-btn nav-cta" onClick={onDoctors}>Book a visit <ArrowRight size={16} /></button></div>
  </div></header>;
}

function mapDoctorData(id, data) {
  return {
    ...data,
    id,
    name: data.name || 'Doctor',
    specialty: data.specialty || 'General practice',
    title: data.title || data.specialty || 'Doctor',
    years: Number(data.years || 0),
    fee: Number(data.fee || 0),
    rating: Number(data.rating || 5),
    reviews: Number(data.reviews || 0),
    hospital: data.hospital || 'Independent practice',
    city: data.city || '',
    avatar: data.avatar || '🧑‍⚕️',
    color: data.color || 'mint',
    slots: Array.isArray(data.slots) ? data.slots : [],
    qualifications: Array.isArray(data.qualifications) ? data.qualifications : [],
    about: data.about || '',
    languages: data.languages || 'English',
  };
}

function DoctorCard({ doctor, onView, onBook }) {
  return <article className="doctor-card"><div className="card-top"><Avatar doctor={doctor} /><button className="favorite-btn" aria-label={`Save ${doctor.name}`}><Heart size={18} /></button></div>
    <div className="doctor-card-title"><div><h3>{doctor.name}</h3><p>{doctor.title}</p></div><div className="rating"><Star size={14} fill="currentColor" /> {doctor.rating} <span>({doctor.reviews})</span></div></div>
    <div className="doctor-meta"><span><BadgeCheck size={15} /> {doctor.years} years experience</span><span><Stethoscope size={15} /> {doctor.hospital}</span></div>
    <div className="specialty-pill">{doctor.specialty}</div>
    <div className="card-bottom"><div><span className="fee-label">Consultation</span><strong>${doctor.fee}<span> / visit</span></strong></div><button className="outline-btn" onClick={() => onView(doctor)}>View profile <ArrowUpRight size={14} /></button></div>
    <div className="slot-teaser"><Clock3 size={14} /><span>Next available</span><strong>{doctor.slots[0]}</strong><button onClick={() => onBook(doctor)}>Book <ArrowRight size={14} /></button></div>
  </article>;
}

function Home({ setPage, onSearch, onSpecialty, onDoctors, onView, onBook, doctorsList }) {
  return <main>
    <section className="hero"><div className="hero-grid"><div className="hero-content">
      <div className="eyebrow"><span className="eyebrow-dot"></span> Healthcare that works for you</div>
      <h1>Your health.<br />Your time.<br /><span>Your appointment.</span></h1>
      <p className="hero-copy">Good care starts with a good connection. Find the right doctor, book a time that works, and feel better about your health.</p>
      <form className="hero-search" onSubmit={(e) => { e.preventDefault(); onSearch(e.currentTarget.elements.search.value); }}><Search size={20} /><input name="search" placeholder="Doctor name or specialty" aria-label="Search doctor name or specialty" /><span className="search-divider"></span><button type="button" className="location-select">⌖ <span>New York, NY</span><ChevronDown size={14} /></button><button className="primary-btn search-submit" type="submit">Find a doctor <ArrowRight size={16} /></button></form>
      <div className="hero-trust"><div className="trust-avatars"><span>👩🏻</span><span>👨🏽</span><span>👩🏾</span><span>👨🏻</span></div><div><div className="trust-stars"><Star size={13} fill="currentColor" /> <b>4.9/5</b> <span>from 2,400+ patients</span></div><span className="trust-caption">Real people. Better care.</span></div></div>
      <div className="hero-stats"><div><strong>120<span>+</span></strong><span>verified doctors</span></div><i></i><div><strong>18<span>k</span></strong><span>happy patients</span></div><i></i><div><strong>4.9<span>/5</span></strong><span>average rating</span></div></div>
    </div><div className="hero-visual"><div className="hero-blob"></div><div className="hero-image"><div className="hero-image-top"><div className="image-label"><span className="online-dot"></span> Available today</div><div className="image-sparkle">✳</div></div><div className="doctor-illustration">👩🏻‍⚕️</div><div className="floating-card appointment-float"><div className="float-icon"><CalendarDays size={18} /></div><div><strong>Appointment confirmed</strong><span>Dr. Olivia Rhye · 10:30 AM</span></div><CheckCircle2 size={20} className="float-check" /></div><div className="floating-card rating-float"><div className="float-star"><Star size={15} fill="currentColor" /></div><div><strong>Top-rated doctors</strong><span>Patient-loved care</span></div></div><div className="image-caption"><div className="caption-verified"><ShieldCheck size={15} /> Care you can count on</div></div></div><div className="hero-deco deco-one">✳</div><div className="hero-deco deco-two">✳</div></div></div><div className="hero-bottom-note"><span>✦</span> YOUR NEXT CHAPTER IN BETTER HEALTH STARTS HERE <span>✦</span></div></section>
    <section className="section departments-section"><div className="section-heading"><div><span className="section-kicker">CARE FOR EVERY YOU</span><h2>Find the care you need.</h2><p>Whatever’s on your mind, there’s a specialist ready to listen.</p></div><button className="text-link" onClick={() => setPage('doctors')}>Explore all specialties <ArrowRight size={16} /></button></div>
      <div className="department-grid">{departments.map(({ name, icon: Icon, color, count }) => <button className="department-card" key={name} onClick={() => onSpecialty(name)}><span className={`department-icon ${color}`}><Icon size={22} /></span><span className="department-name">{name}</span><span className="department-count">{count}</span><ArrowUpRight size={16} className="department-arrow" /></button>)}</div>
    </section>
    <section className="section featured-section"><div className="section-heading"><div><span className="section-kicker">A GOOD PLACE TO START</span><h2>Meet your care team.</h2><p>Trusted, vetted, and here when you need them.</p></div><button className="text-link" onClick={() => setPage('doctors')}>Meet all doctors <ArrowRight size={16} /></button></div><div className="doctor-grid">{doctorsList.slice(0, 3).map((doctor) => <DoctorCard doctor={doctor} key={doctor.id} onView={onView} onBook={onBook} />)}</div></section>
    <section className="care-banner"><div className="care-copy"><span className="section-kicker">CARE THAT FITS YOUR LIFE</span><h2>Less waiting.<br />More feeling better.</h2><p>Find a doctor you trust, pick a time that works, and book in just a few clicks. Your health journey, on your terms.</p><button className="primary-btn" onClick={onDoctors}>Find your doctor <ArrowRight size={16} /></button></div><div className="care-visual"><div className="care-orbit orbit-1"></div><div className="care-orbit orbit-2"></div><div className="care-big-icon"><Heart size={43} fill="currentColor" /></div><span className="care-float care-float-1">🌿 Thoughtful care</span><span className="care-float care-float-2">💚 Your wellbeing, first</span></div></section>
  </main>;
}

function DoctorsPage({ query, setQuery, selectedSpecialty, setSpecialty, onView, onBook, doctorsList }) {
  const [sort, setSort] = useState('Recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = useMemo(() => doctorsList.filter((doctor) => {
    const matchesText = `${doctor.name} ${doctor.title} ${doctor.specialty} ${doctor.hospital}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (!selectedSpecialty || doctor.specialty === selectedSpecialty);
  }).sort((a, b) => sort === 'Lowest fee' ? a.fee - b.fee : sort === 'Top rated' ? b.rating - a.rating : 0), [query, selectedSpecialty, sort]);
  return <main className="page-shell"><div className="breadcrumb"><button>Home</button><ChevronRight size={14} /><span>Find a doctor</span></div><div className="listing-header"><div><span className="section-kicker">YOUR CARE, YOUR CHOICE</span><h1>Find your doctor.</h1><p>Great care starts with finding the right person.</p></div><div className="listing-illustration">🩺</div></div>
    <div className="listing-toolbar"><label className="listing-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, specialty, or hospital" /><button aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button></label><button className={`filter-btn ${filtersOpen ? 'filter-active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} /> Filters <span className="filter-count">{selectedSpecialty ? '1' : '0'}</span></button><label className="sort-control"><span>Sort by</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option>Recommended</option><option>Top rated</option><option>Lowest fee</option></select><ChevronDown size={14} /></label></div>
    {filtersOpen && <div className="filter-panel"><div><strong>Specialty</strong><div className="filter-options"><button className={!selectedSpecialty ? 'filter-option selected' : 'filter-option'} onClick={() => setSpecialty('')}>All specialties</button>{departments.map((dept) => <button key={dept.name} className={selectedSpecialty === dept.name ? 'filter-option selected' : 'filter-option'} onClick={() => setSpecialty(selectedSpecialty === dept.name ? '' : dept.name)}>{dept.name}</button>)}</div></div><button className="clear-filters" onClick={() => { setSpecialty(''); setQuery(''); }}>Clear all</button></div>}
    <div className="results-caption"><span><strong>{filtered.length} doctors</strong> available for you</span><span className="verified-note"><ShieldCheck size={15} /> All doctors verified</span></div>
    {filtered.length ? <div className="doctor-grid listing-grid">{filtered.map((doctor) => <DoctorCard doctor={doctor} key={doctor.id} onView={onView} onBook={onBook} />)}</div> : <div className="empty-state"><Search size={26} /><h3>No doctors found</h3><p>Try a different name or specialty.</p><button className="outline-btn" onClick={() => { setQuery(''); setSpecialty(''); }}>Clear search</button></div>}
  </main>;
}

function ProfilePage({ doctor, onBack, onBook }) {
  return <main className="page-shell"><div className="breadcrumb"><button onClick={onBack}>Find a doctor</button><ChevronRight size={14} /><span>{doctor.name}</span></div><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to doctors</button><div className="profile-layout"><div className="profile-main"><section className="profile-card"><div className="profile-hero"><Avatar doctor={doctor} /><div className="profile-intro"><div className="verified-badge"><BadgeCheck size={15} /> VERIFIED DOCTOR</div><h1>{doctor.name}</h1><p>{doctor.title} <span>·</span> {doctor.specialty}</p><div className="profile-rating"><Star size={15} fill="currentColor" /> <b>{doctor.rating}</b> <span>({doctor.reviews} patient reviews)</span></div></div><button className="favorite-btn profile-favorite" aria-label="Save doctor"><Heart size={20} /></button></div><div className="profile-quickfacts"><div><span className="fact-icon"><BadgeCheck size={17} /></span><span><small>Experience</small><strong>{doctor.years} years</strong></span></div><div><span className="fact-icon"><CreditCard size={17} /></span><span><small>Consultation fee</small><strong>${doctor.fee} / visit</strong></span></div><div><span className="fact-icon"><MessageCircle size={17} /></span><span><small>Languages</small><strong>{doctor.languages}</strong></span></div></div></section>
      <section className="detail-card"><div className="detail-heading"><h2>About {doctor.name.split(' ')[1]}</h2><span className="detail-decor">✳</span></div><p>{doctor.about}</p><div className="detail-subhead"><h3>Qualifications</h3><span>Education & training</span></div><ul className="qualification-list">{doctor.qualifications.map((q) => <li key={q}><CheckCircle2 size={17} />{q}</li>)}</ul></section>
      <section className="detail-card hospital-card"><div className="detail-heading"><h2>Hospital & clinic</h2><span className="hospital-icon"><Stethoscope size={19} /></span></div><div className="hospital-info"><strong>{doctor.hospital}</strong><span>{doctor.city}</span><button className="text-link">View directions <ArrowUpRight size={14} /></button></div></section>
    </div><aside className="booking-side"><div className="booking-widget"><div className="booking-widget-title"><div><span className="section-kicker">MAKE IT HAPPEN</span><h2>Book a visit</h2></div><span className="online-status"><i></i> Online</span></div><p className="widget-subtitle">Choose a time that works for you.</p><div className="selected-date"><CalendarDays size={17} /><strong>Available today</strong><ChevronDown size={15} /></div><div className="mini-calendar"><div className="calendar-month"><button aria-label="Previous month"><ChevronLeft size={16} /></button><strong>May 2025</strong><button aria-label="Next month"><ChevronRight size={16} /></button></div><div className="calendar-week">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={i}>{day}</span>)}</div><div className="calendar-days">{[28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1].map((day, i) => <button key={i} className={day === 22 && i === 24 ? 'date-active' : [8, 15, 22, 29].includes(day) && i > 5 && i < 34 ? 'date-available' : ''}>{day}</button>)}</div></div><span className="time-label">AVAILABLE TIMES · MAY 22</span><div className="profile-slots">{doctor.slots.map((slot, i) => <button key={slot} className={i === 1 ? 'time-slot chosen' : 'time-slot'} onClick={(e) => { document.querySelectorAll('.profile-slots .time-slot').forEach((el) => el.classList.remove('chosen')); e.currentTarget.classList.add('chosen'); }}>{slot}</button>)}</div><button className="primary-btn booking-cta" onClick={() => onBook(doctor)}>Continue to booking <ArrowRight size={16} /></button><div className="no-charge"><ShieldCheck size={14} /> No charge until your visit</div></div><div className="help-note"><span><Heart size={16} /></span><div><strong>Need a hand?</strong><p>Our care team is here to help you find the right care.</p><button>Talk to our team <ArrowRight size={13} /></button></div></div></aside></div></main>;
}

function BookingPage({ doctor, setPage, onConfirm }) {
  const [date, setDate] = useState('May 22, 2025');
  const [time, setTime] = useState(doctor.slots[1]);
  const [details, setDetails] = useState({ name: 'Alex Morgan', email: 'alex.morgan@email.com', phone: '+1 (212) 555-0184', reason: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!details.name.trim() || !details.email.trim() || !details.phone.trim()) { setError('Please fill in your name, email, and phone number.'); return; }
    setSubmitting(true);
    setError('Submitting your appointment…');
    try {
      const saved = await onConfirm({
        doctor,
        date,
        time,
        patient: details.name,
        patientEmail: details.email,
        patientPhone: details.phone,
        reason: details.reason || 'General consultation',
        status: 'Confirmed',
      });
      setError(saved ? '' : 'Appointment was not confirmed. Check the message below and try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return <main className="page-shell booking-page"><div className="breadcrumb"><button onClick={() => setPage('doctors')}>Find a doctor</button><ChevronRight size={14} /><span>Book appointment</span></div><button className="back-link" onClick={() => setPage('profile')}><ArrowLeft size={16} /> Back to doctor profile</button><div className="booking-layout"><form className="booking-form" onSubmit={submit}><div className="form-heading"><span className="section-kicker">JUST A FEW DETAILS</span><h1>Book your visit.</h1><p>All set in a couple of minutes.</p></div><div className="form-section"><div className="form-section-title"><span>01</span><div><h2>Choose a date</h2><p>Pick a day that works for you.</p></div></div><div className="date-choice-grid">{['May 22, 2025', 'May 23, 2025', 'May 26, 2025', 'May 27, 2025'].map((d, i) => <button type="button" key={d} className={`date-choice ${date === d ? 'selected' : ''}`} onClick={() => setDate(d)}><span>{['THU', 'FRI', 'MON', 'TUE'][i]}</span><strong>{[22, 23, 26, 27][i]}</strong><small>May 2025</small></button>)}</div></div><div className="form-section"><div className="form-section-title"><span>02</span><div><h2>Choose a time</h2><p>All times shown in Eastern Time (ET).</p></div></div><div className="booking-time-grid">{doctor.slots.map((slot, i) => <button type="button" key={slot} className={`time-slot ${time === slot ? 'chosen' : ''}`} onClick={() => setTime(slot)}><Clock3 size={15} />{slot}{i === 1 && <span>Popular</span>}</button>)}</div></div><div className="form-section patient-fields-section"><div className="form-section-title"><span>03</span><div><h2>Your details</h2><p>Who are we booking this appointment for?</p></div></div><div className="patient-fields"><label>Full name<input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} required /></label><label>Email address<input type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} required /></label><label>Phone number<input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} required /></label><label>What brings you in? <span className="optional">(optional)</span><textarea rows="3" placeholder="Tell your doctor a little about what you need..." value={details.reason} onChange={(e) => setDetails({ ...details, reason: e.target.value })}></textarea></label></div></div>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-btn confirm-btn" type="submit">Confirm appointment <ArrowRight size={16} /></button><p className="form-privacy"><ShieldCheck size={14} /> Your health information is safe and secure.</p></form><aside className="booking-summary"><div className="summary-header"><span className="section-kicker">YOUR APPOINTMENT</span><span className="summary-step">STEP 1 OF 1</span></div><div className="summary-doctor"><Avatar doctor={doctor} small /><div><strong>{doctor.name}</strong><span>{doctor.title} · {doctor.specialty}</span><div className="rating"><Star size={13} fill="currentColor" /> {doctor.rating} <span>({doctor.reviews})</span></div></div></div><div className="summary-line"><CalendarDays size={16} /><span>{date}</span></div><div className="summary-line"><Clock3 size={16} /><span>{time} <small>· 30 min</small></span></div><div className="summary-line"><Stethoscope size={16} /><span>{doctor.hospital}</span></div><div className="summary-price"><span>Consultation fee</span><strong>${doctor.fee}.00</strong></div><div className="summary-total"><span>Total due at visit</span><strong>${doctor.fee}.00</strong></div><div className="summary-secure"><ShieldCheck size={16} /><span>Secure booking. No payment required now.</span></div><div className="summary-note"><span>💡</span><p>You can cancel or reschedule your appointment up to 24 hours before your visit.</p></div></aside></div></main>;
}

function PatientDashboard({ appointments, user, userProfile, onUpdateAppointmentStatus, setPage, onViewDoctor, onBookDoctor, onUpdateProfile }) {
  const [tab, setTab] = useState('Upcoming');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ displayName: '', phone: '', dateOfBirth: '' });
  const upcoming = appointments.filter((appointment) => ['Confirmed', 'Pending'].includes(appointment.status));
  const past = appointments.filter((appointment) => ['Completed', 'Cancelled'].includes(appointment.status));
  const visible = tab === 'Upcoming' ? upcoming : past;
  const displayName = userProfile?.displayName || user?.displayName || 'Patient';

  useEffect(() => {
    setProfileForm({
      displayName: userProfile?.displayName || user?.displayName || '',
      phone: userProfile?.phone || '',
      dateOfBirth: userProfile?.dateOfBirth || '',
    });
  }, [user, userProfile]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    const saved = await onUpdateProfile({
      displayName: profileForm.displayName.trim(),
      phone: profileForm.phone.trim(),
      dateOfBirth: profileForm.dateOfBirth,
    });
    if (saved) setEditingProfile(false);
    setSavingProfile(false);
  };

  return <main className="page-shell dashboard-page">
    <div className="dashboard-welcome"><div><span className="section-kicker">YOUR PERSONAL HEALTH SPACE</span><h1>Welcome, {displayName}.</h1><p>Here’s what’s happening with your care.</p></div><button className="outline-btn" onClick={() => setPage('doctors')}><CalendarDays size={16} /> Book a visit</button></div>
    <div className="dashboard-stats">
      <div className="stat-card"><span className="stat-icon mint"><CalendarDays size={18} /></span><div><span>Upcoming visits</span><strong>{upcoming.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">On your calendar</span></div>
      <div className="stat-card"><span className="stat-icon lilac"><CheckCircle2 size={18} /></span><div><span>Completed visits</span><strong>{past.filter((appointment) => appointment.status === 'Completed').length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Appointment history</span></div>
      <div className="stat-card"><span className="stat-icon peach"><Heart size={18} /></span><div><span>Total appointments</span><strong>{appointments.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Across your care</span></div>
    </div>
    <div className="dashboard-columns">
      <section className="dash-panel"><div className="panel-title"><div><h2>Your appointments</h2><p>Keep track of your care, all in one place.</p></div><button className="text-link" onClick={() => setPage('doctors')}>Book new <ArrowRight size={14} /></button></div>
        <div className="table-tabs"><button className={tab === 'Upcoming' ? 'active' : ''} onClick={() => setTab('Upcoming')}>Upcoming <span>{upcoming.length}</span></button><button className={tab === 'Past' ? 'active' : ''} onClick={() => setTab('Past')}>Past appointments</button></div>
        <div className="appointment-list">{visible.length ? visible.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onView={() => onViewDoctor(appointment.doctor)} onCancel={() => onUpdateAppointmentStatus(appointment.id, 'Cancelled')} onReschedule={() => onBookDoctor(appointment.doctor)} />) : <div className="empty-inline">No {tab.toLowerCase()} appointments yet. Find a doctor to book your first visit.</div>}</div>
      </section>
      <aside className="profile-panel"><div className="profile-panel-heading"><h2>Your profile</h2>{user && !editingProfile && <button aria-label="Edit profile" onClick={() => setEditingProfile(true)}><Settings size={17} /></button>}</div>
        {editingProfile ? <form className="patient-fields" onSubmit={saveProfile}>
          <label>Full name<input value={profileForm.displayName} onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))} required /></label>
          <label>Email<strong>{user?.email || 'Not provided'}</strong></label>
          <label>Phone<input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label>Date of birth<input type="date" value={profileForm.dateOfBirth} onChange={(event) => setProfileForm((current) => ({ ...current, dateOfBirth: event.target.value }))} /></label>
          <div className="profile-actions"><button className="primary-btn" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button><button className="outline-btn" type="button" onClick={() => setEditingProfile(false)} disabled={savingProfile}>Cancel</button></div>
        </form> : <div className="patient-profile"><div className="patient-avatar">{displayName.slice(0, 1).toUpperCase()}</div><h3>{displayName}</h3><p>{userProfile?.createdAt ? `Patient since ${new Date(userProfile.createdAt).getFullYear()}` : 'Patient account'}</p><div className="profile-data"><div><span>Email</span><strong>{user?.email || userProfile?.email || 'Not provided'}</strong></div><div><span>Phone</span><strong>{userProfile?.phone || 'Not provided'}</strong></div><div><span>Date of birth</span><strong>{userProfile?.dateOfBirth || 'Not provided'}</strong></div></div>{user && <button className="outline-btn edit-profile" onClick={() => setEditingProfile(true)}>Edit profile <ArrowRight size={14} /></button>}</div>}
        <div className="health-reminder"><span>🌱</span><div><strong>A little reminder</strong><p>Your health deserves a spot on your calendar.</p></div></div>
      </aside>
    </div>
  </main>;
}

function Dashboard({ appointments, onUpdateAppointmentStatus, setPage, setRole, role, onViewDoctor, onBookDoctor }) {
  const [tab, setTab] = useState('Upcoming');
  const upcoming = appointments.filter((a) => ['Confirmed', 'Pending'].includes(a.status));
  const past = appointments.filter((a) => ['Completed', 'Cancelled'].includes(a.status));
  const visible = tab === 'Upcoming' ? upcoming : past;
  return <main className="page-shell dashboard-page"><div className="dashboard-welcome"><div><span className="section-kicker">{role === 'patient' ? 'YOUR PERSONAL HEALTH SPACE' : role === 'doctor' ? 'PROVIDER PORTAL' : 'PLATFORM ADMINISTRATION'}</span><h1>{role === 'patient' ? <>Good morning, Alex <span>☀️</span></> : role === 'doctor' ? 'Welcome back, Dr. Olivia' : 'Good morning, Admin'}</h1><p>{role === 'patient' ? 'Here’s what’s happening with your care.' : role === 'doctor' ? 'Here’s your practice at a glance today.' : 'Here’s what’s happening across DoctorSlot.'}</p></div><button className="outline-btn" onClick={() => setPage('doctors')}><CalendarDays size={16} /> Book a visit</button></div>
    {(!firebaseConfigured || role === 'admin') && <div className="dashboard-tabs"><button className={role === 'patient' ? 'dash-tab selected' : 'dash-tab'} onClick={() => setRole('patient')}><UserRound size={16} /> Patient view</button><button className={role === 'doctor' ? 'dash-tab selected' : 'dash-tab'} onClick={() => setRole('doctor')}><Stethoscope size={16} /> Doctor view</button>{(!firebaseConfigured || role === 'admin') && <button className={role === 'admin' ? 'dash-tab selected' : 'dash-tab'} onClick={() => setRole('admin')}><LayoutDashboard size={16} /> Admin view</button>}</div>}
    {role === 'patient' ? <><div className="dashboard-stats"><div className="stat-card"><span className="stat-icon mint"><CalendarDays size={18} /></span><div><span>Upcoming visits</span><strong>{upcoming.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">On your calendar</span></div><div className="stat-card"><span className="stat-icon lilac"><CheckCircle2 size={18} /></span><div><span>Completed visits</span><strong>{past.filter((a) => a.status === 'Completed').length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">You’re doing great</span></div><div className="stat-card"><span className="stat-icon peach"><Heart size={18} /></span><div><span>Favorite doctors</span><strong>03</strong></div><span className="stat-trend">Your trusted team</span></div></div><div className="dashboard-columns"><section className="dash-panel"><div className="panel-title"><div><h2>Your appointments</h2><p>Keep track of your care, all in one place.</p></div><button className="text-link" onClick={() => setPage('doctors')}>Book new <ArrowRight size={14} /></button></div><div className="table-tabs"><button className={tab === 'Upcoming' ? 'active' : ''} onClick={() => setTab('Upcoming')}>Upcoming <span>{upcoming.length}</span></button><button className={tab === 'Past' ? 'active' : ''} onClick={() => setTab('Past')}>Past appointments</button></div><div className="appointment-list">{visible.length ? visible.map((a) => <AppointmentRow key={a.id} appointment={a} onView={() => onViewDoctor(a.doctor)} onCancel={() => onUpdateAppointmentStatus(a.id, 'Cancelled')} onReschedule={() => onBookDoctor(a.doctor)} />) : <div className="empty-inline">Nothing here just yet. Your next chapter in better health starts with a visit.</div>}</div></section><aside className="profile-panel"><div className="profile-panel-heading"><h2>Your profile</h2><button aria-label="Edit profile"><Settings size={17} /></button></div><div className="patient-profile"><div className="patient-avatar">AM</div><h3>Alex Morgan</h3><p>Patient since 2023</p><div className="profile-data"><div><span>Email</span><strong>alex.morgan@email.com</strong></div><div><span>Phone</span><strong>+1 (212) 555-0184</strong></div><div><span>Date of birth</span><strong>June 14, 1991</strong></div><div><span>Member ID</span><strong>DS-004289</strong></div></div><button className="outline-btn edit-profile">Edit profile <ArrowRight size={14} /></button></div><div className="health-reminder"><span>🌱</span><div><strong>A little reminder</strong><p>Your health deserves a spot on your calendar.</p></div></div></aside></div></> : role === 'doctor' ? <DoctorDashboard appointments={appointments} onUpdateAppointmentStatus={onUpdateAppointmentStatus} /> : <AdminDashboard appointments={appointments} setRole={setRole} />}
  </main>;
}

function AppointmentRow({ appointment: a, onView, onCancel, onReschedule }) {
  return <div className="appointment-row"><div className="appointment-date"><span>{a.date.split(' ')[0].slice(0, 3).toUpperCase()}</span><strong>{a.date.split(' ')[1].replace(',', '')}</strong></div><Avatar doctor={a.doctor} small /><div className="appointment-info"><strong>{a.doctor.name}</strong><span>{a.doctor.specialty} · {a.time}</span><span className="appointment-reason">{a.reason}</span></div><span className={`status-pill status-${a.status.toLowerCase()}`}><i></i>{a.status}</span><div className="appointment-actions"><button onClick={onView}>Details</button>{a.status === 'Confirmed' || a.status === 'Pending' ? <div className="row-dropdown"><button onClick={onReschedule}>Reschedule</button><button onClick={onCancel}>Cancel visit</button></div> : null}</div></div>;
}

function DoctorDashboard({ appointments, onUpdateAppointmentStatus }) {
  const [doctorProfiles, setDoctorProfiles] = useState(database ? [] : doctors);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!database) return undefined;
    const approvedDoctors = databaseQuery(ref(database, 'doctors'), orderByChild('verificationStatus'), equalTo('approved'));
    return onValue(approvedDoctors, (snapshot) => {
      const records = snapshot.val();
      setDoctorProfiles(records
        ? Object.entries(records).map(([id, data]) => mapDoctorData(id, data))
        : []);
    }, (loadError) => {
      console.error('Unable to load doctors for the dashboard preview:', loadError);
      setError('Doctor profiles could not be loaded. Check the Realtime Database rules.');
    });
  }, []);

  const selectedDoctor = doctorProfiles.find((doctor) => String(doctor.id) === selectedDoctorId) || doctorProfiles[0];
  const doctorUid = selectedDoctor ? String(selectedDoctor.userId || selectedDoctor.id) : '';
  const doctorAppointments = selectedDoctor
    ? appointments.filter((appointment) => String(appointment.doctorUid || appointment.doctor?.userId || appointment.doctorId || appointment.doctor?.id) === doctorUid)
    : [];
  const activeAppointments = doctorAppointments.filter((appointment) => appointment.status !== 'Cancelled');
  const pending = doctorAppointments.filter((appointment) => appointment.status === 'Pending');
  const accepting = selectedDoctor?.acceptingAppointments !== false;

  const toggleAvailability = async () => {
    if (!selectedDoctor || savingAvailability) return;
    const nextAvailability = !accepting;
    setSavingAvailability(true);
    setError('');
    try {
      if (database) {
        await set(ref(database, `doctors/${selectedDoctor.id}/acceptingAppointments`), nextAvailability);
      }
      setDoctorProfiles((current) => current.map((doctor) => String(doctor.id) === String(selectedDoctor.id)
        ? { ...doctor, acceptingAppointments: nextAvailability }
        : doctor));
    } catch (saveError) {
      console.error('Unable to update doctor availability:', saveError);
      setError('Availability could not be saved. Check the Realtime Database rules and try again.');
    } finally {
      setSavingAvailability(false);
    }
  };

  return <>
    <div className="panel-title"><div><h2>Doctor dashboard preview</h2><p>Select a doctor to review their bookings and availability.</p></div><label className="sort-control"><span>Doctor</span><select value={selectedDoctor ? String(selectedDoctor.id) : ''} onChange={(event) => setSelectedDoctorId(event.target.value)} disabled={!doctorProfiles.length}><option value="">Select a doctor</option>{doctorProfiles.map((doctor) => <option key={doctor.id} value={String(doctor.id)}>{doctor.name} · {doctor.specialty}</option>)}</select><ChevronDown size={14} /></label></div>
    <div className="dashboard-stats">
      <div className="stat-card"><span className="stat-icon mint"><CalendarDays size={18} /></span><div><span>Scheduled appointments</span><strong>{activeAppointments.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">For selected doctor</span></div>
      <div className="stat-card"><span className="stat-icon yellow"><Clock3 size={18} /></span><div><span>Pending requests</span><strong>{pending.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Needs review</span></div>
      <div className="stat-card"><span className="stat-icon lilac"><Users size={18} /></span><div><span>Booking status</span><strong>{accepting ? 'Open' : 'Paused'}</strong></div><span className="stat-trend">{selectedDoctor?.name || 'No doctor selected'}</span></div>
    </div>
    <div className="dashboard-columns provider-columns">
      <section className="dash-panel">
        <div className="panel-title"><div><h2>Appointment requests</h2><p>{selectedDoctor ? `Bookings for ${selectedDoctor.name}.` : 'Add a doctor profile to see bookings.'}</p></div><span className="request-count">{pending.length} pending</span></div>
        {activeAppointments.length ? activeAppointments.map((appointment) => <div className="provider-row" key={appointment.id}>
          <div className="patient-mini-avatar">{(appointment.patient || 'P').split(' ').map((name) => name[0]).join('')}</div>
          <div className="provider-patient"><strong>{appointment.patient || 'Patient'}</strong><span>{appointment.reason || 'General consultation'}</span></div>
          <div className="provider-time"><strong>{appointment.date}</strong><span>{appointment.time}</span></div>
          <span className={`status-pill status-${appointment.status.toLowerCase()}`}><i></i>{appointment.status}</span>
          <div className="provider-buttons">{appointment.status === 'Pending' ? <><button className="accept-btn" onClick={() => onUpdateAppointmentStatus(appointment.id, 'Confirmed')}><Check size={14} /> Accept</button><button className="reject-btn" onClick={() => onUpdateAppointmentStatus(appointment.id, 'Cancelled')}>Decline</button></> : <span className="details-btn">{appointment.status}</span>}</div>
        </div>) : <div className="empty-inline">{selectedDoctor ? 'No appointments for this doctor yet.' : 'No doctor profiles are available. Add a doctor from the admin dashboard first.'}</div>}
      </section>
      <aside className="profile-panel availability-panel">
        <div className="profile-panel-heading"><h2>Availability</h2><Settings size={17} /></div>
        <p>{selectedDoctor ? `Manage new bookings for ${selectedDoctor.name}.` : 'Select a doctor to manage availability.'}</p>
        <div className="availability-toggle"><div><strong>Accepting appointments</strong><span>{accepting ? 'Patients can book this doctor.' : 'New bookings are paused.'}</span></div><button className={`toggle ${accepting ? 'on' : ''}`} aria-label="Toggle availability" aria-pressed={accepting} onClick={toggleAvailability} disabled={!selectedDoctor || savingAvailability}><i></i></button></div>
        {selectedDoctor?.slots?.length ? selectedDoctor.slots.map((slot, index) => <div className="schedule-item" key={slot}><span>{String(index + 1).padStart(2, '0')}</span><strong>{slot}</strong><span>{accepting ? 'Bookable' : 'Paused'}</span></div>) : <div className="empty-inline">No appointment times are set for this doctor.</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </aside>
    </div>
  </>;
}

function ProviderDashboard({ user, appointments, onUpdateAppointmentStatus }) {
  const [doctor, setDoctor] = useState(null);
  const [error, setError] = useState('');
  const [savingAvailability, setSavingAvailability] = useState(false);
  const upcoming = appointments.filter((appointment) => ['Pending', 'Confirmed'].includes(appointment.status));
  const pending = appointments.filter((appointment) => appointment.status === 'Pending');
  const completed = appointments.filter((appointment) => appointment.status === 'Completed');

  useEffect(() => {
    if (!database || !user?.uid) return undefined;
    return onValue(ref(database, `doctors/${user.uid}`), (snapshot) => {
      setDoctor(snapshot.exists() ? mapDoctorData(user.uid, snapshot.val()) : null);
      setError('');
    }, (loadError) => {
      console.error('Unable to load provider profile:', loadError);
      setError('Your approved doctor profile could not be loaded. Contact the administrator.');
    });
  }, [user?.uid]);

  const toggleAvailability = async () => {
    if (!database || !doctor || savingAvailability) return;
    setSavingAvailability(true);
    setError('');
    try {
      await set(ref(database, `doctors/${user.uid}/acceptingAppointments`), doctor.acceptingAppointments === false);
    } catch (saveError) {
      console.error('Unable to update provider availability:', saveError);
      setError('Availability could not be saved. Check your doctor profile permissions.');
    } finally {
      setSavingAvailability(false);
    }
  };

  return <main className="page-shell dashboard-page">
    <div className="dashboard-welcome"><div><span className="section-kicker">PROVIDER PORTAL</span><h1>Welcome, {doctor?.name || user?.displayName || 'Doctor'}.</h1><p>Review appointment requests and manage your booking availability.</p></div><div className="verified-badge"><BadgeCheck size={15} /> VERIFIED PROVIDER</div></div>
    <div className="dashboard-stats">
      <div className="stat-card"><span className="stat-icon mint"><CalendarDays size={18} /></span><div><span>Upcoming appointments</span><strong>{upcoming.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Confirmed and pending</span></div>
      <div className="stat-card"><span className="stat-icon yellow"><Clock3 size={18} /></span><div><span>Pending requests</span><strong>{pending.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Needs review</span></div>
      <div className="stat-card"><span className="stat-icon lilac"><CheckCircle2 size={18} /></span><div><span>Completed visits</span><strong>{completed.length.toString().padStart(2, '0')}</strong></div><span className="stat-trend">Appointment history</span></div>
    </div>
    <div className="dashboard-columns provider-columns">
      <section className="dash-panel"><div className="panel-title"><div><h2>Appointment requests</h2><p>Only bookings assigned to your doctor account appear here.</p></div><span className="request-count">{pending.length} pending</span></div>
        {upcoming.length ? upcoming.map((appointment) => <div className="provider-row" key={appointment.id}>
          <div className="patient-mini-avatar">{(appointment.patient || 'P').split(' ').map((name) => name[0]).join('')}</div>
          <div className="provider-patient"><strong>{appointment.patient || 'Patient'}</strong><span>{appointment.reason || 'General consultation'}</span><span>{appointment.patientEmail || ''} {appointment.patientPhone || ''}</span></div>
          <div className="provider-time"><strong>{appointment.date}</strong><span>{appointment.time}</span></div>
          <span className={`status-pill status-${appointment.status.toLowerCase()}`}><i></i>{appointment.status}</span>
          <div className="provider-buttons">{appointment.status === 'Pending' ? <><button className="accept-btn" onClick={() => onUpdateAppointmentStatus(appointment.id, 'Confirmed')}><Check size={14} /> Accept</button><button className="reject-btn" onClick={() => onUpdateAppointmentStatus(appointment.id, 'Cancelled')}>Decline</button></> : <span className="details-btn">Confirmed</span>}</div>
        </div>) : <div className="empty-inline">No upcoming appointment requests.</div>}
      </section>
      <aside className="profile-panel availability-panel"><div className="profile-panel-heading"><h2>Your availability</h2><Settings size={17} /></div>
        <p>{doctor ? `${doctor.title || doctor.specialty} · ${doctor.specialty}` : 'Loading approved provider profile…'}</p>
        <div className="availability-toggle"><div><strong>Accepting appointments</strong><span>{doctor?.acceptingAppointments === false ? 'New bookings are paused.' : 'Patients can book your available times.'}</span></div><button className={`toggle ${doctor?.acceptingAppointments === false ? '' : 'on'}`} aria-label="Toggle availability" aria-pressed={doctor?.acceptingAppointments !== false} onClick={toggleAvailability} disabled={!doctor || savingAvailability}><i></i></button></div>
        {doctor?.slots?.length ? doctor.slots.map((slot) => <div className="schedule-item" key={slot}><span><Clock3 size={13} /></span><strong>{slot}</strong><span>{doctor.acceptingAppointments === false ? 'Paused' : 'Bookable'}</span></div>) : <div className="empty-inline">No appointment times are configured.</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </aside>
    </div>
  </main>;
}

function LegacyAdminDashboard({ appointments, setRole }) {
  return <><div className="dashboard-stats"><div className="stat-card"><span className="stat-icon mint"><Stethoscope size={18} /></span><div><span>Active doctors</span><strong>120</strong></div><span className="stat-trend">↑ 8 this month</span></div><div className="stat-card"><span className="stat-icon lilac"><Users size={18} /></span><div><span>Registered patients</span><strong>18,240</strong></div><span className="stat-trend">↑ 12% this month</span></div><div className="stat-card"><span className="stat-icon peach"><CalendarDays size={18} /></span><div><span>Total appointments</span><strong>{(842 + appointments.length).toLocaleString()}</strong></div><span className="stat-trend">↑ 18% this month</span></div></div><div className="admin-section"><div className="panel-title"><div><h2>Platform overview</h2><p>Manage your DoctorSlot community.</p></div><button className="outline-btn" onClick={() => setRole('doctor')}><Users size={15} /> Manage providers</button></div><div className="admin-manage-grid"><button className="manage-card" onClick={() => setRole('doctor')}><span className="manage-icon mint"><Stethoscope size={21} /></span><span><strong>Manage doctors</strong><small>Review profiles and provider status</small></span><ArrowRight size={17} /></button><button className="manage-card" onClick={() => setRole('patient')}><span className="manage-icon lilac"><Users size={21} /></span><span><strong>Manage patients</strong><small>View and support patient accounts</small></span><ArrowRight size={17} /></button>  <button className="manage-card" onClick={() => setRole('patient')}><span className="manage-icon peach"><CalendarDays size={21} /></span><span><strong>Manage appointments</strong><small>{appointments.length} appointments in demo</small></span><ArrowRight size={17} /></button></div><div className="admin-lower"><div className="admin-chart"><div className="panel-title"><div><h3>Appointment activity</h3><p>Bookings over the last 7 months</p></div><select aria-label="Chart range"><option>Last 7 months</option><option>This year</option></select></div><div className="bar-chart">{[42, 58, 48, 73, 56, 88, 68].map((v, i) => <div key={i} className="chart-column"><span className={i === 5 ? 'bar current' : 'bar'} style={{ height: `${v}%` }}></span><small>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'][i]}</small></div>)}</div></div><div className="admin-activity"><h3>Recent activity</h3><div><span className="activity-dot mint-dot"></span><p><strong>Dr. Olivia Rhye</strong> joined DoctorSlot <small>12 min ago</small></p></div><div><span className="activity-dot lilac-dot"></span><p><strong>24 appointments</strong> booked today <small>2 hours ago</small></p></div><div><span className="activity-dot peach-dot"></span><p><strong>8 new patients</strong> registered <small>4 hours ago</small></p></div></div></div></div></>;
}

function ConfirmationModal({ appointment, onClose }) {
  if (!appointment) return null;
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><div className="confirm-icon"><Check size={26} /></div><span className="section-kicker">YOU’RE ALL SET</span><h2 id="confirm-title">Appointment booked!</h2><p>We’ve saved your visit. A confirmation is on its way.</p><div className="confirmation-details"><div><span>Doctor</span><strong>{appointment.doctor.name}</strong></div><div><span>Date & time</span><strong>{appointment.date} · {appointment.time}</strong></div><div><span>Booking reference</span><strong>{appointment.id}</strong></div></div><button className="primary-btn modal-done" onClick={onClose}>Go to my appointments <ArrowRight size={16} /></button></section></div>;
}

function SignInRequired({ onLogin, authLoading, returnPage = 'patient' }) {
  return <main className="page-shell dashboard-page"><div className="dashboard-welcome"><div><span className="section-kicker">ACCOUNT ACCESS</span><h1>Sign in to your dashboard.</h1><p>View appointments or open the provider dashboard with your Google account.</p></div><button className="primary-btn" onClick={() => onLogin(returnPage)} disabled={authLoading}>{authLoading ? 'Connecting…' : 'Continue with Google'} <ArrowRight size={16} /></button></div></main>;
}

function Footer({ setPage }) {
  return <footer className="footer"><div className="footer-main"><div className="footer-brand"><Brand onClick={() => setPage('home')} /><p>Making better healthcare easier to find, book, and feel good about.</p><div className="footer-socials"><button aria-label="Instagram">ig</button><button aria-label="LinkedIn">in</button><button aria-label="Facebook">f</button></div></div><div className="footer-links"><div><strong>For patients</strong><button onClick={() => setPage('doctors')}>Find a doctor</button><button onClick={() => setPage('patient')}>My appointments</button><button>Patient resources</button></div><div><strong>For providers</strong><button>Join our network</button><button>Provider login</button><button>Practice resources</button></div><div><strong>DoctorSlot</strong><button>About us</button><button>Our mission</button><button>Contact</button></div></div><div className="footer-newsletter"><strong>A little more wellbeing.</strong><p>Good things, delivered occasionally.</p><form onSubmit={(e) => { e.preventDefault(); e.currentTarget.reset(); }}><input type="email" required placeholder="Your email address" aria-label="Email address" /><button aria-label="Subscribe"><ArrowRight size={17} /></button></form><small>By subscribing, you agree to our Privacy Policy.</small></div></div><div className="footer-bottom"><span>© 2025 DoctorSlot, Inc. All rights reserved.</span><div><button>Privacy</button><button>Terms</button><button>Accessibility</button></div><span className="footer-made">Made with care <Heart size={13} fill="currentColor" /></span></div></footer>;
}

async function loadUserProfile(firebaseUser) {
  const profileRef = ref(database, `users/${firebaseUser.uid}`);
  const profileSnapshot = await get(profileRef);
  const isBootstrapAdmin = firebaseUser.email?.trim().toLowerCase() === ADMIN_EMAIL;
  const profile = profileSnapshot.exists()
    ? profileSnapshot.val()
    : {
      displayName: firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      role: isBootstrapAdmin ? 'admin' : 'patient',
      createdAt: serverTimestamp(),
    };

  if (isBootstrapAdmin && profile.role !== 'admin') profile.role = 'admin';
  if (!profileSnapshot.exists() || (isBootstrapAdmin && profileSnapshot.val().role !== 'admin')) {
    await set(profileRef, profile);
  }
  return profile;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = pageFromPath(location.pathname);
  const [role, setRole] = useState('patient');
  const [query, setQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(doctors[0]);
  const [doctorsList, setDoctorsList] = useState(firebaseConfigured ? [] : doctors);
  const [appointments, setAppointments] = useState(database ? [] : initialAppointments);
  const [confirmation, setConfirmation] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const setPage = (nextPage) => navigate(pathForPage(nextPage, selectedDoctor));

  useEffect(() => {
    const doctorId = location.pathname.match(/^\/(?:doctors|booking)\/([^/]+)$/)?.[1];
    if (!doctorId) return;
    const doctor = doctorsList.find((item) => String(item.id) === decodeURIComponent(doctorId));
    if (doctor) setSelectedDoctor(doctor);
  }, [location.pathname, doctorsList]);

  useEffect(() => {
    if (!auth || !database) return undefined;
    let active = true;
    let profileUnsubscribe;
    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      profileUnsubscribe?.();
      profileUnsubscribe = undefined;
      setUser(currentUser);
      setUserProfile(null);
      if (!currentUser) {
        setRole('patient');
        setAppointments([]);
        return;
      }
      try {
        const profile = await loadUserProfile(currentUser);
        if (!active || auth.currentUser?.uid !== currentUser.uid) return;
        setUserProfile(profile);
        setRole(profile.role || 'patient');
        profileUnsubscribe = onValue(ref(database, `users/${currentUser.uid}`), (snapshot) => {
          if (!snapshot.exists()) return;
          const updatedProfile = snapshot.val();
          setUserProfile(updatedProfile);
          setRole(updatedProfile.role || 'patient');
        }, (profileError) => {
          console.error('Unable to listen for profile changes:', profileError);
          setAuthError('Your account role could not be refreshed. Reload the page and try again.');
        });
      } catch (error) {
        console.error('Unable to load the signed-in user profile:', error);
        setAuthError('We couldn’t load your account profile. Check your Realtime Database rules and try again.');
      }
    });
    return () => {
      active = false;
      authUnsubscribe();
      profileUnsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!database) return undefined;
    return onValue(ref(database, 'doctors'), (snapshot) => {
      const doctorRecords = snapshot.val();
      setDoctorsList(doctorRecords
        ? Object.entries(doctorRecords).map(([id, data]) => mapDoctorData(id, data))
        : firebaseConfigured ? [] : doctors);
      setSaveError('');
    }, (error) => {
      console.error('Unable to listen for doctor updates in Realtime Database:', error);
      setSaveError('Live doctor search is unavailable. Check your Realtime Database rules and try again.');
    });
  }, []);

  useEffect(() => {
    if (!database || !user || !userProfile) {
      if (firebaseConfigured) setAppointments([]);
      return undefined;
    }
    const appointmentsRef = ref(database, 'appointments');
    const appointmentsQuery = userProfile.role === 'admin'
      ? appointmentsRef
      : databaseQuery(appointmentsRef, orderByChild(userProfile.role === 'doctor' ? 'doctorUid' : 'patientUid'), equalTo(user.uid));
    return onValue(appointmentsQuery, (snapshot) => {
      const appointmentRecords = snapshot.val();
      setAppointments(appointmentRecords ? Object.entries(appointmentRecords).map(([id, data]) => {
        const doctor = data.doctor && typeof data.doctor === 'object'
          ? data.doctor
          : doctorsList.find((item) => String(item.id) === String(data.doctorId)) || doctorsList[0];
        return { ...data, id, doctor };
      }) : []);
      setSaveError('');
    }, (error) => {
      console.error('Unable to listen for appointments in Realtime Database:', error);
      setSaveError('Appointments could not be loaded. Check your Realtime Database rules and try again.');
    });
  }, [user, userProfile, doctorsList]);

  const openAuth = (returnPage = 'home') => {
    setAuthError('');
    authenticate(returnPage);
  };
  const showDoctors = (search = '') => { setQuery(search); setSelectedSpecialty(''); setPage('doctors'); };
  const showProfile = (doctor) => {
    setSelectedDoctor(doctor);
    navigate(pathForPage('profile', doctor));
  };
  const bookDoctor = (doctor) => {
    if (doctor.acceptingAppointments === false) {
      setSaveError(`${doctor.name} is not accepting new appointments right now.`);
      return;
    }
    setSaveError('');
    setSelectedDoctor(doctor);
    if (firebaseConfigured && !user) openAuth('booking');
    else navigate(pathForPage('booking', doctor));
  };
  const authenticate = async (returnPage = 'home') => {
    if (!auth || !database) {
      setAuthError('Firebase is not configured. Add your Firebase web app values to .env and restart the app.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const profile = await loadUserProfile(credential.user);
      setUserProfile(profile);
      setRole(profile.role || 'patient');
      setPage(returnPage);
    } catch (error) {
      console.error('Firebase Authentication failed:', error);
      const messages = {
        'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing.',
        'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
        'auth/unauthorized-domain': 'Add this site’s domain to the authorized domains in Firebase Authentication.',
        'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection.',
      };
      setAuthError(messages[error.code] || error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };
  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setPage('home');
    } catch (error) {
      console.error('Unable to sign out:', error);
      setSaveError('We couldn’t log you out. Please try again.');
    }
  };
  const confirmBooking = async (booking) => {
    if (!database || !user || !userProfile || !['patient', 'admin'].includes(userProfile.role)) {
      setSaveError('Sign in with a patient account to book an appointment.');
      return false;
    }

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!booking.dateKey || booking.dateKey < todayKey || !booking.time || !booking.slotKey) {
      setSaveError('Choose a valid future date and available time.');
      return false;
    }

    const appointmentRef = push(ref(database, 'appointments'));
    if (!appointmentRef.key) {
      setSaveError('Realtime Database could not create an appointment ID.');
      return false;
    }
    const slotRef = ref(database, `bookedSlots/${booking.doctorUid}/${booking.dateKey}/${booking.slotKey}`);
    let reserved = false;
    try {
      const doctorSnapshot = await get(ref(database, `doctors/${booking.doctorId}`));
      const currentDoctor = doctorSnapshot.val();
      if (!currentDoctor
        || currentDoctor.userId !== booking.doctorUid
        || currentDoctor.verificationStatus !== 'approved'
        || currentDoctor.acceptingAppointments === false
        || !Array.isArray(currentDoctor.slots)
        || !currentDoctor.slots.includes(booking.time)) {
        setSaveError('This doctor or appointment time is no longer available. Choose another doctor or time.');
        return false;
      }

      let reservation;
      try {
        reservation = await runTransaction(slotRef, (current) => current === null
          ? { appointmentId: appointmentRef.key, patientUid: user.uid }
          : undefined);
      } catch (reservationError) {
        console.error('Appointment slot could not be reserved:', reservationError);
        setSaveError('That time is no longer available. Choose another appointment time.');
        return false;
      }
      if (!reservation.committed) {
        setSaveError('That time was just booked. Choose another available time.');
        return false;
      }
      reserved = true;

      const appointment = {
        ...booking,
        status: 'Pending',
        patientUid: user.uid,
        doctorUid: booking.doctorUid,
        doctorId: String(booking.doctorId),
        createdAt: serverTimestamp(),
      };
      await set(appointmentRef, appointment);
      appointment.id = appointmentRef.key;
      setSaveError('');
      setConfirmation(appointment);
      return true;
    } catch (error) {
      console.error('Unable to save appointment to Realtime Database:', error);
      if (reserved) {
        try {
          await runTransaction(slotRef, (current) => current?.appointmentId === appointmentRef.key ? null : undefined);
        } catch (releaseError) {
          console.error('Unable to release failed appointment reservation:', releaseError);
        }
      }
      const permissionDenied = String(error.code || error.message || '').toLowerCase().includes('permission_denied');
      setSaveError(permissionDenied
        ? 'Booking was denied. Publish the current database rules and confirm this doctor is approved.'
        : 'We couldn’t save your appointment right now. Please try again.');
      return false;
    }
  };
  const updateAppointmentStatus = async (id, status) => {
    if (database) {
      try {
        await set(ref(database, `appointments/${id}/status`), status);
        const appointment = appointments.find((record) => record.id === id);
        if (status === 'Cancelled' && appointment?.dateKey && appointment?.slotKey && appointment?.doctorUid) {
          await set(ref(database, `bookedSlots/${appointment.doctorUid}/${appointment.dateKey}/${appointment.slotKey}`), null);
        }
      } catch (error) {
        console.error('Unable to update appointment in Realtime Database:', error);
        setSaveError('We couldn’t update this appointment. Please try again.');
        return;
      }
    }
    if (!database) setAppointments((current) => current.map((appointment) => appointment.id === id ? { ...appointment, status } : appointment));
    setSaveError('');
  };
  const updateUserProfile = async (profileUpdates) => {
    if (!database || !user) {
      setSaveError('Sign in before updating your profile.');
      return false;
    }
    try {
      await update(ref(database, `users/${user.uid}`), profileUpdates);
      setSaveError('');
      return true;
    } catch (error) {
      console.error('Unable to update user profile:', error);
      setSaveError('We couldn’t save your profile. Check your Realtime Database rules and try again.');
      return false;
    }
  };
  return <div className="app"><Header page={page} setPage={setPage} user={user} onLogin={openAuth} onLogout={logout} onDoctors={() => showDoctors()} authLoading={authLoading} />
    <Routes>
      <Route path="/" element={<Home setPage={setPage} onSearch={showDoctors} onSpecialty={(specialty) => { setSelectedSpecialty(specialty); setQuery(''); setPage('doctors'); }} onDoctors={() => showDoctors()} onView={showProfile} onBook={bookDoctor} doctorsList={doctorsList} />} />
      <Route path="/doctors" element={<DoctorsPage query={query} setQuery={setQuery} selectedSpecialty={selectedSpecialty} setSpecialty={setSelectedSpecialty} onView={showProfile} onBook={bookDoctor} doctorsList={doctorsList} />} />
      <Route path="/doctors/:doctorId" element={<ProfilePage doctor={selectedDoctor} onBack={() => setPage('doctors')} onBook={bookDoctor} />} />
      <Route path="/booking/:doctorId" element={firebaseConfigured && (!user || !userProfile)
        ? <SignInRequired onLogin={openAuth} returnPage="booking" authLoading={authLoading} />
        : <DynamicBookingPage doctor={selectedDoctor} user={user} userProfile={userProfile} setPage={setPage} onConfirm={confirmBooking} />} />
      <Route path="/appointments" element={firebaseConfigured && (!user || !userProfile)
        ? <SignInRequired onLogin={openAuth} authLoading={authLoading} />
        : userProfile?.role === 'doctor'
          ? <ProviderDashboard user={user} appointments={appointments} onUpdateAppointmentStatus={updateAppointmentStatus} />
          : userProfile?.role === 'admin'
            ? <AdminDashboard appointments={appointments} onUpdateAppointmentStatus={updateAppointmentStatus} />
          : <PatientDashboard appointments={appointments} user={user} userProfile={userProfile} onUpdateAppointmentStatus={updateAppointmentStatus} setPage={setPage} onViewDoctor={showProfile} onBookDoctor={bookDoctor} onUpdateProfile={updateUserProfile} />} />
      <Route path="/apply-doctor" element={firebaseConfigured && (!user || !userProfile)
        ? <SignInRequired onLogin={openAuth} returnPage="applyDoctor" authLoading={authLoading} />
        : <DoctorApplication user={user} userProfile={userProfile} onDashboard={() => setPage('patient')} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {(authError || saveError) && <div className="save-error" role="alert">{authError || saveError}<button onClick={() => { setAuthError(''); setSaveError(''); }} aria-label="Dismiss error"><X size={15} /></button></div>}
    <Footer setPage={setPage} /><ConfirmationModal appointment={confirmation} onClose={() => { setConfirmation(null); setPage('patient'); setRole('patient'); }} />
  </div>;
}
