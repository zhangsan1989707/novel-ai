from playwright.sync_api import sync_playwright
import os

BASE_URL = "http://localhost:3200"
RECON_DIR = "/tmp/novel-ai-recon"
os.makedirs(RECON_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Recon 1: Projects page - navigation structure
    page.goto(f"{BASE_URL}/projects")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.screenshot(path=f"{RECON_DIR}/projects.png", full_page=True)

    nav_links = page.locator("nav a, nav button, header a, header button").all()
    print("=== NAV ELEMENTS ===")
    for link in nav_links:
        try:
            text = link.text_content(timeout=1000).strip()
            href = link.get_attribute("href", timeout=1000) or ""
            tag = link.evaluate("el => el.tagName", timeout=1000)
            print(f"  {tag} text='{text}' href='{href}'")
        except Exception:
            pass

    # Recon 2: New project page
    page.goto(f"{BASE_URL}/projects/new")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.screenshot(path=f"{RECON_DIR}/new-project.png", full_page=True)

    inputs = page.locator("input, textarea, select, button[role='combobox']").all()
    print("\n=== NEW PROJECT FORM ELEMENTS ===")
    for inp in inputs:
        try:
            tag = inp.evaluate("el => el.tagName", timeout=1000)
            input_type = inp.get_attribute("type", timeout=1000) or ""
            placeholder = inp.get_attribute("placeholder", timeout=1000) or ""
            name = inp.get_attribute("name", timeout=1000) or ""
            id_attr = inp.get_attribute("id", timeout=1000) or ""
            label = inp.get_attribute("aria-label", timeout=1000) or ""
            print(f"  {tag} type='{input_type}' name='{name}' id='{id_attr}' placeholder='{placeholder}' aria-label='{label}'")
        except Exception:
            pass

    buttons = page.locator("button").all()
    print("\n=== NEW PROJECT BUTTONS ===")
    for btn in buttons:
        try:
            text = btn.text_content(timeout=1000).strip()
            print(f"  button: '{text}'")
        except Exception:
            pass

    # Recon 3: Settings page
    page.goto(f"{BASE_URL}/settings")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.screenshot(path=f"{RECON_DIR}/settings.png", full_page=True)

    tabs = page.locator("[role='tab'], button[class*='tab']").all()
    print("\n=== SETTINGS TABS ===")
    for tab in tabs:
        try:
            text = tab.text_content(timeout=1000).strip()
            print(f"  tab: '{text}'")
        except Exception:
            pass

    buttons = page.locator("button").all()
    print("\n=== SETTINGS BUTTONS ===")
    for btn in buttons:
        try:
            text = btn.text_content(timeout=1000).strip()[:50]
            if text:
                print(f"  button: '{text}'")
        except Exception:
            pass

    # Recon 4: Cost page
    page.goto(f"{BASE_URL}/cost")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.screenshot(path=f"{RECON_DIR}/cost.png", full_page=True)

    buttons = page.locator("button").all()
    print("\n=== COST PAGE BUTTONS ===")
    for btn in buttons:
        try:
            text = btn.text_content(timeout=1000).strip()[:50]
            if text:
                print(f"  button: '{text}'")
        except Exception:
            pass

    # Recon 5: Market page
    page.goto(f"{BASE_URL}/market")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.screenshot(path=f"{RECON_DIR}/market.png", full_page=True)

    buttons = page.locator("button").all()
    print("\n=== MARKET PAGE BUTTONS ===")
    for btn in buttons:
        try:
            text = btn.text_content(timeout=1000).strip()[:50]
            if text:
                print(f"  button: '{text}'")
        except Exception:
            pass

    # Recon 6: Project detail page (if we have a project)
    page.goto(f"{BASE_URL}/projects")
    page.wait_for_load_state("networkidle", timeout=15000)
    project_links = page.locator("a[href*='/projects/']").all()
    print(f"\n=== PROJECT LINKS ({len(project_links)}) ===")
    for link in project_links[:5]:
        try:
            href = link.get_attribute("href", timeout=1000) or ""
            text = link.text_content(timeout=1000).strip()[:50]
            print(f"  a: href='{href}' text='{text}'")
        except Exception:
            pass

    if len(project_links) > 0:
        first_project_href = project_links[0].get_attribute("href", timeout=3000)
        if first_project_href:
            page.goto(f"{BASE_URL}{first_project_href}")
            page.wait_for_load_state("networkidle", timeout=15000)
            page.screenshot(path=f"{RECON_DIR}/project-detail.png", full_page=True)

            buttons = page.locator("button").all()
            print("\n=== PROJECT DETAIL BUTTONS ===")
            for btn in buttons:
                try:
                    text = btn.text_content(timeout=1000).strip()[:50]
                    if text:
                        print(f"  button: '{text}'")
                except Exception:
                    pass

    browser.close()
    print("\n✅ Reconnaissance complete!")
