import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Bus, CalendarCheck, ClipboardList, GraduationCap, MessageSquareWarning, Navigation, Truck, UserCog } from 'lucide-react';
import { CrudPage } from '../../components/CrudPage';
import { Badge, ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import type { DriverProfile, RouteDoc, StudentProfile, Vehicle } from '../../types';
import { fmtDate, toInputDate } from '../../utils/format';

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const phoneRx = /^[0-9+\-\s()]{7,15}$/;

/* ---------- Dashboard ---------- */
const PIE = ['#f59e0b', '#10b981', '#ef4444', '#9ca3af'];

export function AdminDashboard() {
  const { data, loading, error, reload } = useFetch<any>('/dashboard/admin', undefined, { interval: 30000 });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }
  const { totals: t, todayAttendance: a, weekly, requestStatus, utilization } = data;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live overview of the school transport operation." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={t.students} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard label="Drivers" value={t.drivers} icon={<UserCog className="h-5 w-5" />} tone="navy" />
        <StatCard label="Buses" value={`${t.availableVehicles}/${t.vehicles}`} icon={<Truck className="h-5 w-5" />} tone="green" />
        <StatCard label="Pending requests" value={t.pendingRequests} icon={<ClipboardList className="h-5 w-5" />} tone="amber" />
        <StatCard label="Open complaints" value={t.openComplaints} icon={<MessageSquareWarning className="h-5 w-5" />} tone="amber" />
        <StatCard label="Open problems" value={t.openProblems} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        <StatCard label="Trips today" value={t.todaysTrips} icon={<Navigation className="h-5 w-5" />} />
        <StatCard label="Today picked up" value={`${a.pickedUp}/${a.total}`} icon={<CalendarCheck className="h-5 w-5" />} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Attendance — last 7 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly.map((w: any) => ({ ...w, day: w.date.slice(5) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" fontSize={12} tick={{ fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" />
                <YAxis allowDecimals={false} fontSize={12} tick={{ fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" />
                <Tooltip contentStyle={{ background: "#14171c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff" }} itemStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                <Bar dataKey="pickedUp" name="Picked up" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dropped" name="Dropped" fill="#00d2ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Transport requests</h2>
          <div className="h-64">
            {requestStatus.length === 0 ? (
              <p className="pt-20 text-center text-sm text-slate-500">No requests yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={requestStatus} dataKey="count" nameKey="status" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {requestStatus.map((_: unknown, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#14171c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff" }} itemStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Bus utilisation</h2>
          {utilization.length === 0 ? (
            <p className="text-sm text-slate-500">No active bus assignments.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilization}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="bus" fontSize={12} tick={{ fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" />
                  <YAxis allowDecimals={false} fontSize={12} tick={{ fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" />
                  <Tooltip contentStyle={{ background: "#14171c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff" }} itemStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                  <Bar dataKey="students" name="Students" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="capacity" name="Capacity" fill="rgba(255,255,255,0.25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Today’s attendance</h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Total records', a.total],
              ['Picked up', a.pickedUp],
              ['Absent / unavailable', a.absent],
              ['Dropped off', a.dropped],
              ['Pending', a.pending],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-slate-900">{v}</dd></div>
            ))}
          </dl>
          <Bus className="hidden" />
        </div>
      </div>
    </>
  );
}

/* ---------- Students ---------- */
export function AdminStudents() {
  return (
    <CrudPage<StudentProfile>
      title="Students"
      subtitle="Manage student records and transport status."
      singular="Student"
      endpoint="/students"
      defaultSort="name"
      searchPlaceholder="Search name, ID, phone…"
      nameOf={(s) => s.name}
      filters={[{ name: 'status', label: 'Status', options: statusOptions }]}
      columns={[
        { key: 'studentId', header: 'ID', sortable: true },
        { key: 'name', header: 'Name', sortable: true },
        { key: 'className', header: 'Class', sortable: true, render: (s) => `${s.className}-${s.division}` },
        { key: 'phone', header: 'Contact' },
        { key: 'transport', header: 'Transport', render: (s) => (s.transport ? `${s.transport.vehicle.busNumber} · ${s.transport.route.name}` : <span className="text-slate-400">Unassigned</span>) },
        { key: 'status', header: 'Status', sortable: true, render: (s) => <Badge value={s.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'studentId', label: 'Student ID', required: true },
        { name: 'className', label: 'Class', required: true },
        { name: 'division', label: 'Division', required: true },
        { name: 'phone', label: 'Contact number', required: true },
        { name: 'parentName', label: 'Parent name' },
        { name: 'parentPhone', label: 'Parent contact', required: true },
        { name: 'email', label: 'Login email', type: 'email', required: true },
        { name: 'password', label: 'Password', type: 'password', hint: 'Leave blank to keep the current password', required: true },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions },
        { name: 'address', label: 'Address', type: 'textarea', required: true },
      ]}
      toForm={(s) => ({ ...s, email: s.user?.email || '', password: '' })}
      toPayload={(v, isEdit) => {
        const { _id, user, transport, createdAt, updatedAt, __v, ...rest } = v as any;
        if (!isEdit) delete rest.status;
        return rest;
      }}
      validate={(v, isEdit) => {
        const e: Record<string, string> = {};
        if (v.phone && !phoneRx.test(v.phone)) e.phone = 'Enter a valid phone number';
        if (v.parentPhone && !phoneRx.test(v.parentPhone)) e.parentPhone = 'Enter a valid phone number';
        if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email';
        if (!isEdit && v.password && (v.password.length < 8 || !/\d/.test(v.password) || !/[A-Za-z]/.test(v.password))) e.password = 'Min 8 characters with letters and numbers';
        if (isEdit && v.password && v.password.length < 8) e.password = 'Min 8 characters';
        return e;
      }}
    />
  );
}

/* ---------- Drivers ---------- */
export function AdminDrivers() {
  return (
    <CrudPage<DriverProfile>
      title="Drivers"
      subtitle="Add drivers and see their bus assignments."
      singular="Driver"
      endpoint="/drivers"
      defaultSort="name"
      nameOf={(d) => d.name}
      filters={[{ name: 'status', label: 'Status', options: statusOptions }]}
      columns={[
        { key: 'name', header: 'Name', sortable: true },
        { key: 'licenseNumber', header: 'License', sortable: true },
        { key: 'phone', header: 'Phone' },
        { key: 'assignment', header: 'Bus / Route', render: (d) => (d.assignment ? `${d.assignment.vehicle.busNumber} · ${d.assignment.route.name} (${d.assignment.students})` : <span className="text-slate-400">Unassigned</span>) },
        { key: 'status', header: 'Status', sortable: true, render: (d) => <Badge value={d.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'licenseNumber', label: 'License number', required: true },
        { name: 'phone', label: 'Phone', required: true },
        { name: 'email', label: 'Login email', type: 'email', required: true },
        { name: 'password', label: 'Password', type: 'password', required: true, hint: 'Leave blank to keep the current password' },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions },
        { name: 'address', label: 'Address', type: 'textarea' },
      ]}
      toForm={(d) => ({ ...d, email: d.user?.email || '', password: '' })}
      toPayload={(v, isEdit) => {
        const { _id, user, assignment, createdAt, updatedAt, __v, ...rest } = v as any;
        if (!isEdit) delete rest.status;
        return rest;
      }}
      validate={(v, isEdit) => {
        const e: Record<string, string> = {};
        if (v.phone && !phoneRx.test(v.phone)) e.phone = 'Enter a valid phone number';
        if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email';
        if (!isEdit && v.password && (v.password.length < 8 || !/\d/.test(v.password) || !/[A-Za-z]/.test(v.password))) e.password = 'Min 8 characters with letters and numbers';
        return e;
      }}
    />
  );
}

/* ---------- Vehicles ---------- */
export function AdminVehicles() {
  const vStatus = [
    { value: 'available', label: 'Available' },
    { value: 'unavailable', label: 'Unavailable' },
    { value: 'maintenance', label: 'Maintenance' },
  ];
  return (
    <CrudPage<Vehicle>
      title="Vehicles"
      subtitle="Buses, capacity, insurance and availability."
      singular="Vehicle"
      endpoint="/vehicles"
      defaultSort="busNumber"
      nameOf={(v) => v.registrationNumber}
      filters={[{ name: 'status', label: 'Status', options: vStatus }]}
      columns={[
        { key: 'busNumber', header: 'Bus', sortable: true },
        { key: 'registrationNumber', header: 'Registration', sortable: true },
        { key: 'capacity', header: 'Seats', sortable: true, render: (v) => (v.assignment ? `${v.assignment.students}/${v.capacity}` : v.capacity) },
        { key: 'assignment', header: 'Driver / Route', render: (v) => (v.assignment ? `${v.assignment.driver.name} · ${v.assignment.route.name}` : <span className="text-slate-400">Unassigned</span>) },
        {
          key: 'insuranceExpiry', header: 'Insurance expiry', sortable: true,
          render: (v) => {
            if (!v.insuranceExpiry) return '—';
            const expired = new Date(v.insuranceExpiry) < new Date();
            return <span className={expired ? 'font-medium text-red-600' : ''}>{fmtDate(v.insuranceExpiry)}{expired && ' (expired)'}</span>;
          },
        },
        { key: 'status', header: 'Status', sortable: true, render: (v) => <Badge value={v.status} /> },
      ]}
      fields={[
        { name: 'busNumber', label: 'Bus number', required: true },
        { name: 'registrationNumber', label: 'Registration number', required: true },
        { name: 'model', label: 'Model' },
        { name: 'capacity', label: 'Capacity (seats)', type: 'number', required: true },
        { name: 'insuranceNumber', label: 'Insurance number' },
        { name: 'insuranceExpiry', label: 'Insurance expiry', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: vStatus },
      ]}
      toForm={(v) => ({ ...v, insuranceExpiry: toInputDate(v.insuranceExpiry) })}
      toPayload={(v, isEdit) => {
        const { _id, assignment, createdAt, updatedAt, __v, ...rest } = v as any;
        if (rest.capacity !== '') rest.capacity = Number(rest.capacity);
        if (!isEdit && !rest.status) delete rest.status;
        return rest;
      }}
      validate={(v) => {
        const e: Record<string, string> = {};
        if (v.capacity !== '' && (!Number.isInteger(Number(v.capacity)) || Number(v.capacity) < 1)) e.capacity = 'Enter a whole number of seats';
        return e;
      }}
    />
  );
}

/* ---------- Routes ---------- */
export function AdminRoutes() {
  return (
    <CrudPage<RouteDoc>
      title="Routes"
      subtitle="Create routes and manage their stop sequences."
      singular="Route"
      endpoint="/routes"
      defaultSort="name"
      nameOf={(r) => r.name}
      filters={[{ name: 'status', label: 'Status', options: statusOptions }]}
      blankValues={{ stops: [{ sequence: 1, name: '', pickupTime: '', dropTime: '' }], status: 'active' }}
      columns={[
        { key: 'name', header: 'Route', sortable: true },
        {
          key: 'stops', header: 'Stops',
          render: (r) => (
            <span className="text-slate-600">
              {r.stops.length} · {r.stops.map((s) => s.name).join(' → ')}
            </span>
          ),
        },
        { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge value={r.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Route name', required: true },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'stops', label: 'Stops (in order)', type: 'stops', required: true },
      ]}
      toPayload={(v) => {
        const { _id, createdAt, updatedAt, __v, ...rest } = v as any;
        return rest;
      }}
      validate={(v) => {
        const e: Record<string, string> = {};
        const stops = (v.stops || []) as any[];
        if (stops.some((s) => !String(s.name || '').trim())) e.stops = 'Every stop needs a name';
        else if (new Set(stops.map((s) => Number(s.sequence))).size !== stops.length) e.stops = 'Stop sequence numbers must be unique';
        return e;
      }}
    />
  );
}
