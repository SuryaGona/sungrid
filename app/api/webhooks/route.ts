import { headers } from "next/headers";
import { Webhook } from "svix";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses?: {
      email_address: string;
      id: string;
    }[];
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
};

function getPrimaryEmail(data: ClerkUserEvent["data"]) {
  return (
    data.email_addresses?.find(
      (email) => email.id === data.primary_email_address_id,
    )?.email_address ??
    data.email_addresses?.[0]?.email_address ??
    null
  );
}

function getFullName(data: ClerkUserEvent["data"]) {
  return [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
}

async function syncUser(data: ClerkUserEvent["data"]) {
  const email = getPrimaryEmail(data);

  if (!email) {
    return new Response("Missing user email", { status: 400 });
  }

  const name = getFullName(data);
  const imageUrl = data.image_url ?? null;

  await prisma.$transaction(
    async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [
            {
              clerkId: data.id,
            },
            {
              email,
            },
          ],
        },
      });

      if (existingUser) {
        await tx.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            clerkId: data.id,
            email,
            name,
            imageUrl,
            isGuest: false,
          },
        });

        return;
      }

      await tx.user.create({
        data: {
          clerkId: data.id,
          email,
          name,
          imageUrl,
          isGuest: false,
        },
      });
    },
    {
      maxWait: 10_000,
      timeout: 20_000,
    },
  );

  return new Response("User synced", { status: 200 });
}

async function deleteUserData(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
    include: {
      memberships: {
        include: {
          workspace: {
            include: {
              memberships: {
                select: {
                  id: true,
                  userId: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return new Response("User already deleted", { status: 200 });
  }

  await prisma.$transaction(
    async (tx) => {
      for (const membership of user.memberships) {
        const otherMembers = membership.workspace.memberships.filter(
          (member) => member.userId !== user.id,
        );

        if (otherMembers.length === 0) {
          await tx.workspace.delete({
            where: {
              id: membership.workspaceId,
            },
          });

          continue;
        }

        if (membership.role === "OWNER") {
          const otherOwner = otherMembers.find(
            (member) => member.role === "OWNER",
          );

          if (!otherOwner) {
            const replacementOwner =
              otherMembers.find((member) => member.role === "ADMIN") ??
              otherMembers[0];

            await tx.membership.update({
              where: {
                id: replacementOwner.id,
              },
              data: {
                role: "OWNER",
              },
            });
          }
        }

        await tx.membership.delete({
          where: {
            id: membership.id,
          },
        });
      }

      await tx.user.delete({
        where: {
          id: user.id,
        },
      });
    },
    {
      maxWait: 10_000,
      timeout: 20_000,
    },
  );

  return new Response("User deleted", { status: 200 });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Missing webhook secret", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing webhook headers", { status: 400 });
  }

  const payload = await req.text();
  const webhook = new Webhook(webhookSecret);

  let event: ClerkUserEvent;

  try {
    event = webhook.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch (error) {
    console.error("Invalid Clerk webhook:", error);
    return new Response("Invalid webhook", { status: 400 });
  }

  try {
    if (event.type === "user.created" || event.type === "user.updated") {
      return await syncUser(event.data);
    }

    if (event.type === "user.deleted") {
      return await deleteUserData(event.data.id);
    }

    return new Response("Event ignored", { status: 200 });
  } catch (error) {
    console.error("Clerk webhook failed:", error);
    return new Response("Webhook failed", { status: 500 });
  }
}