export interface RoutableVisit {
  id: string;
  entidade?: {
    latitude?: string | null;
    longitude?: string | null;
  } | null;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

function getCoordinate(visit: RoutableVisit): Coordinate | null {
  const rawLatitude = visit.entidade?.latitude;
  const rawLongitude = visit.entidade?.longitude;
  if (
    rawLatitude === null ||
    rawLatitude === undefined ||
    rawLatitude === "" ||
    rawLongitude === null ||
    rawLongitude === undefined ||
    rawLongitude === ""
  ) {
    return null;
  }
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function distanceInKm(a: Coordinate, b: Coordinate) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function orderVisitsByProximity<T extends RoutableVisit>(visits: T[]) {
  const located = visits
    .map((visit) => ({ visit, coordinate: getCoordinate(visit) }))
    .filter(
      (entry): entry is { visit: T; coordinate: Coordinate } =>
        entry.coordinate !== null,
    );

  if (located.length < 2) return located.map(({ visit }) => visit);

  const ordered = [located.shift()!];
  while (located.length) {
    const current = ordered[ordered.length - 1].coordinate;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    located.forEach((candidate, index) => {
      const distance = distanceInKm(current, candidate.coordinate);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    ordered.push(located.splice(nearestIndex, 1)[0]);
  }

  return ordered.map(({ visit }) => visit);
}

export function buildGoogleMapsRouteUrl(visits: RoutableVisit[]) {
  const ordered = orderVisitsByProximity(visits);
  const coordinates = ordered
    .map(getCoordinate)
    .filter((coordinate): coordinate is Coordinate => coordinate !== null)
    .map(({ latitude, longitude }) => `${latitude},${longitude}`);

  if (!coordinates.length) return null;
  if (coordinates.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      coordinates[0],
    )}`;
  }

  const origin = coordinates[0];
  const destination = coordinates[coordinates.length - 1];
  const waypoints = coordinates.slice(1, -1);
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

interface ConflictActivity {
  kind: "tarefa" | "visita";
  id: string;
  scheduledAt: string | null;
  assignedUserId: string | null;
}

function localDayKey(value: string) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function analyzePlanningConflicts(
  items: ConflictActivity[],
  overloadThreshold = 8,
) {
  const activitiesByUserAndDay = new Map<string, ConflictActivity[]>();
  for (const item of items) {
    if (!item.scheduledAt || !item.assignedUserId) continue;
    const dayKey = localDayKey(item.scheduledAt);
    const key = `${item.assignedUserId}:${dayKey}`;
    activitiesByUserAndDay.set(key, [
      ...(activitiesByUserAndDay.get(key) ?? []),
      item,
    ]);
  }

  const conflictingItemIds = new Set<string>();
  const overloadedDayKeys = new Set<string>();
  const conflictDayKeys = new Set<string>();
  activitiesByUserAndDay.forEach((groupedItems, key) => {
    const dayKey = key.slice(key.lastIndexOf(":") + 1);
    const sortedItems = [...groupedItems].sort(
      (left, right) =>
        new Date(left.scheduledAt!).getTime() -
        new Date(right.scheduledAt!).getTime(),
    );
    if (sortedItems.length > overloadThreshold) overloadedDayKeys.add(dayKey);

    for (let index = 1; index < sortedItems.length; index += 1) {
      const previous = sortedItems[index - 1];
      const current = sortedItems[index];
      const expectedDurationMinutes = previous.kind === "visita" ? 60 : 30;
      const differenceMinutes =
        (new Date(current.scheduledAt!).getTime() -
          new Date(previous.scheduledAt!).getTime()) /
        60_000;
      if (differenceMinutes < expectedDurationMinutes) {
        conflictingItemIds.add(`${previous.kind}:${previous.id}`);
        conflictingItemIds.add(`${current.kind}:${current.id}`);
        conflictDayKeys.add(dayKey);
      }
    }
  });

  return { conflictingItemIds, overloadedDayKeys, conflictDayKeys };
}
