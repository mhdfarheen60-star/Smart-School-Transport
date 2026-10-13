import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Archive,
  Bus,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Route as RouteIcon,
  Search,
  Sparkles,
  Truck,
  UserCog,
  Users,
} from 'lucide-react';
import { gradientStyle, LogoMark, SectionEyebrow } from '../components/brand';

const EASE = [0.22, 1, 0.36, 1] as const;

function PillLink({ to, label, outline = false }: { to: string; label: string; outline?: boolean }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-all active:scale-[0.98] ${
        outline
          ? 'border border-white/15 text-white hover:bg-white/5'
          : 'bg-white text-black hover:bg-white/90'
      }`}
    >
      {label}
      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-px" />
    </Link>
  );
}

function Navbar() {
  const links = [
    ['Features', '#features'],
    ['Workflow', '#workflow'],
    ['Portals', '#portals'],
  ];
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative z-10"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" aria-label="Smart School Transport">
          <LogoMark />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {links.map(([l, href], i) => (
            <motion.a
              key={l}
              href={href}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
              className="text-sm font-medium text-white/70 hover:text-white"
            >
              {l}
            </motion.a>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login" className="text-sm font-medium text-white/70 hover:text-white">
            Sign in
          </Link>
          <PillLink to="/register" label="Get started" />
        </div>
        <Link
          to="/login"
          aria-label="Sign in"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 md:hidden"
        >
          <Menu className="h-4 w-4" />
        </Link>
      </div>
    </motion.nav>
  );
}

function Hero() {
  return (
    <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-16 text-center md:pt-28">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8, ease: EASE }}
        className="text-4xl font-semibold leading-[0.9] tracking-tight md:text-7xl"
      >
        <span className="block">Every school run.</span>
        <span className="block animate-shiny" style={gradientStyle}>
          Revitalized
        </span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8, ease: EASE }}
        className="mt-8 max-w-md text-base leading-[1.5] text-white/60"
      >
        Smart School Transport connects students, drivers and school management — requests, buses, routes and
        daily pickup and drop-off tracking, all in one clear, real-time system.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.8, ease: EASE }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        <PillLink to="/register" label="Create student account" />
        <span className="text-xs text-white/40">Drivers and administrators sign in with accounts issued by the school</span>
      </motion.div>
    </section>
  );
}

function MenuBar() {
  const items = ['Dashboard', 'Students', 'Buses', 'Routes', 'Reports', 'Help'];
  const now = new Date().toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.6 }}
      className="relative z-10 h-10 border-b border-t border-white/10 bg-black/40 backdrop-blur-md"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 text-xs">
        <div className="flex items-center gap-5">
          <Bus className="h-3.5 w-3.5" />
          <span className="font-bold text-white">Smart School</span>
          {items.map((it, i) => (
            <span key={it} className={`text-white/70 ${i > 3 ? 'hidden md:inline' : i > 2 ? 'hidden sm:inline' : ''}`}>
              {it}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-white/70">
          <Search className="h-3.5 w-3.5" />
          <span>{now}</span>
        </div>
      </div>
    </motion.div>
  );
}

const MOCK_ROWS = [
  { name: 'Aarav Nair', subject: 'Transport request · Lake View', preview: 'Pickup 12 Lake View Road, drop School gate...', time: '9:41 AM', unread: true, active: true },
  { name: 'Sophia Chen', subject: 'Transport request · Green Park', preview: 'Needs a morning pickup from Green Park stop...', time: '8:12 AM', unread: true },
  { name: 'Bus 02', subject: 'Trip completed', preview: 'South Town Route · 28 of 30 students dropped.', time: 'Yesterday' },
  { name: 'Ravi Kumar', subject: 'Vehicle problem · Traffic delay', preview: 'About 15 minutes behind schedule on North City.', time: 'Yesterday' },
  { name: 'Insurance', subject: 'Bus 04 insurance expires soon', preview: 'Renewal due within 30 days — update vehicle record.', time: 'Mon' },
  { name: 'Complaint', subject: 'Pickup time too early', preview: 'Parent asked for a later pickup at Temple Road.', time: 'Mon' },
];

function InboxMockup() {
  const nav = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: GraduationCap, label: 'Students', count: 248 },
    { icon: UserCog, label: 'Drivers', count: 12 },
    { icon: Truck, label: 'Vehicles', count: 10 },
    { icon: RouteIcon, label: 'Routes', count: 8 },
    { icon: ClipboardList, label: 'Requests', count: 5 },
    { icon: Archive, label: 'Reports' },
  ];
  const labels = [
    { name: 'Picked up', color: '#10b981' },
    { name: 'Absent', color: '#f59e0b' },
    { name: 'Dropped', color: '#00d2ff' },
    { name: 'Pending', color: '#A4F4FD' },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.8, ease: EASE }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1014]/90 backdrop-blur-2xl"
      >
        <div className="relative flex h-10 items-center border-b border-white/10 px-4">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-xs text-white/50">Smart School — Admin</span>
        </div>
        <div className="grid h-[520px] grid-cols-12">
          <div className="col-span-3 hidden border-r border-white/10 bg-black/30 p-4 sm:block">
            <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">
              <Sparkles className="h-3.5 w-3.5" />
              New assignment
            </div>
            <div className="mt-5 space-y-1">
              {nav.map(({ icon: Icon, label, count, active }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs ${
                    active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="flex-1">{label}</span>
                  {count !== undefined && <span className="text-white/40">{count}</span>}
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="mb-2 px-2.5 text-[10px] uppercase tracking-widest text-white/40">Attendance</div>
              {labels.map((l) => (
                <div key={l.name} className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/60">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 overflow-hidden border-r border-white/10 sm:col-span-4">
            <div className="flex h-11 items-center gap-2 border-b border-white/10 px-4 text-xs text-white/40">
              <Search className="h-3.5 w-3.5" />
              Search requests and activity
            </div>
            {MOCK_ROWS.map((m) => (
              <div key={m.subject} className={`border-b border-white/5 px-4 py-3 ${m.active ? 'bg-white/[0.06]' : ''}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1.5 ${m.unread ? 'font-semibold text-white' : 'text-white/70'}`}>
                    {m.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                    {m.name}
                  </span>
                  <span className="text-white/40">{m.time}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-white/80">{m.subject}</div>
                <div className="mt-0.5 truncate text-xs text-white/40">{m.preview}</div>
              </div>
            ))}
          </div>

          <div className="col-span-5 hidden overflow-hidden sm:block">
            <div className="flex h-11 items-center gap-1 border-b border-white/10 px-4 text-white/60">
              {[CalendarCheck, Users, RouteIcon, FileText].map((Icon, i) => (
                <span key={i} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ))}
              <MoreHorizontal className="ml-auto h-4 w-4" />
            </div>
            <div className="p-5">
              <h3 className="text-base font-semibold">Transport request · Aarav Nair</h3>
              <div className="mt-3 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#00d2ff] to-[#0B2551] text-xs font-semibold">
                  A
                </div>
                <div className="text-xs">
                  <div className="font-medium">Aarav Nair</div>
                  <div className="text-white/40">Class 8-A · 9:41 AM</div>
                </div>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60">Pending</span>
              </div>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: '#A4F4FD' }} />
                  Assignment check
                </div>
                <p className="mt-1.5 text-xs leading-[1.5] text-white/60">
                  Bus 03 · North City Route has 6 free seats and stops at Lake View. Capacity and driver
                  availability are validated before the assignment is saved.
                </p>
              </div>
              <div className="mt-4 space-y-3 text-xs leading-[1.6] text-white/70">
                <p>Pickup: 12 Lake View Road</p>
                <p>Drop: School main gate</p>
                <p>Preferred stop: Lake View — pickup 07:30, drop 15:15.</p>
                <p className="text-white/50">Approving notifies the student instantly.</p>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
                <FileText className="h-3.5 w-3.5" />
                attendance-report.pdf
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Features() {
  const chips = ['Capacity checks', 'Conflict detection', 'Instant notifications', 'Full history'];
  const groups = [
    { title: 'Pending requests', count: 4, color: '#ffffff', items: ['Aarav Nair — Lake View', 'Meera Das — Green Park'] },
    { title: 'Picked up', count: 31, color: '#e5e5e5', items: ['Bus 01 — North City', 'Bus 02 — South Town'] },
    { title: 'Dropped off', count: 28, color: '#a3a3a3', items: ['Bus 01 — 15:40', 'Bus 02 — 15:52'] },
    { title: 'Absent', count: 3, color: '#525252', items: ['Reported by drivers · parents notified'] },
  ];
  return (
    <section id="features" className="relative z-10 mx-auto grid max-w-6xl items-start gap-10 px-6 py-20 md:grid-cols-2 md:gap-16 md:py-28">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
        <SectionEyebrow label="Dispatch" tag="Real-time" />
        <h2 className="mt-5 text-3xl font-semibold leading-[1.02] tracking-tight md:text-5xl">
          Run every route <br /> in a single pass.
        </h2>
        <p className="mt-6 max-w-md text-base leading-[1.6] text-white/60">
          Approve requests, assign buses and drivers, and watch pickups and drop-offs come in live. Conflicts and
          overbooked buses are caught before they reach the road.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">
              {c}
            </span>
          ))}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="liquid-glass rounded-2xl p-5"
      >
        <div className="mb-4 text-xs text-white/50">Today · live attendance board (sample)</div>
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.title} className="liquid-glass rounded-lg p-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                  {g.title}
                </span>
                <span className="text-xs text-white/50">{g.count}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {g.items.map((it) => (
                  <li key={it} className="text-xs text-white/50">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function Capabilities() {
  const names = ['Requests', 'Assignments', 'Routes', 'Attendance', 'Complaints', 'Reports', 'Alerts', 'Audit log'];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:py-20">
      <p className="text-center text-xs uppercase tracking-widest text-white/40">One platform for every part of school transport</p>
      <div className="mt-10 grid grid-cols-2 gap-6 text-center sm:grid-cols-4 lg:grid-cols-8">
        {names.map((n, i) => (
          <motion.span
            key={n}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="text-sm font-semibold tracking-tight text-white/50 transition-colors hover:text-white"
          >
            {n}
          </motion.span>
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    {
      quote: 'Students register, request transport, and see their bus, driver, route and pickup time as soon as it is assigned.',
      name: 'Students',
      role: 'Request, track, get notified',
      tag: 'Student',
    },
    {
      quote: 'Drivers open the daily trip, mark each student picked up, absent or dropped, and report breakdowns or delays in one tap.',
      name: 'Drivers',
      role: 'Pickup and drop-off tracking',
      tag: 'Driver',
    },
    {
      quote: 'Administrators approve requests, assign buses and routes, resolve complaints, and export reports to CSV or PDF.',
      name: 'Administrators',
      role: 'Control, oversight, reporting',
      tag: 'Admin',
    },
  ];
  return (
    <section id="workflow" className="relative z-10 mx-auto max-w-6xl border-t border-white/10 px-6 py-20 md:py-28">
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.figure
            key={s.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="liquid-glass rounded-2xl p-6"
          >
            <blockquote className="text-sm leading-[1.6] text-white/80">{s.quote}</blockquote>
            <figcaption className="mt-6 border-t border-white/10 pt-5">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-white/50">{s.role}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white">{s.tag}</div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

function Check() {
  return (
    <span className="c3-check">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function Portals() {
  const plans = [
    {
      tier: 'For families',
      name: 'Student',
      desc: 'Register once, request transport and follow every pickup and drop-off.',
      features: ['Transport request form', 'Bus, driver and route details', 'Pickup / drop attendance history', 'Notifications and complaints', 'Profile management'],
      to: '/login',
      cta: 'Student sign in',
    },
    {
      tier: 'For the road',
      name: 'Driver',
      desc: 'Everything needed to run a route and keep students safe.',
      features: ['Daily trip and student list', 'Mark pickup and drop-off', 'Stop-by-stop route details', 'Report breakdowns and delays', 'Admin and student alerts'],
      to: '/driver/login',
      cta: 'Driver sign in',
      pro: false,
    },
    {
      tier: 'For the school',
      name: 'Admin',
      desc: 'Full control of fleet, routes, assignments, complaints and reports.',
      features: ['Student, driver and vehicle management', 'Route and assignment planning', 'Request approvals', 'Attendance monitoring', 'Reports with CSV / PDF export'],
      to: '/admin/login',
      cta: 'Admin sign in',
      pro: true,
    },
  ];
  return (
    <section id="portals" className="c3-pricing-section relative z-10">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="c3-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" stitchTiles="stitch" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.075" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
        </filter>
      </svg>
      <div className="c3-watermark-container">
        <div className="c3-watermark-main">
          <span className="c3-watermark-line-1">Every ride.</span>
          <span className="c3-watermark-line-2">Accounted for</span>
        </div>
      </div>
      <div className="c3-grid">
        {plans.map((p) => (
          <div key={p.name} className={`c3-card ${p.pro ? 'c3-card-pro' : ''}`}>
            <div className="c3-tier-small">{p.tier}</div>
            <div className="c3-tier-large">{p.name}</div>
            <p className="c3-desc">{p.desc}</p>
            <ul className="c3-list">
              {p.features.map((f) => (
                <li key={f}>
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link to={p.to} className="c3-btn">
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="liquid-glass relative overflow-hidden rounded-3xl px-8 py-16 text-center md:py-24"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(600px circle at 50% 0%, rgba(255,255,255,0.15), transparent 70%)', opacity: 0.3 }}
        />
        <div className="relative">
          <h2 className="text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
            Fewer phone calls.
            <br />
            Safer journeys.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-sm leading-[1.6] text-white/60">
            Give students, drivers and administrators one shared, always-current view of school transport.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PillLink to="/register" label="Create student account" />
            <PillLink to="/admin/login" label="Administrator sign in" outline />
          </div>
        </div>
      </motion.div>
      <p className="mt-10 text-center text-xs text-white/40">Smart School Transport · Developed by Muhammed Farheen P K</p>
    </section>
  );
}

export default function Landing() {
  return (
    <>
      {/* guide lines at the 36rem container edges */}
      <div className="pointer-events-none fixed inset-y-0 left-1/2 z-[5] hidden w-px -translate-x-[calc(50%+36rem)] bg-white/10 md:block" />
      <div className="pointer-events-none fixed inset-y-0 left-1/2 z-[5] hidden w-px translate-x-[calc(-50%+36rem)] bg-white/10 md:block" />
      <Navbar />
      <Hero />
      <MenuBar />
      <InboxMockup />
      <Features />
      <Capabilities />
      <Workflow />
      <Portals />
      <FinalCTA />
    </>
  );
}
