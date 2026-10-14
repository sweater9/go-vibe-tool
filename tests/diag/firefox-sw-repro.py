"""Local Firefox (geckodriver/Marionette) reproduction of the intermittent
"A ServiceWorker intercepted the request and encountered an unexpected error" console error.
Listens on Services.console in chrome context (sees browser-level messages) while replaying rapid navigations
on a fresh profile. Usage: firefox-sw-repro.py <base-url> <runs> [pause-seconds-between-gets]"""
import os, sys, time, json
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

BASE = sys.argv[1]; RUNS = int(sys.argv[2]); PAUSE = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
SETTLE = os.environ.get('SETTLE') == '1'  # wait until every <link rel=stylesheet> has loaded before navigating on
ENV = os.environ["FIREFOX_ENV"]
URLS = ['', '?category=ai-prompts', '?category=productivity', '?category=files-pdf', '?category=images-design', '?category=privacy-security',
        '?category=developer', '?category=business-finance', '?category=writing-text', '?category=links-web', '',
        '?tool=curl-snippets', '?tool=key-hash', '?tool=regex-playground', '?tool=tailwind-css', '?tool=shadow-glass', '?tool=svg-sanitizer',
        '?tool=image-metadata-stripper', '?tool=image-batch-compressor', '?tool=table-converter', '?tool=url-cleaner', '?tool=utm-builder',
        'studios.html', 'studios.html?studio=freelance', 'studios.html?studio=qr']
LISTENER = """
const w = Services.wm.getMostRecentWindow('navigator:browser');
w.__gvt = w.__gvt || [];
if (!w.__gvtL) { w.__gvtL = { observe(m) { try { w.__gvt.push(m.message); } catch (e) {} }, QueryInterface: ChromeUtils.generateQI(['nsIConsoleListener']) }; Services.console.registerListener(w.__gvtL); }
return true;"""
READ = "const w = Services.wm.getMostRecentWindow('navigator:browser'); return w.__gvt || [];"

def one(i):
    opts = Options(); opts.binary_location = ENV + '/bin/firefox'; opts.add_argument('-headless'); opts.set_preference('marionette.allowSystemAccess', True)
    drv = webdriver.Firefox(options=opts, service=Service(ENV + '/bin/geckodriver'))
    try:
        drv.set_context('chrome'); drv.execute_script(LISTENER); drv.set_context('content')
        for u in URLS:
            drv.get(BASE + u)
            if PAUSE: time.sleep(PAUSE)
            if SETTLE:
                drv.execute_async_script("""const done = arguments[arguments.length - 1];
                  const t0 = Date.now(), ok = () => document.readyState === 'complete' && [...document.querySelectorAll('link[rel=stylesheet]')].every(l => l.sheet);
                  (function poll() { if (ok() || Date.now() - t0 > 3000) done(true); else setTimeout(poll, 20); })();""")
        time.sleep(1.5)
        drv.set_context('chrome'); msgs = drv.execute_script(READ); drv.set_context('content')
        return [m for m in msgs if 'ServiceWorker' in m or 'unexpected error' in m]
    finally:
        drv.quit()

bad = 0
for i in range(RUNS):
    hits = one(i)
    if hits: bad += 1
    print(f'run {i+1}: {len(hits)} sw errors', ('| ' + ' | '.join(h[:140].replace("\n"," ") for h in hits[:3])) if hits else '', flush=True)
print(f'RESULT: {bad} of {RUNS} runs had the error (pause={PAUSE}s)')
