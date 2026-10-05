import { expect, test } from "@playwright/test";

test("QR entry creates and persists exactly one stamp, then filters visits", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /가을의 조각을 모아/ }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.goto("/e/fall-festival/scan/demo-booth-1-token");
  await expect(page).toHaveURL("/e/fall-festival");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await expect(page.getByTestId("booth-demo-booth-1")).toContainText(
    "방문 완료",
  );
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await page.goto("/e/fall-festival/scan/demo-booth-1-token");
  await expect(page.getByRole("status")).toContainText("이미 모은 스탬프");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await page.getByRole("button", { name: "방문 완료", exact: true }).click();
  await expect(page.locator(".booth-card")).toHaveCount(1);
  await page.getByRole("button", { name: "미방문", exact: true }).click();
  await expect(page.locator(".booth-card")).toHaveCount(5);
});

test("first-ever visit can start at QR, unknown QR does not award a stamp", async ({
  page,
}) => {
  await page.goto("/e/fall-festival/scan/wrong-token");
  await expect(page.getByRole("alert")).toContainText(
    "유효하지 않거나 교체된 QR",
  );
  await page.getByRole("link", { name: "나의 스탬프북으로 돌아가기" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.goto("/e/fall-festival/scan/demo-booth-2-token");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
});

test("offline claim retains URL, and retry works after reconnecting", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /스탬프는 어떻게 모으나요/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("link", { name: /첫 부스 체험하기/ }).click();
  await expect(page.getByRole("alert")).toContainText("인터넷 연결");
  await expect(page).toHaveURL(/scan\/demo-booth-1-token/);
  await context.setOffline(false);
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
});

test("admin edits booths, generates downloadable QR, and invalidates old code", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "부스 추가", exact: true }).click();
  await page
    .getByRole("textbox", { name: "부스명", exact: true })
    .fill("테스트 부스");
  await page.getByRole("textbox", { name: "한 줄 소개" }).fill("테스트 체험");
  await page
    .getByRole("textbox", { name: "위치", exact: true })
    .fill("테스트존");
  await page.getByRole("button", { name: "부스 저장" }).click();
  await expect(
    page.getByRole("heading", { name: "테스트 부스" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "테스트 부스 QR", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "테스트 부스 방문 QR코드" }),
  ).toBeVisible();
  const oldUrl = await page
    .getByRole("link", { name: "QR 링크 확인" })
    .getAttribute("href");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "QR 다운로드" }).click();
  expect((await downloadPromise).suggestedFilename()).toContain(".png");
  await page.getByRole("button", { name: "QR 재발급", exact: true }).click();
  await page.getByRole("button", { name: "QR 교체하기" }).click();
  await expect(
    page.getByRole("link", { name: "QR 링크 확인" }),
  ).not.toHaveAttribute("href", oldUrl!);
  await page.getByRole("button", { name: "닫기" }).click();
  await page.getByRole("link", { name: /인쇄/, exact: false }).click();
  await expect(page.locator(".print-card")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "인쇄하기" })).toBeEnabled();
  await page.goto(oldUrl!);
  await expect(page.getByRole("alert")).toContainText("교체된 QR");
});

test("inactive booth is excluded from progress and prevents new claims", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "커피 한 모금 수정" }).click();
  await page.getByRole("checkbox", { name: "운영 중인 부스로 표시" }).uncheck();
  await page.getByRole("button", { name: "부스 저장" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/e/fall-festival/scan/demo-booth-1-token");
  await expect(page.getByRole("alert")).toContainText("운영하지 않는 부스");
  await page.goto("/");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "5",
  );
});

test("all booths complete the passport and layout stays within viewport", async ({
  page,
}) => {
  for (let i = 1; i <= 6; i++) {
    await page.goto(`/e/fall-festival/scan/demo-booth-${i}-token`);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(i),
    );
  }
  await expect(
    page.getByRole("heading", { name: "모든 순간을 모았어요!" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("scan in another tab refreshes the original passport", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  const scanner = await context.newPage();
  await scanner.goto("/e/fall-festival/scan/demo-booth-3-token");
  await expect(scanner.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await page.bringToFront();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
});
