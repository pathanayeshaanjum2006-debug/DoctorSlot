const projectId = 'demo-doctorslot';
const baseUrl = `http://127.0.0.1:9000/.json?ns=${projectId}`;
const adminAuth = { uid: 'admin-1', email: 'pathanayeshaanjum2006@gmail.com', email_verified: true };
const patientAuth = { uid: 'patient-1', email: 'patient@example.test' };
const secondPatientAuth = { uid: 'patient-2', email: 'second@example.test' };
const doctorAuth = { uid: 'provider-1', email: 'provider@example.test' };

function url(path, auth, params = {}) {
  const target = new URL(baseUrl);
  target.pathname = `${path ? `/${path}` : ''}.json`;
  if (auth) target.searchParams.set('auth_variable_override', JSON.stringify(auth));
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target;
}

async function request(path, method, body, auth, params) {
  const response = await fetch(url(path, auth, params), {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, text: await response.text() };
}

async function allow(label, path, method, body, auth, params) {
  const result = await request(path, method, body, auth, params);
  if (!result.response.ok) throw new Error(`${label}: expected allowed, got ${result.response.status}: ${result.text}`);
  console.log(`PASS ${label}`);
  return result.text ? JSON.parse(result.text) : null;
}

async function deny(label, path, method, body, auth, params) {
  const result = await request(path, method, body, auth, params);
  if (result.response.ok) throw new Error(`${label}: expected permission denied`);
  console.log(`PASS ${label}`);
}

const now = Date.now();
const today = new Date();
const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate() + 1).padStart(2, '0')}`;
const slotKey = '09_00_AM';

await allow('verified bootstrap admin profile', 'users/admin-1', 'PUT', {
  role: 'admin', displayName: 'Platform Admin', email: adminAuth.email, createdAt: now,
}, adminAuth);
await allow('patient account creation', 'users/patient-1', 'PUT', { role: 'patient', displayName: 'Patient One' }, patientAuth);
await allow('second patient account creation', 'users/patient-2', 'PUT', { role: 'patient', displayName: 'Patient Two' }, secondPatientAuth);
await allow('provider account creation as patient', 'users/provider-1', 'PUT', { role: 'patient', displayName: 'Provider One' }, doctorAuth);
await deny('patient cannot assign own doctor role', 'users/patient-1', 'PATCH', { role: 'doctor' }, patientAuth);
await allow('provider submits own pending application', 'doctorApplications/provider-1', 'PUT', {
  userId: 'provider-1', name: 'Provider One', specialty: 'Cardiology', title: 'Cardiologist',
  licenseNumber: 'LIC-1', status: 'Pending', slots: ['09:00 AM'],
}, doctorAuth);
await deny('provider cannot self-approve application', 'doctorApplications/provider-1/status', 'PUT', 'Approved', doctorAuth);

const doctorProfile = {
  userId: 'provider-1', name: 'Provider One', specialty: 'Cardiology', title: 'Cardiologist',
  verificationStatus: 'approved', acceptingAppointments: true, slots: ['09:00 AM'],
  slotAvailability: { [slotKey]: true },
};
await allow('admin atomically approves provider', '', 'PATCH', {
  'doctorApplications/provider-1/status': 'Approved',
  'users/provider-1/role': 'doctor',
  'doctors/provider-1': doctorProfile,
}, adminAuth);
await allow('public query returns approved doctors', 'doctors', 'GET', undefined, null, {
  orderBy: JSON.stringify('verificationStatus'), equalTo: JSON.stringify('approved'),
});
await allow('patient reads approved doctor profile', 'doctors/provider-1', 'GET', undefined, patientAuth);
await deny('patient cannot read another patient profile', 'users/patient-2', 'GET', undefined, patientAuth);

await allow('patient reserves an available slot', `bookedSlots/provider-1/${dateKey}/${slotKey}`, 'PUT', {
  appointmentId: 'appointment-1', patientUid: 'patient-1',
}, patientAuth);
await deny('second patient cannot reserve an occupied slot', `bookedSlots/provider-1/${dateKey}/${slotKey}`, 'PUT', {
  appointmentId: 'appointment-2', patientUid: 'patient-2',
}, secondPatientAuth);
await deny('appointment cannot bypass the slot reservation', 'appointments/appointment-bypass', 'PUT', {
  patientUid: 'patient-1', doctorUid: 'provider-1', doctorId: 'provider-1', dateKey,
  slotKey, time: '09:00 AM', status: 'Pending',
}, patientAuth);
await allow('appointment must match the patient slot reservation', 'appointments/appointment-1', 'PUT', {
  patientUid: 'patient-1', doctorUid: 'provider-1', doctorId: 'provider-1', dateKey,
  slotKey, time: '09:00 AM', status: 'Pending', patient: 'Patient One',
}, patientAuth);
await allow('patient reads own appointment query', 'appointments', 'GET', undefined, patientAuth, {
  orderBy: JSON.stringify('patientUid'), equalTo: JSON.stringify('patient-1'),
});
await deny('patient cannot read another patient appointment query', 'appointments', 'GET', undefined, secondPatientAuth, {
  orderBy: JSON.stringify('patientUid'), equalTo: JSON.stringify('patient-1'),
});
await allow('doctor reads assigned appointment query', 'appointments', 'GET', undefined, doctorAuth, {
  orderBy: JSON.stringify('doctorUid'), equalTo: JSON.stringify('provider-1'),
});
await allow('doctor accepts assigned request', 'appointments/appointment-1/status', 'PUT', 'Confirmed', doctorAuth);
await allow('doctor completes confirmed appointment', 'appointments/appointment-1/status', 'PUT', 'Completed', doctorAuth);
await deny('doctor cannot use an unsupported status', 'appointments/appointment-1/status', 'PUT', 'Approved', doctorAuth);

console.log('All Realtime Database rule checks passed.');
