import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import {
  Attendance,
  Complaint,
  Driver,
  Student,
  TransportAssignment,
  TransportRequest,
  Vehicle,
  VehicleProblemReport,
} from '../models';
import { audit } from '../services/audit.service';
import { ApiError, asyncHandler, ok, todayStr } from '../utils/http';

type Row = Record<string, string | number>;
interface Report {
  title: string;
  columns: { key: string; label: string }[];
  rows: Row[];
}

const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const dt = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '');

function dateRange(from?: string, to?: string) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !re.test(from)) || (to && !re.test(to))) throw new ApiError(422, 'Dates must be YYYY-MM-DD');
  if (from && to && from > to) throw new ApiError(422, '"From" date must not be after "To" date');
  return { from, to };
}

function createdRange(from?: string, to?: string) {
  const f: Record<string, Date> = {};
  if (from) f.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) f.$lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(f).length ? { createdAt: f } : {};
}

const builders: Record<string, (from?: string, to?: string) => Promise<Report>> = {
  async students(from, to) {
    const students = await Student.find(createdRange(from, to)).populate('user', 'email').sort('name').lean();
    const asg = await TransportAssignment.find({ status: 'active' })
      .populate('vehicle', 'busNumber registrationNumber')
      .populate('route', 'name')
      .populate('driver', 'name')
      .lean();
    const map = new Map<string, any>();
    for (const a of asg) for (const r of a.riders) map.set(String(r.student), { a, r });
    return {
      title: 'Student Transport Report',
      columns: [
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Name' },
        { key: 'class', label: 'Class' },
        { key: 'phone', label: 'Phone' },
        { key: 'bus', label: 'Bus' },
        { key: 'driver', label: 'Driver' },
        { key: 'route', label: 'Route' },
        { key: 'stop', label: 'Stop' },
        { key: 'status', label: 'Status' },
      ],
      rows: students.map((s: any) => {
        const m = map.get(String(s._id));
        return {
          studentId: s.studentId,
          name: s.name,
          class: `${s.className}-${s.division}`,
          phone: s.phone,
          bus: m ? `${m.a.vehicle.busNumber} (${m.a.vehicle.registrationNumber})` : 'Unassigned',
          driver: m ? m.a.driver.name : '',
          route: m ? m.a.route.name : '',
          stop: m?.r.stop || '',
          status: s.status,
        };
      }),
    };
  },
  async drivers(from, to) {
    const drivers = await Driver.find(createdRange(from, to)).populate('user', 'email').sort('name').lean();
    const asg = await TransportAssignment.find({ status: 'active' })
      .populate('vehicle', 'busNumber registrationNumber')
      .populate('route', 'name')
      .lean();
    const map = new Map(asg.map((a: any) => [String(a.driver), a]));
    return {
      title: 'Driver Report',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'license', label: 'License' },
        { key: 'bus', label: 'Bus' },
        { key: 'route', label: 'Route' },
        { key: 'students', label: 'Students' },
        { key: 'status', label: 'Status' },
      ],
      rows: drivers.map((d: any) => {
        const a: any = map.get(String(d._id));
        return {
          name: d.name,
          email: d.user?.email || '',
          phone: d.phone,
          license: d.licenseNumber,
          bus: a ? `${a.vehicle.busNumber} (${a.vehicle.registrationNumber})` : 'Unassigned',
          route: a?.route?.name || '',
          students: a ? a.riders.length : 0,
          status: d.status,
        };
      }),
    };
  },
  async vehicles(from, to) {
    const vehicles = await Vehicle.find(createdRange(from, to)).sort('busNumber').lean();
    const asg = await TransportAssignment.find({ status: 'active' })
      .populate('driver', 'name')
      .populate('route', 'name')
      .lean();
    const map = new Map(asg.map((a: any) => [String(a.vehicle), a]));
    return {
      title: 'Vehicle Report',
      columns: [
        { key: 'bus', label: 'Bus' },
        { key: 'registration', label: 'Registration' },
        { key: 'model', label: 'Model' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'students', label: 'Students' },
        { key: 'driver', label: 'Driver' },
        { key: 'route', label: 'Route' },
        { key: 'insuranceExpiry', label: 'Insurance Expiry' },
        { key: 'status', label: 'Status' },
      ],
      rows: vehicles.map((v: any) => {
        const a: any = map.get(String(v._id));
        return {
          bus: v.busNumber,
          registration: v.registrationNumber,
          model: v.model || '',
          capacity: v.capacity,
          students: a ? a.riders.length : 0,
          driver: a?.driver?.name || '',
          route: a?.route?.name || '',
          insuranceExpiry: iso(v.insuranceExpiry),
          status: v.status,
        };
      }),
    };
  },
  async attendance(from, to) {
    const filter: Record<string, unknown> = {};
    if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const recs = await Attendance.find(filter)
      .populate('student', 'name studentId className division')
      .populate('vehicle', 'busNumber')
      .populate('driver', 'name')
      .sort('-date')
      .limit(5000)
      .lean();
    return {
      title: 'Attendance Report',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Student' },
        { key: 'bus', label: 'Bus' },
        { key: 'driver', label: 'Driver' },
        { key: 'pickup', label: 'Pickup' },
        { key: 'pickupAt', label: 'Pickup Time' },
        { key: 'drop', label: 'Drop' },
        { key: 'dropAt', label: 'Drop Time' },
      ],
      rows: recs.map((r: any) => ({
        date: r.date,
        studentId: r.student?.studentId || '',
        name: r.student?.name || '',
        bus: r.vehicle?.busNumber || '',
        driver: r.driver?.name || '',
        pickup: r.pickupStatus,
        pickupAt: dt(r.pickupAt),
        drop: r.dropStatus,
        dropAt: dt(r.dropAt),
      })),
    };
  },
  async complaints(from, to) {
    const list = await Complaint.find(createdRange(from, to)).populate('user', 'name').sort('-createdAt').lean();
    return {
      title: 'Complaint Report',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'by', label: 'Submitted By' },
        { key: 'role', label: 'Role' },
        { key: 'category', label: 'Category' },
        { key: 'subject', label: 'Subject' },
        { key: 'status', label: 'Status' },
        { key: 'response', label: 'Response' },
      ],
      rows: list.map((c: any) => ({
        date: iso(c.createdAt),
        by: c.user?.name || '',
        role: c.role,
        category: c.category,
        subject: c.subject,
        status: c.status,
        response: c.adminResponse || '',
      })),
    };
  },
  async 'vehicle-problems'(from, to) {
    const list = await VehicleProblemReport.find(createdRange(from, to))
      .populate('vehicle', 'busNumber registrationNumber')
      .populate('driver', 'name')
      .sort('-createdAt')
      .lean();
    return {
      title: 'Vehicle Problem Report',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'bus', label: 'Bus' },
        { key: 'driver', label: 'Driver' },
        { key: 'type', label: 'Type' },
        { key: 'severity', label: 'Severity' },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status' },
      ],
      rows: list.map((p: any) => ({
        date: iso(p.createdAt),
        bus: p.vehicle?.busNumber || '',
        driver: p.driver?.name || '',
        type: p.type,
        severity: p.severity,
        description: p.description,
        status: p.status,
      })),
    };
  },
  async requests(from, to) {
    const list = await TransportRequest.find(createdRange(from, to))
      .populate('student', 'name studentId')
      .sort('-createdAt')
      .lean();
    return {
      title: 'Transport Request Report',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Student' },
        { key: 'pickup', label: 'Pickup' },
        { key: 'drop', label: 'Drop' },
        { key: 'status', label: 'Status' },
      ],
      rows: list.map((r: any) => ({
        date: iso(r.createdAt),
        studentId: r.student?.studentId || '',
        name: r.student?.name || '',
        pickup: r.pickupLocation,
        drop: r.dropLocation,
        status: r.status,
      })),
    };
  },
};

