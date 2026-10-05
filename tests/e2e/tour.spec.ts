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
    if (i < 6)
      await expect(
        page.getByRole("status", { name: "모든 부스 방문 완료 도장" }),
      ).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "모든 순간을 모았어요!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "모든 부스 방문 완료 도장" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("status", { name: "모든 부스 방문 완료 도장" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  const overlapsFour = await page.evaluate(() => {
    const seal = document
      .querySelector(".completion-stamp")!
      .getBoundingClientRect();
    return [...document.querySelectorAll(".booth-card")]
      .slice(0, 4)
      .every((card) => {
        const rect = card.getBoundingClientRect();
        return (
          seal.left < rect.right &&
          seal.right > rect.left &&
          seal.top < rect.bottom &&
          seal.bottom > rect.top
        );
      });
  });
  expect(overlapsFour).toBe(true);
  await page.getByRole("button", { name: "미방문", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "모든 부스 방문 완료 도장" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "전체", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("deletion requires confirmation and removes booth QR and collected stamp", async ({
  page,
}) => {
  await page.goto("/e/fall-festival/scan/demo-booth-1-token");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: "커피 한 모금 삭제" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "참가자 방문 기록도 함께 삭제",
  );
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "커피 한 모금 수정" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "커피 한 모금 삭제" }).click();
  await page.getByRole("button", { name: "부스 삭제하기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".admin-booth-row")).toHaveCount(5);
  await page.goto("/e/fall-festival/scan/demo-booth-1-token");
  await expect(page.getByRole("alert")).toContainText(
    "유효하지 않거나 교체된 QR",
  );
  await page.goto("/");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "5",
  );
});

test("bulk generation fills missing active QRs and preserves existing printed tokens", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page.locator(".admin-booth-row")).toHaveCount(6);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("moa-demo-v1")!);
    state.qrCodes = state.qrCodes.filter(
      (q: { booth_id: string }) =>
        !["demo-booth-2", "demo-booth-3"].includes(q.booth_id),
    );
    state.booths[2].is_active = false;
    localStorage.setItem("moa-demo-v1", JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("button", { name: "부스별 QR 일괄 생성" }).click();
  await expect(page.getByRole("status")).toContainText("1개 부스의 QR");
  await page.getByRole("button", { name: "부스별 QR 일괄 생성" }).click();
  await expect(page.getByRole("status")).toContainText(
    "모든 운영 부스에 QR이 준비",
  );
  await page
    .getByRole("button", { name: "커피 한 모금 QR", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "QR 링크 확인" }),
  ).toHaveAttribute("href", /\/scan\/demo-booth-1-token$/);
  await page.getByRole("link", { name: "이 부스 QR 인쇄" }).click();
  await expect(page.locator(".print-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "인쇄하기" })).toBeEnabled();
  await page.goto("/admin/print/fall-festival");
  await expect(page.locator(".print-card")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "인쇄하기" })).toBeEnabled();
});

test("site QR points at the public domain and has a separate printable poster", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "사이트 접속 QR" }).click();
  await expect(
    page.getByRole("img", { name: "boryeongculture.site 접속 QR코드" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "사이트 링크 확인" }),
  ).toHaveAttribute("href", "https://boryeongculture.site");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "QR 다운로드" }).click();
  expect((await download).suggestedFilename()).toBe(
    "boryeongculture-site-qr.png",
  );
  await page.getByRole("link", { name: "사이트 QR 인쇄" }).click();
  await expect(page.locator(".print-card")).toHaveCount(1);
  await expect(page.locator(".print-card")).toContainText(
    "https://boryeongculture.site",
  );
  await expect(page.getByRole("button", { name: "인쇄하기" })).toBeEnabled();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-toolbar")).toBeHidden();
  await expect(
    page.getByRole("img", { name: "boryeongculture.site 접속 QR" }),
  ).toBeVisible();
});

test("thumbnail upload converts PNG to bounded WebP, survives edits and can be removed", async ({
  page,
}) => {
  await page.goto("/admin");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#b8860b";
    ctx.fillRect(0, 0, 1200, 800);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByRole("button", { name: "커피 한 모금 수정" }).click();
  await page
    .getByLabel("썸네일 사진")
    .setInputFiles({
      name: "booth.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(
    page.getByRole("img", { name: "썸네일 미리보기" }),
  ).toHaveAttribute("src", /^data:image\/webp;base64,/);
  const dimensions = await page
    .getByRole("img", { name: "썸네일 미리보기" })
    .evaluate((image: HTMLImageElement) => [
      image.naturalWidth,
      image.naturalHeight,
    ]);
  expect(dimensions[0]).toBe(512);
  expect(dimensions[1]).toBeLessThanOrEqual(512);
  await page.getByRole("button", { name: "부스 저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "커피 한 모금 수정" }).click();
  await page
    .getByRole("textbox", { name: "한 줄 소개" })
    .fill("사진을 올린 부스");
  await page.getByRole("button", { name: "부스 저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "커피 한 모금 썸네일" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("img", { name: "커피 한 모금 썸네일" }),
  ).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "커피 한 모금 수정" }).click();
  await page.getByRole("button", { name: "사진 제거" }).click();
  await page.getByRole("button", { name: "부스 저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "커피 한 모금 썸네일" }),
  ).toHaveCount(0);
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
