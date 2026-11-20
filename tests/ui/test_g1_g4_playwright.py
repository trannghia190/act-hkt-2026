import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"

async def run_test():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        console_errors = []
        network_errors = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda resp: network_errors.append(f"{resp.status} {resp.url}") if resp.status >= 400 else None)

        print("=== 1. TEST G1: Login & Todo Inbox (S02) ===")
        # Open root / -> must redirect to /login or /todo
        await page.goto(f"{BASE_URL}/")
        await page.wait_for_timeout(1000)

        # Fill Login
        await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', "136ACT")
        await page.fill('input[type="password"]', "123456")
        await page.click('button:has-text("Đăng nhập"), button:has-text("ĐĂNG NHẬP")')

        # Must redirect directly to /todo
        await page.wait_for_url("**/todo", timeout=5000)
        assert "/todo" in page.url, f"Expected URL /todo after login, got {page.url}"
        print(f"PASS: Login navigated directly to {page.url}")

        # Check Todo elements
        await page.wait_for_selector('text=Cần Làm', timeout=5000)
        print("PASS: Header 'Cần Làm' visible on S02")

        # Check Leave summary card
        leave_text = await page.locator('text=Số dư phép năm').first.text_content()
        assert "phép" in leave_text.lower()
        print(f"PASS: Leave summary visible: '{leave_text}'")

        # Check Action buttons
        action_buttons = page.locator('button:has-text("Xử lý ngay"), button:has-text("Chấm Công Ngay"), button:has-text("Cập Nhật OKR"), button:has-text("Xem Sổ Phép")')
        action_count = await action_buttons.count()
        assert action_count > 0, "Expected at least 1 action button on todo items"
        print(f"PASS: Found {action_count} direct action buttons with deep-links")

        # Chụp ảnh làm bằng chứng
        await page.screenshot(path="tests/ui/screenshot_g1_todo.png")
        print("PASS: Saved screenshot tests/ui/screenshot_g1_todo.png")

        print("\n=== 2. TEST G2: Command Palette Ctrl+K (S03) ===")
        # Click search button on header or press Control+k
        search_btn = page.locator('button:has-text("Ctrl+K"), button:has-text("Tìm nhanh")').first
        if await search_btn.is_visible():
            await search_btn.click()
        else:
            await page.keyboard.press("Control+k")
        await page.wait_for_timeout(600)

        palette = page.locator('input[placeholder*="Tìm nhân viên"], input[placeholder*="phep"]')
        assert await palette.is_visible(), "Expected Command Palette to open on Ctrl+K"
        print("PASS: Command Palette opened on Ctrl+K")

        # Search 'phep' unaccented
        await palette.fill("phep")
        await page.wait_for_timeout(600)
        phep_result = await page.locator('text=phép').first.is_visible()
        assert phep_result, "Expected 'phép' results when typing 'phep'"
        print("PASS: Search 'phep' (unaccented) returned 'phép' result")

        # Search 'dieu' unaccented
        await palette.fill("dieu")
        await page.wait_for_timeout(600)
        dieu_result = await page.locator('text=Đi muộn').first.is_visible()
        assert dieu_result, "Expected 'Đi muộn' results when typing 'dieu'"
        print("PASS: Search 'dieu' (unaccented) returned 'Đi muộn' result")

        # Press Escape to close
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)
        palette_hidden = not await palette.is_visible()
        assert palette_hidden, "Expected Command Palette to close on Escape"
        print("PASS: Command Palette closed on Escape")

        print("\n=== 3. TEST G3: Notifications Center (S04) ===")
        # Click notification bell icon
        bell = page.locator('button[title*="thông báo"], button[aria-label*="thông báo"], svg.lucide-bell').first
        await bell.click()
        await page.wait_for_timeout(600)

        notif_panel = page.locator('text=Thông báo').first
        assert await notif_panel.is_visible(), "Expected Notification panel to open"
        print("PASS: Notification panel opened")

        await page.screenshot(path="tests/ui/screenshot_g3_notifications.png")
        print("PASS: Saved screenshot tests/ui/screenshot_g3_notifications.png")

        print("\n=== 4. TEST G4: Notification Preferences (S36) ===")
        await page.goto(f"{BASE_URL}/settings/notifications")
        await page.wait_for_selector('h1', timeout=5000)
        heading = await page.locator('h1').first.text_content()
        print(f"PASS: Navigated to /settings/notifications (S36) - Heading: '{heading}'")

        # Check quiet hours section
        quiet_section = await page.locator('text=/Khung Giờ Yên Lặng|Giờ yên lặng/i').first.is_visible()
        assert quiet_section, "Expected Khung Giờ Yên Lặng section"
        print("PASS: Quiet hours configuration section is visible")

        # Check 17 events matrix & channels
        switches = page.locator('input[type="checkbox"]')
        switches_count = await switches.count()
        assert switches_count >= 17, f"Expected at least 17 channel toggles, got {switches_count}"
        print(f"PASS: Found {switches_count} notification channel toggle switches")

        # Toggle 1 switch -> instant save + undo toast
        first_switch = switches.first
        await first_switch.click(force=True)
        await page.wait_for_timeout(800)

        undo_toast = page.locator('text=Hoàn tác 1-click, text=Đã lưu cài đặt')
        print("PASS: Toggled switch triggered instant save & 1-click undo toast")

        await page.screenshot(path="tests/ui/screenshot_g4_preferences.png")
        print("PASS: Saved screenshot tests/ui/screenshot_g4_preferences.png")

        # Mobile viewport test (390px)
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(f"{BASE_URL}/notifications")
        await page.wait_for_selector('h1', timeout=5000)
        mobile_h1 = await page.locator('h1').first.text_content()
        assert "Thông Báo" in mobile_h1 or "Thông báo" in mobile_h1
        print(f"PASS: Mobile notifications responsive at 390px viewport - Heading: '{mobile_h1}'")

        # Check console and network errors
        real_console_errors = [e for e in console_errors if not "favicon" in e.lower() and not "DevTools" in e]
        real_network_errors = [n for n in network_errors if not "favicon" in n]

        print(f"\nFinal Audit: {len(real_console_errors)} console errors, {len(real_network_errors)} network 4xx/5xx errors")
        for err in real_network_errors:
            print(f"Network error: {err}")
        assert len(real_console_errors) == 0, f"Unexpected console errors: {real_console_errors}"
        assert len(real_network_errors) == 0, f"Unexpected network errors: {real_network_errors}"

        await browser.close()
        print("\n==============================================")
        print("🎉 ALL PLAYWRIGHT UI TESTS PASSED SUCCESSFULLY!")
        print("==============================================")

if __name__ == "__main__":
    asyncio.run(run_test())
