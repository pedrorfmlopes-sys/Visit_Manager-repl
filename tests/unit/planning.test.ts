import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePlanningConflicts,
  buildGoogleMapsRouteUrl,
  distanceInKm,
  orderVisitsByProximity,
} from "../../client/src/lib/planning";

test("detects overlapping activities only for the same user and day", () => {
  const result = analyzePlanningConflicts([
    {
      kind: "visita",
      id: "visit",
      scheduledAt: "2026-07-28T09:00:00.000Z",
      assignedUserId: "user-a",
    },
    {
      kind: "tarefa",
      id: "overlap",
      scheduledAt: "2026-07-28T09:30:00.000Z",
      assignedUserId: "user-a",
    },
    {
      kind: "tarefa",
      id: "other-user",
      scheduledAt: "2026-07-28T09:15:00.000Z",
      assignedUserId: "user-b",
    },
  ]);

  assert.deepEqual(
    [...result.conflictingItemIds].sort(),
    ["tarefa:overlap", "visita:visit"],
  );
  assert.equal(result.conflictDayKeys.size, 1);
});

test("flags daily workload above the configured threshold", () => {
  const activities = Array.from({ length: 9 }, (_, index) => ({
    kind: "tarefa" as const,
    id: `task-${index}`,
    scheduledAt: `2026-07-28T${String(index + 8).padStart(2, "0")}:00:00.000Z`,
    assignedUserId: "user-a",
  }));

  const result = analyzePlanningConflicts(activities);
  assert.equal(result.overloadedDayKeys.size, 1);
  assert.equal(result.conflictingItemIds.size, 0);
});

test("calculates realistic distances between Portuguese coordinates", () => {
  const distance = distanceInKm(
    { latitude: 38.7223, longitude: -9.1393 },
    { latitude: 38.7071, longitude: -9.1355 },
  );
  assert.ok(distance > 1.5 && distance < 2.5);
});

test("orders located visits using the nearest next stop", () => {
  const visits = [
    {
      id: "start",
      entidade: { latitude: "38.7223", longitude: "-9.1393" },
    },
    {
      id: "far",
      entidade: { latitude: "38.6916", longitude: "-9.2160" },
    },
    {
      id: "near",
      entidade: { latitude: "38.7071", longitude: "-9.1355" },
    },
  ];

  assert.deepEqual(
    orderVisitsByProximity(visits).map(({ id }) => id),
    ["start", "near", "far"],
  );
});

test("builds Google Maps search and directions URLs without invalid locations", () => {
  const single = buildGoogleMapsRouteUrl([
    {
      id: "one",
      entidade: { latitude: "38.7223", longitude: "-9.1393" },
    },
  ]);
  assert.match(single || "", /^https:\/\/www\.google\.com\/maps\/search/);

  const route = buildGoogleMapsRouteUrl([
    {
      id: "one",
      entidade: { latitude: "38.7223", longitude: "-9.1393" },
    },
    {
      id: "two",
      entidade: { latitude: "38.7071", longitude: "-9.1355" },
    },
  ]);
  assert.match(route || "", /^https:\/\/www\.google\.com\/maps\/dir/);
  assert.equal(
    buildGoogleMapsRouteUrl([
      { id: "invalid", entidade: { latitude: null, longitude: null } },
    ]),
    null,
  );
});
