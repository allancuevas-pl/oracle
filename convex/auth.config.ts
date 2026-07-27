export default {
  providers: [
    {
      // Set CLERK_JWT_ISSUER_DOMAIN in the Convex dashboard to point at the
      // production Clerk instance. Falls back to the dev instance until then.
      domain:
        process.env.CLERK_JWT_ISSUER_DOMAIN ||
        "https://model-redbird-53.clerk.accounts.dev",
      applicationID: "convex",
    },
  ]
};
