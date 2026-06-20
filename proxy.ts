import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const GUEST_COOKIE_NAME = "sungrid_guest_user_id";

const isGuestAllowedApiRoute = createRouteMatcher(["/api/workspaces(.*)"]);

const isClerkProtectedRoute = createRouteMatcher([
  "/onboarding(.*)",
  "/api/workspaces(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const hasGuestCookie = Boolean(req.cookies.get(GUEST_COOKIE_NAME)?.value);

  if (hasGuestCookie && isGuestAllowedApiRoute(req)) {
    return;
  }

  if (isClerkProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};