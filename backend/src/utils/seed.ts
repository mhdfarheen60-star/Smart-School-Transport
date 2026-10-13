/**
 * Creates the first administrator (and, with --demo, sample drivers, buses and routes).
 *   npm run seed            -> admin only
 *   npm run seed -- --demo  -> admin + demo data
 * Credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db';
import { Driver, Route, User, Vehicle } from '../models';

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@school.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set SEED_ADMIN_PASSWORD (min 8 chars) in backend/.env before seeding');
  }
  await connectDB();

  if (!(await User.exists({ email }))) {
    await User.create({
      name: 'School Administrator',
      email,
      role: 'admin',
      phone: '0000000000',
      password: await bcrypt.hash(password, 12),
    });
    console.log(`Admin created: ${email}`);
  } else {
    console.log(`Admin already exists: ${email}`);
  }

  if (process.argv.includes('--demo')) {
    const demoPw = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD || password, 12);
    const drivers = [
      { name: 'Ravi Kumar', email: 'ravi.driver@school.local', license: 'KL0120200001', phone: '9876500001' },
      { name: 'Suresh Nair', email: 'suresh.driver@school.local', license: 'KL0120200002', phone: '9876500002' },
    ];
    for (const d of drivers) {
      if (await User.exists({ email: d.email })) continue;
      const u = await User.create({ name: d.name, email: d.email, role: 'driver', phone: d.phone, password: demoPw });
      await Driver.create({ user: u._id, name: d.name, licenseNumber: d.license, phone: d.phone });
    }
    const vehicles = [
      { registrationNumber: 'KL-01-AB-1001', busNumber: 'BUS-01', model: 'Tata Starbus', capacity: 40 },
      { registrationNumber: 'KL-01-AB-1002', busNumber: 'BUS-02', model: 'Ashok Leyland', capacity: 30 },
    ];
    for (const v of vehicles) {
      if (!(await Vehicle.exists({ registrationNumber: v.registrationNumber }))) {
        await Vehicle.create({ ...v, insuranceNumber: 'INS-' + v.busNumber, insuranceExpiry: new Date(Date.now() + 200 * 864e5) });
      }
    }
    const routes = [
      {
        name: 'North City Route',
        stops: [
          { name: 'Central Station', sequence: 1, pickupTime: '07:00', dropTime: '15:45' },
          { name: 'Green Park', sequence: 2, pickupTime: '07:15', dropTime: '15:30' },
          { name: 'Lake View', sequence: 3, pickupTime: '07:30', dropTime: '15:15' },
        ],
      },
      {
        name: 'South Town Route',
        stops: [
          { name: 'Market Junction', sequence: 1, pickupTime: '07:05', dropTime: '15:50' },
          { name: 'Temple Road', sequence: 2, pickupTime: '07:20', dropTime: '15:35' },
        ],
      },
    ];
    for (const r of routes) {
      if (!(await Route.exists({ name: r.name }))) await Route.create(r);
    }
    console.log('Demo drivers, vehicles and routes created.');
  }
  await disconnectDB();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
