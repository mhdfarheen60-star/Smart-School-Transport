import { Types } from 'mongoose';
import { Student, TransportAssignment, Vehicle } from '../models';
import { ApiError } from '../utils/http';
import { notifyUsers } from './notification.service';

/**
 * Enrols a student on a bus assignment.
 * Validates capacity, vehicle availability and moves the student off any other active assignment.
 */
export async function enrollStudent(
  assignmentId: string | Types.ObjectId,
  studentId: string | Types.ObjectId,
  stop?: string
) {
  const assignment = await TransportAssignment.findById(assignmentId);
  if (!assignment || assignment.status !== 'active') {
    throw new ApiError(404, 'Active assignment not found');
  }
  const vehicle = await Vehicle.findById(assignment.vehicle);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (vehicle.status !== 'available') {
    throw new ApiError(409, `Vehicle ${vehicle.registrationNumber} is ${vehicle.status}`);
  }
  const student = await Student.findById(studentId);
  if (!student || student.status !== 'active') throw new ApiError(404, 'Active student not found');

  const already = assignment.riders.some((r) => String(r.student) === String(student._id));
  if (!already && assignment.riders.length >= vehicle.capacity) {
    throw new ApiError(
      409,
      `Vehicle capacity reached (${assignment.riders.length}/${vehicle.capacity})`
    );
  }

  // Move off any other active assignment (history is preserved on past trips/attendance).
  await TransportAssignment.updateMany(
    { _id: { $ne: assignment._id }, status: 'active', 'riders.student': student._id },
    { $pull: { riders: { student: student._id } } }
  );

  if (already) {
    const rider = assignment.riders.find((r) => String(r.student) === String(student._id))!;
    if (stop !== undefined) rider.stop = stop;
  } else {
    assignment.riders.push({ student: student._id, stop, joinedAt: new Date() } as any);
  }
  await assignment.save();
  await notifyUsers([student.user], {
    title: 'Transport assigned',
    message: 'Your transport has been assigned. Open "My Transport" to see bus, driver and route details.',
    type: 'assignment',
  });
  return assignment;
}
