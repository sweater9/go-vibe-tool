"""Local Firefox reproduction of the intermittent studio interaction failures seen in CI on a fresh profile
(Freelance tab click lost / Analyze click ignored). Replays: home -> footer link -> back home -> studios.html -> URL studio -> Freelance tab."""
import os, sys, time, json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
BASE = sys.argv[1]; RUNS = int(sys.argv[2]); ENV = os.environ['FIREFOX_ENV']
def run():
    o = Options(); o.binary_location = ENV + '/bin/firefox'; o.add_argument('-headless')
    d = webdriver.Firefox(options=o, service=Service(ENV + '/bin/geckodriver')); out = {}
    try:
        PRE = ['', '?category=ai-prompts', '?category=productivity', '?category=files-pdf', '?category=images-design', '?category=privacy-security', '?category=developer',
               '?category=business-finance', '?category=writing-text', '?category=links-web', '', '?tool=curl-snippets', '?tool=key-hash', '?tool=regex-playground', '?tool=tailwind-css',
               '?tool=shadow-glass', '?tool=svg-sanitizer', '?tool=image-metadata-stripper', '?tool=image-batch-compressor', '?tool=table-converter', '?tool=url-cleaner', '?tool=url-inspector',
               '?tool=utm-builder', '?tool=tracking-check', '?tool=link-fingerprint', '?tool=hourly-rate', '?tool=qr-payload', '?tool=metadata', '?tool=qr-studio', '?tool=pii-secret-redactor', '?tool=percentage-change']
        for u in PRE: d.get(BASE + u)
        d.get(BASE); d.find_element(By.CSS_SELECTOR, 'footer a[href="studios.html"]').click(); time.sleep(0.3)
        d.find_element(By.CSS_SELECTOR, 'a[href="./"]').click(); time.sleep(0.3)
        d.get(BASE + 'studios.html')
        u = d.find_element(By.ID, 'urlInput'); u.clear(); u.send_keys('https://example.com/a?utm_source=x'); d.find_element(By.ID, 'urlAnalyze').click()
        out['url_result'] = d.find_element(By.ID, 'urlResult').text[:30]
        d.find_element(By.CSS_SELECTOR, '[data-studio="freelance"]').click()
        out['tab_selected'] = d.find_element(By.CSS_SELECTOR, '[data-studio="freelance"]').get_attribute('aria-selected')
        out['target_visible'] = d.find_element(By.ID, 'target').is_displayed()
        if out['target_visible']:
            d.find_element(By.ID, 'calcRate').click(); out['rate'] = d.find_element(By.ID, 'rateResult').text[:40]
        out['handlers'] = d.execute_script("return typeof GVTStudioUI + ' ' + document.querySelectorAll('[data-studio]').length")
    finally:
        d.quit()
    return out
bad = 0
for i in range(RUNS):
    r = run(); fail = (not r.get('url_result', '').startswith('Scheme')) or r.get('tab_selected') != 'true' or not r.get('target_visible') or not r.get('rate', '').startswith('Estimated')
    bad += fail; print(f'run {i+1}: {"FAIL" if fail else "ok"} {json.dumps(r)}', flush=True)
print(f'RESULT: {bad} of {RUNS} runs failed')
