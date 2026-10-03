"""Capture slide-ready screenshots of the real app using the validated profile-B run.

Injects the stored AnalyzeResponse (real model output) into sessionStorage so the
/result page renders the exact analysis that was verified earlier.
Viewports are sized to match the target slide regions (no stretch, no crop).
"""
import json
import os

from playwright.sync_api import sync_playwright

SRC = r"C:\Users\HANMANTH\AppData\Local\Temp\opencode\analyze_b.json"
OUT = r"C:\Users\HANMANTH\AppData\Local\Temp\opencode\pitch_shots"
BASE = "http://localhost:3000"

os.makedirs(OUT, exist_ok=True)

raw = open(SRC, "rb").read().decode("utf-8-sig")
payload = json.dumps(json.loads(raw))
profile = json.loads(raw)["profile"]
print(
    "profile:",
    profile["branch"],
    profile["year"],
    profile["availableWeeks"],
    "weeks ->",
    json.loads(raw)["analysis"]["primary"]["title"],
)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1612, "height": 800})
    page.goto(BASE, wait_until="domcontentloaded")
    page.evaluate(
        "(v) => sessionStorage.setItem('projectsforge:run:v1', v)", payload
    )
    page.goto(f"{BASE}/result", wait_until="networkidle")
    page.wait_for_timeout(700)
    assert page.locator("text=Primary recommendation").count() > 0, "no result"

    def clean_shot(path: str) -> None:
        # Drop the Next.js dev-tools badge (fixed overlay) before capturing.
        page.evaluate(
            "() => document.querySelectorAll('nextjs-portal')"
            ".forEach((el) => el.remove())"
        )
        page.wait_for_timeout(100)
        page.screenshot(path=path)

    # Slide 7 region: 11.77 x ~5.87 in -> 1612x800 (aspect 2.015)
    clean_shot(os.path.join(OUT, "s7_recommendation.png"))
    print("shot s7_recommendation.png", page.viewport_size)

    # Slides 8/9 region: 17.71 x 7.49 in -> 1902x800 (aspect 2.3775)
    page.set_viewport_size({"width": 1902, "height": 800})
    page.click("button:has-text('Skill Gap')")
    page.wait_for_timeout(500)
    clean_shot(os.path.join(OUT, "s8_skillgap.png"))
    print("shot s8_skillgap.png", page.viewport_size)

    page.click("button:has-text('Roadmap')")
    page.wait_for_timeout(500)
    clean_shot(os.path.join(OUT, "s9_roadmap.png"))
    print("shot s9_roadmap.png", page.viewport_size)

    browser.close()

for name in sorted(os.listdir(OUT)):
    if name.endswith(".png"):
        print(name, os.path.getsize(os.path.join(OUT, name)), "bytes")