function csvCell(v: string | number): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

export const types = Object.keys(builders);

export const generate = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type;
  const build = builders[type];
  if (!build) throw new ApiError(404, `Unknown report type. Use one of: ${types.join(', ')}`);
  const { from, to } = dateRange(req.query.from as string | undefined, req.query.to as string | undefined);
  const report = await build(from, to);
  const format = (req.query.format as string) || 'json';
  await audit(req, 'report', 'Report', type, { format, from, to, rows: report.rows.length });

  const filename = `${type}-report-${todayStr()}`;
  if (format === 'csv') {
    const header = report.columns.map((c) => csvCell(c.label)).join(',');
    const body = report.rows.map((r) => report.columns.map((c) => csvCell(r[c.key])).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return void res.send(`﻿${header}\n${body}`);
  }
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.pipe(res);
    doc.fontSize(16).fillColor('#0f2557').text(report.title);
    doc
      .fontSize(9)
      .fillColor('#555')
      .text(`Generated ${new Date().toLocaleString()}${from || to ? `  |  Range: ${from || '...'} to ${to || '...'}` : ''}  |  ${report.rows.length} records`);
    doc.moveDown(0.8);
    const width = doc.page.width - 60;
    const colW = width / report.columns.length;
    const drawRow = (cells: string[], bold: boolean, shade: boolean) => {
      const y = doc.y;
      if (y > doc.page.height - 60) {
        doc.addPage();
      }
      const top = doc.y;
      if (shade) doc.rect(30, top - 2, width, 16).fill('#e8eefc');
      doc.fillColor('#111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      cells.forEach((c, i) =>
        doc.text(String(c ?? ''), 32 + i * colW, top, { width: colW - 4, height: 12, ellipsis: true, lineBreak: false })
      );
      doc.y = top + 16;
    };
    drawRow(report.columns.map((c) => c.label), true, true);
    for (const r of report.rows) {
      drawRow(report.columns.map((c) => String(r[c.key])), false, false);
    }
    if (!report.rows.length) doc.fontSize(10).text('No records for the selected range.');
    doc.end();
    return;
  }
  ok(res, report, { count: report.rows.length });
});
