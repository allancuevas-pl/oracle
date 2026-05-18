import { query } from "./_generated/server";
import { requireAuthenticatedUser } from "./authz";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireAuthenticatedUser(ctx);
    return user;
  },
});
