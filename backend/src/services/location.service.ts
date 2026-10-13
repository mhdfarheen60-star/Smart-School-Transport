import { Types } from 'mongoose';
import { TransportRequest } from '../models';

export interface GeoPoint {
  address: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

/** Adds `pickup` / `drop` objects (address + coordinates) to a request document. */
export function serializeRequest<T extends Record<string, any>>(r: T) {
  const plain: any = typeof r.toObject === 'function' ? r.toObject() : r;
  const point = (address: string, geo?: { latitude: number; longitude: number; placeId?: string }): GeoPoint => ({
    address,
    latitude: geo?.latitude,
    longitude: geo?.longitude,
    placeId: geo?.placeId,
  });
  return {
    ...plain,
    pickup: point(plain.pickupLocation, plain.pickupGeo),
    drop: point(plain.dropLocation, plain.dropGeo),
  };
}

/** Latest APPROVED request per student = their current pickup/drop locations. */
export async function currentLocations(studentIds: (string | Types.ObjectId)[]) {
  const reqs = await TransportRequest.find({ student: { $in: studentIds }, status: 'approved' })
    .sort('-createdAt')
    .lean();
  const out = new Map<string, { requestId: string; pickup: GeoPoint; drop: GeoPoint }>();
  for (const r of reqs) {
    const key = String(r.student);
    if (out.has(key)) continue;
    const s = serializeRequest(r);
    out.set(key, { requestId: String(r._id), pickup: s.pickup, drop: s.drop });
  }
  return out;
}
