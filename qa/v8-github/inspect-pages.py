import json,os,urllib.request,urllib.error,pathlib
repo=os.environ['GITHUB_REPOSITORY']
headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
def get(path):
 try:
  with urllib.request.urlopen(urllib.request.Request('https://api.github.com/'+path,headers=headers),timeout=20) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
status,metadata=get('repos/'+repo)
if status!=200:raise RuntimeError('Repository inspection failed: '+str(status))
code,pages=get('repos/'+repo+'/pages')
report={'repository':repo,'private':metadata['private'],'has_pages':metadata['has_pages'],'default_branch':metadata['default_branch'],'pages_read_status':code,'pages':{k:pages.get(k) for k in ['html_url','cname','build_type','source','public']},'pages_message':pages.get('message'),'private_pages_required_plans':['GitHub Pro','GitHub Team','GitHub Enterprise'],'owner_plan_verified':False,'isolated_native_pr_preview_available':False,'mutations_performed':False}
pathlib.Path('inspection').mkdir(exist_ok=True)
pathlib.Path('inspection/pages.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:
 f.write('## Read-only GitHub Pages inspection\n\n```json\n'+json.dumps(report,indent=2)+'\n```\n\nPrivate Pages requires an eligible paid GitHub plan; owner billing entitlement is not exposed to this workflow. Native PR preview deployment is not publicly available. No Pages, visibility, CNAME or DNS settings were changed.\n')
