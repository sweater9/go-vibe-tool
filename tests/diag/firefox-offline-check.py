"""Real-Firefox offline check: load, wait for the worker to control the page, STOP the origin server, then navigate to
deep links and confirm they render from the service-worker cache. Usage: firefox-offline-check.py <base-url> <server-pid>"""
import os, sys, time, signal
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
BASE, PID = sys.argv[1], int(sys.argv[2]); ENV = os.environ['FIREFOX_ENV']
o = Options(); o.binary_location = ENV + '/bin/firefox'; o.add_argument('-headless')
d = webdriver.Firefox(options=o, service=Service(ENV + '/bin/geckodriver'))
res = []
def check(name, cond): res.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name, flush=True)
try:
    d.get(BASE); d.execute_script('return navigator.serviceWorker.ready.then(() => 1)') if False else None
    d.execute_async_script("const done=arguments[arguments.length-1]; navigator.serviceWorker.ready.then(()=>done(1))")
    d.get(BASE + 'studios.html'); time.sleep(1)           # a controlled navigation caches what it loads
    d.get(BASE + '?tool=table-converter'); time.sleep(1)
    check('worker controls the page before going offline', d.execute_script('return !!navigator.serviceWorker.controller'))
    os.kill(PID, signal.SIGTERM); time.sleep(1)
    d.get(BASE + 'studios.html?studio=qr'); time.sleep(1)
    check('offline: studios.html?studio=qr renders its own document', d.execute_script("return !!document.querySelector('#studio-qr') && !document.querySelector('#studio-qr').hidden"))
    d.get(BASE + '?tool=table-converter'); time.sleep(1.5)
    check('offline: ?tool=table-converter opens the utility', 'able' in (d.execute_script("return document.querySelector('#workspace h2')?.textContent || ''")))
    d.get(BASE + '?tool=regex-playground'); time.sleep(1.5)
    check('offline: ?tool=regex-playground opens the utility', 'egex' in (d.execute_script("return document.querySelector('#workspace h2')?.textContent || ''")))
    check('offline: stylesheet applied (v8.css cached)', d.execute_script("return [...document.styleSheets].some(s => /v8\\.css/.test(s.href||'') && s.cssRules.length>0)"))
finally:
    d.quit()
bad = [n for n, c in res if not c]
print(f'RESULT: {len(res)-len(bad)} passed, {len(bad)} failed'); sys.exit(1 if bad else 0)
