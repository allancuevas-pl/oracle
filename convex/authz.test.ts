import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Setup mock data for tests
test("authz role-matrix test", async () => {
  const modules = import.meta.glob("./**/*.*s");
  const t = convexTest(schema, modules);
  
  // Create mock users
  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "client_id_1",
    email: "client@test.com",
    role: "client"
  });

  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "staff_id_1",
    email: "staff@test.com",
    role: "staff"
  });

  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "admin_id_1",
    email: "admin@test.com",
    role: "admin"
  });

  // Test 1: Unauthenticated user rejected
  await expect(t.query(api.settings.getSettings)).rejects.toThrow("Unauthenticated call");

  // Test 2: Authenticated user with no users row rejected
  const missingUserClient = t.withIdentity({ subject: "unknown_id_1" });
  await expect(missingUserClient.query(api.settings.getSettings)).rejects.toThrow("User record not found");

  // Test 3: Role: client rejected from every operational function
  const clientUser = t.withIdentity({ subject: "client_id_1" });
  await expect(clientUser.query(api.settings.getSettings)).rejects.toThrow("Unauthorized: Insufficient permissions");
  await expect(clientUser.query(api.briefs.getBriefs, {})).rejects.toThrow("Unauthorized: Insufficient permissions");

  // Test 4: Role: staff allowed
  const staffUser = t.withIdentity({ subject: "staff_id_1" });
  const settingsStaff = await staffUser.query(api.settings.getSettings);
  expect(settingsStaff).toBeDefined();

  // Test 5: Role: admin allowed
  const adminUser = t.withIdentity({ subject: "admin_id_1" });
  const settingsAdmin = await adminUser.query(api.settings.getSettings);
  expect(settingsAdmin).toBeDefined();
});
