import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

async function startGuestDemo(page: Page) {
  await page.goto("/demo/start");

  await expect(page).toHaveURL(/\/dashboard\/[^/?#]+$/);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Guest Demo Workspace",
    }),
  ).toBeVisible();
}

function getBoardColumn(page: Page, name: string): Locator {
  const heading = page.getByRole("heading", {
    level: 3,
    name,
  });

  return heading.locator("xpath=../../..");
}

test.describe("guest demo", () => {
  test("creates a guest workspace and opens the seeded dashboard", async ({
    page,
  }) => {
    await startGuestDemo(page);

    await expect(
      page.getByText(
        "This guest workspace includes sample projects, issues, sprints, and activity so you can explore SunGrid without setting up an account.",
      ),
    ).toBeVisible();

    await expect(
      page.getByText("Active projects", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("navigates from projects to the seeded project board", async ({
    page,
  }) => {
    await startGuestDemo(page);

    const workspaceId = new URL(page.url()).pathname.split("/")[2];

    expect(workspaceId).toBeTruthy();

    await page.goto(`/dashboard/${workspaceId}/projects`);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Guest Demo Workspace projects",
      }),
    ).toBeVisible();

    const productLaunchCard = page
      .locator("article")
      .filter({
        hasText: "Product Launch",
      })
      .first();

    await expect(productLaunchCard).toBeVisible();

    await productLaunchCard
      .getByRole("link", {
        name: "Open board",
      })
      .click();

    await expect(page).toHaveURL(
      new RegExp(
        `/dashboard/${workspaceId}/projects/[^/?#]+/board$`,
      ),
    );

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Product Launch",
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Current active issues",
      }),
    ).toBeVisible();

    await expect(
      page.getByText("Finalize launch checklist", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("moves an issue on the board and persists the new status after reload", async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 1600,
      height: 1000,
    });

    await startGuestDemo(page);

    const workspaceId = new URL(page.url()).pathname.split("/")[2];

    expect(workspaceId).toBeTruthy();

    await page.goto(`/dashboard/${workspaceId}/projects`);

    const productLaunchCard = page
      .locator("article")
      .filter({
        hasText: "Product Launch",
      })
      .first();

    await expect(productLaunchCard).toBeVisible();

    await productLaunchCard
      .getByRole("link", {
        name: "Open board",
      })
      .click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Product Launch",
      }),
    ).toBeVisible();

    const issueLink = page.getByText(
      "Finalize launch checklist",
      {
        exact: true,
      },
    );

    await expect(issueLink).toBeVisible();

    const sourceCard = issueLink.locator("..");

    const dragHandle = sourceCard.getByRole("button", {
      name: "Drag issue",
    });

    await expect(dragHandle).toBeVisible();

    const doneColumn = getBoardColumn(page, "Done");

    await expect(doneColumn).toBeVisible();

    const emptyDoneDropTarget = doneColumn.getByText(
      "Drop issues here.",
      {
        exact: true,
      },
    );

    await expect(emptyDoneDropTarget).toBeVisible();

    const dragBox = await dragHandle.boundingBox();
    const targetBox = await emptyDoneDropTarget.boundingBox();

    expect(dragBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    if (!dragBox || !targetBox) {
      throw new Error(
        "Could not calculate drag-and-drop element positions.",
      );
    }

    const moveResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/issues/move"),
    );

    const startX = dragBox.x + dragBox.width / 2;
    const startY = dragBox.y + dragBox.height / 2;

    const targetX = targetBox.x + targetBox.width / 2;
    const targetY = targetBox.y + targetBox.height / 2;

    await page.mouse.move(startX, startY);

    await page.mouse.down();

    await page.mouse.move(startX + 12, startY, {
      steps: 3,
    });

    await page.mouse.move(targetX, targetY, {
      steps: 20,
    });

    await page.mouse.up();

    const moveResponse = await moveResponsePromise;

    expect(moveResponse.status()).toBe(200);

    await expect(
      page.getByText("Issue moved successfully.", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      doneColumn.getByText("Finalize launch checklist", {
        exact: true,
      }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Product Launch",
      }),
    ).toBeVisible();

    const persistedDoneColumn = getBoardColumn(page, "Done");

    await expect(
      persistedDoneColumn.getByText(
        "Finalize launch checklist",
        {
          exact: true,
        },
      ),
    ).toBeVisible();

    const inProgressColumn = getBoardColumn(
      page,
      "In Progress",
    );

    await expect(
      inProgressColumn.getByText(
        "Finalize launch checklist",
        {
          exact: true,
        },
      ),
    ).toHaveCount(0);
  });
});