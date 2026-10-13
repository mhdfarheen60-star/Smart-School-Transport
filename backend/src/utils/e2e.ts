/**
 * End-to-end API check. Requires the API running (npm run dev) and the admin seeded.
 *   npm run test:e2e
 * Creates uniquely-named records so it can be re-run safely.
 */
import 'dotenv/config'; // reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from backend/.env

const BASE = process.env.API_URL || 'http://localhost:5000/api';
if (!process.env.SEED_ADMIN_PASSWORD) {
  console.error('Set SEED_ADMIN_PASSWORD (the seeded admin password) in backend/.env before running the e2e tests.');
  process.exit(1);
}
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@school.local',
  password: process.env.SEED_ADMIN_PASSWORD,
};

let passed = 0;
let failed = 0;

function rawCall(method: string, path: string, token?: string, body?: unknown) {
  return fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await rawCall(method, path, token, body);
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data, meta: json.meta };
}

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, extra ?? '');
  }
}

async function main() {
  const tag = Date.now().toString().slice(-7);
  const pw = 'Passw0rd!x';

  console.log('Auth & permissions');
  const adminLogin = await call('POST', '/auth/login', undefined, ADMIN);
  check('admin login', adminLogin.status === 200 && !!adminLogin.data?.token, adminLogin.json);
  const A = adminLogin.data.token as string;
  check('wrong password rejected', (await call('POST', '/auth/login', undefined, { email: ADMIN.email, password: 'nope-nope1' })).status === 401);
  check('no token rejected', (await call('GET', '/students')).status === 401);
  check('validation rejects bad register', (await call('POST', '/auth/register', undefined, { email: 'x' })).status === 422);

  const reg = await call('POST', '/auth/register', undefined, {
    name: 'Test Student', email: `stu${tag}@test.local`, password: pw, studentId: `ST${tag}`,
    className: '8', division: 'A', address: '12 Lake View Road', phone: '9000000001', parentName: 'Parent', parentPhone: '9000000002',
  });
  check('student registers', reg.status === 201, reg.json);
  const S = reg.data.token as string;
  const dup = await call('POST', '/auth/register', undefined, {
    name: 'Dup', email: `other${tag}@test.local`, password: pw, studentId: `ST${tag}`,
    className: '8', division: 'A', address: '12 Lake View Road', phone: '9000000001', parentPhone: '9000000002',
  });
  check('duplicate student ID blocked (409)', dup.status === 409, dup.json);
  check('student cannot list students (403)', (await call('GET', '/students', S)).status === 403);
  check('student cannot open admin dashboard (403)', (await call('GET', '/dashboard/admin', S)).status === 403);

  console.log('Admin CRUD');
  const drv = await call('POST', '/drivers', A, { name: 'E2E Driver', email: `drv${tag}@test.local`, password: pw, phone: '9111111111', licenseNumber: `LIC${tag}` });
  check('create driver', drv.status === 201, drv.json);
  const veh = await call('POST', '/vehicles', A, { registrationNumber: `E2E-${tag}`, busNumber: `B${tag}`, capacity: 1, model: 'Test' });
  check('create vehicle', veh.status === 201, veh.json);
  check('duplicate registration blocked', (await call('POST', '/vehicles', A, { registrationNumber: `E2E-${tag}`, busNumber: 'X', capacity: 5 })).status === 409);
  const rt = await call('POST', '/routes', A, { name: `E2E Route ${tag}`, stops: [{ name: 'Lake View', sequence: 1, pickupTime: '07:30', dropTime: '15:30' }, { name: 'School', sequence: 2 }] });
  check('create route', rt.status === 201, rt.json);
  const upd = await call('PATCH', `/vehicles/${veh.data._id}`, A, { model: 'Updated' });
  check('update vehicle', upd.status === 200 && upd.data.model === 'Updated');
  const list = await call('GET', `/vehicles?search=E2E-${tag}&limit=5&sort=capacity`, A);
  check('search + pagination', list.status === 200 && list.data.length === 1 && list.meta.total === 1, list.json);

  console.log('Workflow 1: transport request');
  const PICK = { address: '12 Lake View Road, Test City', latitude: 11.2588, longitude: 75.7804, placeId: 'test-place-1' };
  const DROP = { address: 'Test School, Main Road', latitude: 11.3, longitude: 75.82 };
  check('invalid latitude rejected (422)', (await call('POST', '/transport-requests', S, { pickupLocation: { ...PICK, latitude: 123 }, dropLocation: DROP })).status === 422);
  check('invalid longitude rejected (422)', (await call('POST', '/transport-requests', S, { pickupLocation: PICK, dropLocation: { ...DROP, longitude: -200 } })).status === 422);
  check('missing address rejected (422)', (await call('POST', '/transport-requests', S, { pickupLocation: { ...PICK, address: '' }, dropLocation: DROP })).status === 422);
  check('plain-string location rejected (422)', (await call('POST', '/transport-requests', S, { pickupLocation: '12 Lake View Road', dropLocation: 'School' })).status === 422);
  const rq = await call('POST', '/transport-requests', S, { pickupLocation: PICK, dropLocation: DROP, preferredStop: 'Ignored Stop', notes: 'Near the entrance' });
  check('request stores address + coordinates; preferredStop is ignored', rq.status === 201 && rq.data.preferredStop === undefined && rq.data.pickup?.latitude === 11.2588 && rq.data.drop?.address === DROP.address && rq.data.pickupLocation === PICK.address, rq.json);
  const myReqs = await call('GET', '/transport-requests', S);
  check('coordinates persist in My Requests', myReqs.data[0]?.pickup?.longitude === 75.7804);
  const edit = await call('PATCH', `/transport-requests/${rq.data._id}`, S, { notes: 'Pick me up at the gate' });
  check('student edits own pending request', edit.status === 200 && edit.data.notes === 'Pick me up at the gate', edit.json);
  check('student submits request', rq.status === 201, rq.json);
  check('second pending request blocked', (await call('POST', '/transport-requests', S, { pickupLocation: PICK, dropLocation: DROP })).status === 409);
  const pending = await call('GET', '/transport-requests?status=pending', A);
  check('admin sees pending request', pending.data.some((r: any) => r._id === rq.data._id));

  console.log('Workflow 2: assignment');
  const asg = await call('POST', '/assignments', A, { vehicle: veh.data._id, driver: drv.data._id, route: rt.data._id });
  check('create assignment', asg.status === 201, asg.json);
  check('duplicate vehicle assignment blocked (409)', (await call('POST', '/assignments', A, { vehicle: veh.data._id, driver: drv.data._id, route: rt.data._id })).status === 409);
  const rev = await call('PATCH', `/transport-requests/${rq.data._id}/review`, A, { decision: 'approved', remarks: 'Welcome', assignment: asg.data._id, stop: 'Lake View' });
  check('admin approves + assigns', rev.status === 200 && rev.data.status === 'approved', rev.json);
  const stuNotes = await call('GET', '/notifications', S);
  check('student notified of approval', stuNotes.data.some((n: any) => n.title.includes('approved')), stuNotes.json);
  const mine = await call('GET', '/assignments/mine', S);
  check('student sees bus/driver/route/time', mine.data?.driver?.name === 'E2E Driver' && mine.data?.pickupTime === '07:30', mine.json);

  // capacity = 1, so a second student must be refused
  const reg2 = await call('POST', '/auth/register', undefined, {
    name: 'Second Student', email: `stu2${tag}@test.local`, password: pw, studentId: `SS${tag}`,
    className: '9', division: 'B', address: '14 Lake View Road', phone: '9000000003', parentPhone: '9000000004',
  });
  const full = await call('POST', `/assignments/${asg.data._id}/riders`, A, { student: reg2.data.profile._id });
  check('capacity enforced (409)', full.status === 409, full.json);

  console.log('Workflow 3: pickup / drop tracking');
  const dl = await call('POST', '/auth/login', undefined, { email: `drv${tag}@test.local`, password: pw });
  check('driver login', dl.status === 200, dl.json);
  const D = dl.data.token as string;
  const dm = await call('GET', '/assignments/mine', D);
  check('driver sees assigned students', dm.data?.riders?.length === 1, dm.json);
  const trip = await call('POST', '/trips/today', D);
  check('driver opens daily trip', trip.status === 200 && trip.data.attendance.length === 1, trip.json);
  const attId = trip.data.attendance[0]._id;
  check('drop before pickup refused', (await call('PATCH', `/attendance/${attId}/drop`, D, { status: 'dropped' })).status === 409);
  check('student cannot mark pickup (403)', (await call('PATCH', `/attendance/${attId}/pickup`, S, { status: 'picked_up' })).status === 403);
  const pk = await call('PATCH', `/attendance/${attId}/pickup`, D, { status: 'picked_up' });
  check('pickup recorded with timestamp', pk.status === 200 && pk.data.pickupStatus === 'picked_up' && !!pk.data.pickupAt, pk.json);
  const dp = await call('PATCH', `/attendance/${attId}/drop`, D, { status: 'dropped' });
  check('drop recorded', dp.status === 200 && dp.data.dropStatus === 'dropped', dp.json);
  const hist = await call('GET', '/attendance', S);
  check('student sees own attendance', hist.data.length === 1 && hist.data[0].dropStatus === 'dropped', hist.json);
  const adminAtt = await call('GET', `/attendance?vehicle=${veh.data._id}`, A);
  check('admin sees attendance', adminAtt.data.length === 1);

  console.log('Locations: driver access + controlled change');
  const dRiders = await call('GET', '/assignments/mine', D);
  const rider = dRiders.data.riders[0];
  check('driver sees student pickup coordinates', rider.locations?.pickup?.latitude === 11.2588 && rider.locations?.pickup?.address === PICK.address, rider.locations);
  check('driver sees student drop coordinates', rider.locations?.drop?.longitude === 75.82);
  const sCur = await call('GET', '/location-changes/current', S);
  check('student sees own current locations', sCur.data?.pickup?.address === PICK.address, sCur.json);
  check('student assignment includes locations', (await call('GET', '/assignments/mine', S)).data?.locations?.drop?.address === DROP.address);

  // a second driver on another bus must NOT see this student
  const drv2 = await call('POST', '/drivers', A, { name: 'Other Driver', email: `drvb${tag}@test.local`, password: pw, phone: '9222222222', licenseNumber: `LIB${tag}` });
  const veh2 = await call('POST', '/vehicles', A, { registrationNumber: `E2F-${tag}`, busNumber: `C${tag}`, capacity: 5 });
  const asg2 = await call('POST', '/assignments', A, { vehicle: veh2.data._id, driver: drv2.data._id, route: rt.data._id });
  check('second bus assignment created', asg2.status === 201, asg2.json);
  const d2tok = (await call('POST', '/auth/login', undefined, { email: `drvb${tag}@test.local`, password: pw })).data.token as string;
  const d2mine = await call('GET', '/assignments/mine', d2tok);
  check('other driver sees no unrelated student locations', d2mine.data.riders.length === 0);
  check('driver cannot access location-changes (403)', (await call('GET', '/location-changes', D)).status === 403);
  check('unauthenticated cannot access locations', (await call('GET', '/location-changes/current')).status === 401);

  const NEWPICK = { address: '40 New Colony Road, Test City', latitude: 11.27, longitude: 75.79, placeId: 'test-place-2' };
  check('invalid change coordinates rejected', (await call('POST', '/location-changes', S, { target: 'pickup', location: { ...NEWPICK, latitude: 99.5 + 100 } })).status === 422);
  check('same location change rejected', (await call('POST', '/location-changes', S, { target: 'pickup', location: PICK })).status === 422);
  const ch = await call('POST', '/location-changes', S, { target: 'pickup', location: NEWPICK, reason: 'Moved house' });
  check('student submits location change', ch.status === 201 && ch.data.status === 'pending' && ch.data.previous.address === PICK.address, ch.json);
  check('duplicate pending change blocked', (await call('POST', '/location-changes', S, { target: 'pickup', location: NEWPICK })).status === 409);
  const dStill = await call('GET', '/assignments/mine', D);
  check('driver NOT changed by unapproved request', dStill.data.riders[0].locations.pickup.address === PICK.address);
  check('student cannot approve own change (403)', (await call('PATCH', `/location-changes/${ch.data._id}/review`, S, { decision: 'approved' })).status === 403);
  check('driver cannot approve change (403)', (await call('PATCH', `/location-changes/${ch.data._id}/review`, D, { decision: 'approved' })).status === 403);
  const pendingList = await call('GET', '/location-changes?status=pending', A);
  check('admin sees pending change', pendingList.data.some((c: any) => c._id === ch.data._id));
  const appr = await call('PATCH', `/location-changes/${ch.data._id}/review`, A, { decision: 'approved', stop: 'Lake View' });
  check('admin approves change', appr.status === 200 && appr.data.status === 'approved' && !!appr.data.reviewedAt && !!appr.data.reviewedBy, appr.json);
  const dNow = await call('GET', '/assignments/mine', D);
  check('driver sees updated pickup location', dNow.data.riders[0].locations.pickup.latitude === 11.27 && dNow.data.riders[0].locations.pickup.address === NEWPICK.address, dNow.json);
  const dNotes = await call('GET', '/notifications?limit=50', D);
  check('driver notified of location change', dNotes.data.some((n: any) => n.title === 'Student location updated'));
  const sNotes = await call('GET', '/notifications?limit=50', S);
  check('student notified of approval', sNotes.data.some((n: any) => n.title === 'Location change approved'));
  const dropCh = await call('POST', '/location-changes', S, { target: 'drop', location: { address: 'Annex Gate, Test School', latitude: 11.31, longitude: 75.83 } });
  const rej = await call('PATCH', `/location-changes/${dropCh.data._id}/review`, A, { decision: 'rejected', rejectionReason: 'Outside service area' });
  check('admin rejects with reason', rej.status === 200 && rej.data.status === 'rejected' && rej.data.rejectionReason === 'Outside service area', rej.json);
  const dAfterRej = await call('GET', '/assignments/mine', D);
  check('rejected change leaves drop location unchanged', dAfterRej.data.riders[0].locations.drop.address === DROP.address);
  check('already-reviewed change cannot be re-reviewed (409)', (await call('PATCH', `/location-changes/${ch.data._id}/review`, A, { decision: 'rejected' })).status === 409);
  const history = await call('GET', '/location-changes', A);
  check('change history retained with previous + proposed', history.data.filter((c: any) => c.student?._id === reg.data.profile._id).length === 2);
  await call('POST', `/assignments/${asg2.data._id}/end`, A);

  console.log('Workflow 4: vehicle problems');
  const pr = await call('POST', '/vehicle-problems', D, { type: 'breakdown', severity: 'high', description: 'Engine overheating on route' });
  check('driver reports problem', pr.status === 201, pr.json);
  const adminNotes = await call('GET', '/notifications?limit=50', A);
  check('admin notified', adminNotes.data.some((n: any) => n.type === 'problem'));
  const stuNotes2 = await call('GET', '/notifications?limit=50', S);
  check('riders notified of delay', stuNotes2.data.some((n: any) => n.type === 'delay'));
  const pu = await call('PATCH', `/vehicle-problems/${pr.data._id}`, A, { status: 'in_review', adminNotes: 'Mechanic called', vehicleAction: 'mark_unavailable' });
  check('admin updates problem', pu.status === 200 && pu.data.status === 'in_review', pu.json);
  const vcheck = await call('GET', `/vehicles/${veh.data._id}`, A);
  check('vehicle marked unavailable', vcheck.data.status === 'unavailable');

  console.log('Workflow 5: complaints');
  const cp = await call('POST', '/complaints', S, { subject: 'Bus arrives late', description: 'The bus has been late all week.', category: 'timing' });
  check('student submits complaint', cp.status === 201, cp.json);
  const cu = await call('PATCH', `/complaints/${cp.data._id}`, A, { status: 'resolved', adminResponse: 'Timing adjusted' });
  check('admin resolves', cu.status === 200 && cu.data.status === 'resolved', cu.json);
  const sn = await call('GET', '/notifications?limit=50', S);
  check('student notified of complaint update', sn.data.some((n: any) => n.type === 'complaint'));

  console.log('Workflow 6: reports');
  const rj = await call('GET', '/reports/attendance?from=2020-01-01&to=2099-12-31', A);
  check('report json', rj.status === 200 && rj.data.rows.length >= 1, rj.json);
  const csv = await rawCall('GET', '/reports/students?format=csv', A);
  const text = await csv.text();
  check('report csv', csv.status === 200 && text.includes('Student ID'));
  const pdf = await rawCall('GET', '/reports/vehicles?format=pdf', A);
  const buf = Buffer.from(await pdf.arrayBuffer());
  check('report pdf', pdf.status === 200 && buf.subarray(0, 4).toString() === '%PDF');
  check('bad date range rejected', (await call('GET', '/reports/students?from=2025-02-01&to=2025-01-01', A)).status === 422);

  console.log('Dashboards & misc');
  const ad = await call('GET', '/dashboard/admin', A);
  check('admin dashboard from DB', ad.status === 200 && ad.data.totals.students >= 1 && ad.data.weekly.length === 7, ad.json);
  check('student dashboard', (await call('GET', '/dashboard/student', S)).data?.transport?.route === `E2E Route ${tag}`);
  check('driver dashboard', (await call('GET', '/dashboard/driver', D)).data?.progress?.total === 1);
  check('delete vehicle with active assignment blocked', (await call('DELETE', `/vehicles/${veh.data._id}`, A)).status === 409);
  const endA = await call('POST', `/assignments/${asg.data._id}/end`, A);
  check('end assignment', endA.status === 200 && endA.data.status === 'ended');
  const hist2 = await call('GET', '/attendance', S);
  check('history preserved after assignment ended', hist2.data.length === 1);
  check('invalid ObjectId -> 400', (await call('GET', '/students/not-an-id', A)).status === 400);
  check('unknown route -> 404', (await call('GET', '/nope', A)).status === 404);
  const del = await call('DELETE', `/students/${reg.data.profile._id}`, A);
  check('student with history is deactivated, not deleted', del.status === 200 && del.data.deactivated === true, del.json);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
