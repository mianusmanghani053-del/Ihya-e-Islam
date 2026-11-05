# Local contract fixtures test UI behavior; they are not production catalogue data.
from playwright.sync_api import sync_playwright, expect
import os, io, wave
base=os.environ.get('TEST_URL','http://127.0.0.1:8789')
reciters=[{'id':i+1,'name':'Test Reciter '+name,'arabicName':'قارئ تجريبي','category':category,'trackCount':2} for i,(name,category) in enumerate([('Alpha','recitations'),('Beta','haramain'),('Gamma','non-hafs'),('Delta','translations')])]
tracks=lambda i:{'reciter':i,'tracks':[{'id':str(n),'surah':n,'title':title,'url':f'https://download.quranicaudio.com/quran/local-test/{n:03}.mp3'} for n,title in [(1,'Al-Fatihah'),(2,'Al-Baqarah')]]}
stream=io.BytesIO()
with wave.open(stream,'wb') as file:
 file.setnchannels(1);file.setsampwidth(2);file.setframerate(8000);file.writeframes(b'\x00\x00'*8000*30)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1366,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/data/audio-quran/catalogue.json',lambda route:route.fulfill(json={'reciters':reciters}))
 page.route('**/data/audio-quran/reciter-*.json',lambda route:route.fulfill(json=tracks(int(route.request.url.split('reciter-')[-1].split('.')[0]))))
 page.route('https://download.quranicaudio.com/quran/local-test/**',lambda route:route.fulfill(body=stream.getvalue(),content_type='audio/wav'))
 page.goto(base+'/#quran',wait_until='networkidle')
 expect(page.locator('.aq-main-tabs [role="tab"]')).to_have_count(4)
 page.locator('[data-a="qtab"][data-v="audio"]').click()
 expect(page.locator('.aq-category-tabs a')).to_have_count(4)
 expect(page.locator('.aq-reciter')).to_have_count(1)
 for category in ['haramain','non-hafs','translations','recitations']:
  page.locator(f'.aq-category-tabs a[href="#quran/audio/{category}"]').click()
  expect(page.locator('.aq-reciter')).to_have_count(1)
  expect(page.locator(f'.aq-category-tabs a[href="#quran/audio/{category}"]')).to_have_attribute('aria-selected','true')
 assert 'Quranic Audio' not in page.locator('#view').inner_text()
 page.locator('#aq-reciter-search').fill('missing')
 expect(page.locator('.aq-reciter')).to_have_count(0)
 page.locator('#aq-reciter-search').fill('Alpha')
 page.locator('.aq-reciter').click()
 expect(page.locator('.aq-track')).to_have_count(2)
 page.locator('[data-aq-play]').first.click()
 expect(page.locator('.aq-player')).to_be_visible()
 page.wait_for_function('()=>document.getElementById("aq-audio").readyState>=2')
 page.locator('#aq-speed').select_option('1.25')
 assert page.evaluate('document.getElementById("aq-audio").playbackRate')==1.25
 page.locator('[data-aq-next]').click()
 expect(page.locator('#aq-now-title')).to_have_text('Al-Baqarah')
 page.locator('[data-aq-previous]').click()
 expect(page.locator('#aq-now-title')).to_have_text('Al-Fatihah')
 page.locator('#aq-repeat').select_option('one')
 page.locator('[data-a="qtab"][data-v="surah"]').click()
 expect(page.locator('#q-select')).to_be_visible()
 expect(page.locator('.aq-player')).to_be_visible()
 page.locator('[data-a="qtab"][data-v="audio"]').click()
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/audio-quran-mobile.png',full_page=False)
 page.locator('[data-aq-close]').click()
 expect(page.locator('.aq-player')).to_be_hidden()
 assert not errors,errors
 browser.close()
 print('PASS (local fixtures): fourth tab, four categories, search, tracks, native player, next/previous, speed, repeat control, text-tab return and mobile width.')
