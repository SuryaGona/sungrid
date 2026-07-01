import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { unauthorized } from "@/lib/errors";

export async function requireUser() {
  const { userId } = await auth();

  if (!userId) {
    throw unauthorized();
  }

  return userId;
}

export async function getCurrentDbUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw unauthorized();
  }

  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!primaryEmail) {
    throw new Error("Authenticated user is missing a primary email.");
  }

  const name = [clerkUser.firstName, clerkUser.lastName]
    .filter(Boolean)
    .join(" ");

  const user = await prisma.user.upsert({
    where: {
      clerkId: clerkUser.id,
    },
    update: {
      email: primaryEmail,
      name: name || null,
      imageUrl: clerkUser.imageUrl ?? null,
    },
    create: {
      clerkId: clerkUser.id,
      email: primaryEmail,
      name: name || null,
      imageUrl: clerkUser.imageUrl ?? null,
    },
  });

  return user;
}