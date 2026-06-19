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
  const primaryEmail = data.email_addresses?.find(
    (email) => email.id === data.primary_email_address_id,
  )?.email_address;

  return primaryEmail || data.email_addresses?.[0]?.email_address || null;
}

function getFullName(data: ClerkUserEvent["data"]) {
  return [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
}

async function syncUser(data: ClerkUserEvent["data"]) {
  const primaryEmail = getPrimaryEmail(data);

  if (!primaryEmail) {
    return new Response("Missing user email", { status: 400 });
  }

  await prisma.user.upsert({
    where: {
      clerkId: data.id,
    },
    update: {
      email: primaryEmail,
      name: getFullName(data),
      imageUrl: data.image_url ?? null,
    },
    create: {
      clerkId: data.id,
      email: primaryEmail,
      name: getFullName(data),
      imageUrl: data.image_url ?? null,
    },
  });

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

  await prisma.$transaction(async (tx) => {
    for (const membership of user.memberships) {
      const workspace = membership.workspace;
      const workspaceMembers = workspace.memberships;
      const otherMembers = workspaceMembers.filter(
        (member) => member.userId !== user.id,
      );

      const isOnlyMember = otherMembers.length === 0;

      if (isOnlyMember) {
        await tx.workspace.delete({
          where: {
            id: workspace.id,
          },
        });

        continue;
      }

      if (membership.role === "OWNER") {
        const existingOtherOwner = otherMembers.find(
          (member) => member.role === "OWNER",
        );

        if (!existingOtherOwner) {
          const adminToPromote = otherMembers.find(
            (member) => member.role === "ADMIN",
          );

          const memberToPromote = adminToPromote || otherMembers[0];

          if (memberToPromote) {
            await tx.membership.update({
              where: {
                id: memberToPromote.id,
              },
              data: {
                role: "OWNER",
              },
            });
          }
        }
      }

      await tx.membership.deleteMany({
        where: {
          id: membership.id,
        },
      });
    }

    await tx.user.deleteMany({
      where: {
        id: user.id,
      },
    });
  });

  return new Response("User deleted and workspace data cleaned", {
    status: 200,
  });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const headerPayload = await headers();

  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
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
    console.error("Invalid Clerk webhook signature:", error);
    return new Response("Invalid webhook signature", { status: 400 });
  }

  try {
    if (event.type === "user.created" || event.type === "user.updated") {
      return await syncUser(event.data);
    }

    if (event.type === "user.deleted") {
      return await deleteUserData(event.data.id);
    }

    return new Response("Unhandled event", { status: 200 });
  } catch (error) {
    console.error("Clerk webhook failed:", error);
    return new Response("Webhook handler failed", { status: 500 });
  }
}