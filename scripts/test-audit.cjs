/** Offline general-review regression checks. No real credentials, network or DB writes. */
const assert=require('node:assert/strict');const {test}=require('node:test');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,{imports={},env={},fetch=async()=>{throw Error('Unexpected network')}}={}){const module={exports:{}};const context=vm.createContext({module,exports:module.exports,require:name=>{if(name in imports)return imports[name];throw Error('Unexpected import '+name)},process:{env},fetch,Buffer,URL,URLSearchParams,AbortSignal,Response,console,setTimeout,clearTimeout});vm.runInContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);return module.exports}
const links=load('src/lib/marketplace-links.ts');const shipping=load('src/lib/shipping.ts');
const ebay='https://www.ebay.com/itm/920090937900';const nextEbay='https://www.ebay.com/itm/920090937901';const cw='https://www.catawiki.com/en/l/107894644';

test('one specimen retains eBay and Catawiki through a full channel cycle',()=>{
 let p={id:1,name:'Comura',listingChannel:'ebay',externalListingUrl:ebay};
 p={...p,...links.rememberListing(p,'catawiki',cw),listingChannel:'catawiki',externalListingUrl:cw};
 assert.equal(links.savedListing(p,'ebay'),ebay);assert.equal(links.activeListing(p).url,cw);
 p={...p,listingChannel:'direct'};assert.equal(links.activeListing(p),null);
 p={...p,...links.rememberListing(p,'ebay',nextEbay),listingChannel:'ebay',externalListingUrl:nextEbay};
 assert.equal(links.savedListing(p,'catawiki'),cw);assert.equal(links.activeListing(p).url,nextEbay);assert.equal(links.rememberedLinks(p).length,3);
 assert.equal(links.matchListing({url:ebay,title:'Changed title'},[p]).productId,1);
});
test('same species is not proof of identity; catalogue reference is',()=>{
 const p=[{id:1,name:'Comura A',species:'Comura bultyncki',specimenReference:'9591'},{id:2,name:'Comura B',species:'Comura bultyncki',specimenReference:'9592'}];
 const vague=links.matchListing({url:ebay,title:'Comura bultyncki trilobite'},p);assert.equal(vague.kind,'candidate');assert.equal(vague.productId,undefined);assert.equal(vague.candidates.length,2);
 const clear=links.matchListing({url:ebay,title:'9591 Comura bultyncki'},p);assert.equal(clear.kind,'reference');assert.equal(clear.productId,1);
});
test('URLs are matched across tracking parameters and regional eBay domains',()=>{
 assert.equal(links.listingKey('https://www.ebay.co.uk/itm/Comura/920090937900?x=1'),links.listingKey(ebay));
 assert.equal(links.canonicalListing('https://www.ebay.com.bad-host.test/itm/920090937900'),null);
 assert.equal(links.canonicalListing(cw,'ebay'),null);
});
test('249 unique ISO destinations are alphabetic and every one has one of five zones',()=>{
 assert.equal(shipping.COUNTRIES.length,249);assert.equal(new Set(shipping.COUNTRIES.map(c=>c.code)).size,249);assert.equal(shipping.ZONES.length,5);
 for(let i=1;i<shipping.COUNTRIES.length;i++)assert.ok(shipping.COUNTRIES[i-1].name.localeCompare(shipping.COUNTRIES[i].name,'en',{sensitivity:'base'})<=0);
 for(const c of shipping.COUNTRIES){assert.equal(shipping.calculateShipping(c.code,true),0);assert.ok(shipping.calculateShipping(c.code,false)>0)}
 assert.equal(shipping.calculateShipping('XX',false),null);
});
test('free shipping is authoritative; paid shipping is one rate per zone',()=>{
 for(const z of shipping.ZONES){const c=shipping.COUNTRIES.find(c=>c.zone===z.id);assert.equal(shipping.calculateShipping(c.code,false),z.rateCents);assert.equal(shipping.calculateShipping(c.code,true),0)}
 assert.equal(shipping.shippingMethodId(true),'free');assert.equal(shipping.shippingMethodId(false),'protected');
});
test('public products hide internal prices/history and unavailable prices',()=>{
 const visibility=load('src/lib/product-visibility.ts',{imports:{'@/lib/public-copy':load('src/lib/public-copy.ts')}});
 const base={archived:false,stock:1,listingChannel:'ebay',priceCents:12345,compareAtCents:15000,siteOnlyPriceCents:90000,marketplaceHistory:[{url:ebay}],ebayListingUrl:ebay,catawikiListingUrl:cw};
 const pub=visibility.publicProduct(base);assert.equal(pub.priceCents,12345);assert.equal(pub.siteOnlyPriceCents,null);assert.equal(pub.marketplaceHistory.length,0);
 const archived=visibility.publicProduct({...base,archived:true});assert.equal(archived.priceCents,0);assert.equal(archived.compareAtCents,null);
});
test('production admin fails closed even if STRICT_ADMIN_AUTH was omitted',async()=>{
 const auth=load('src/lib/admin-auth.ts',{env:{VERCEL:'1'},imports:{'next/headers':{headers:async()=>new Headers(),cookies:async()=>({get:()=>undefined})}}});
 assert.equal(auth.isAdminPreview(),false);assert.equal(auth.getAdminPassword(),'');assert.equal(await auth.isAdminAuthenticated(),false);
});
test('production admin checks the configured password',async()=>{
 const auth=load('src/lib/admin-auth.ts',{env:{VERCEL:'1',ADMIN_PASSWORD:'fixture-admin'},imports:{'next/headers':{headers:async()=>({get:name=>name==='x-admin-key'?'fixture-admin':null}),cookies:async()=>({get:()=>undefined})}}});
 assert.equal(await auth.isAdminAuthenticated(),true);
});
test('PayPal create/capture requests carry stable idempotency keys and EUR',async()=>{
 const requests=[];
 const api=load('src/lib/paypal.ts',{env:{PAYPAL_CLIENT_ID:'fixture-client',PAYPAL_SECRET:'fixture-only-placeholder',PAYPAL_ENV:'sandbox'},fetch:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(String(url).includes('oauth2/token')?{access_token:'fixture-token',expires_in:3600}:{id:'TESTORDER12345',status:'CREATED',links:[]}),{status:200,headers:{'Content-Type':'application/json'}})}});
 await api.createPaypalOrder({totalCents:12345,description:'Fixture',referenceId:'test-reference',returnUrl:'https://example.test/checkout',cancelUrl:'https://example.test/checkout'});await api.capturePaypalOrder('TESTORDER12345');
 const create=requests.find(r=>r.url.endsWith('/v2/checkout/orders'));assert.equal(create.options.headers['PayPal-Request-Id'],'create-test-reference');const unit=JSON.parse(create.options.body).purchase_units[0];assert.equal(unit.amount.currency_code,'EUR');assert.equal(unit.amount.value,'123.45');
 assert.equal(requests.at(-1).options.headers['PayPal-Request-Id'],'capture-TESTORDER12345');
});
function orderService(row, free = true) {
  return load('src/lib/order-service.ts', {
    imports: {
      'drizzle-orm': { and: (...x) => x, eq: (...x) => x, gte: (...x) => x, inArray: (...x) => x, sql: (parts, ...args) => ({parts,args}) },
      '@/db': { db: { select: () => ({ from: () => ({ where: async () => [row] }) }) } },
      '@/db/schema': { products: {slug:'slug'}, orders: {}, orderItems: {} },
      '@/lib/seed': { ensureSeeded: async () => {} },
      '@/lib/shipping': shipping,
      '@/lib/catalog': { getSiteContent: async () => ({commerce:{freeShipping:free}}) },
    },
  });
}
const buyer={email:'fixture@example.test',firstName:'Test',lastName:'Buyer',phone:null,country:'PT',addressLine1:'Test street',addressLine2:null,city:'Lisbon',postalCode:'1000-001',shippingMethod:'free',items:[{slug:'test',quantity:1}]};
test('checkout refuses marketplace, draft, archive and zero-price specimens',async()=>{
 for(const patch of [{listingChannel:'ebay'},{listingChannel:'catawiki'},{published:false},{archived:true},{priceCents:0}]){const service=orderService({id:1,slug:'test',name:'Fixture',published:true,stock:1,archived:false,listingChannel:'direct',priceCents:12345,...patch});await assert.rejects(service.buildOrder(buyer),/not available|no longer/)}
});
test('checkout recomputes price and ignores a free-shipping claim from the browser',async()=>{
 const service=orderService({id:1,slug:'test',name:'Fixture',published:true,stock:1,archived:false,listingChannel:'direct',priceCents:12345},false);const built=await service.buildOrder(buyer);assert.equal(built.subtotalCents,12345);assert.equal(built.shippingCents,5400);assert.equal(built.totalCents,17745);assert.equal(built.shippingMethod,'protected');
});
test('public copy corrections do not mutate stored input',()=>{
 const copy=load('src/lib/public-copy.ts');const stored={title:'Insured worldwide shipping',analytics:{bodyScripts:'insured is a script literal'},logoImage:'/images/insured.png'};const out=copy.safeContent(stored);assert.equal(stored.title,'Insured worldwide shipping');assert.ok(!/insured/i.test(out.title));assert.equal(out.analytics.bodyScripts,stored.analytics.bodyScripts);assert.equal(out.logoImage,stored.logoImage);
});
test('eBay quad stripes use the intended 102deg slant and four brand colors',()=>{
 const css=fs.readFileSync('src/app/globals.css','utf8');
 assert.match(css,/\.ebay-quad\s*\{[^}]*linear-gradient\(102deg,\s*#E53238\s+0\s+25%,\s*#0064D2\s+25%\s+50%,\s*#F5AF02\s+50%\s+75%,\s*#86B817\s+75%\s+100%\)/);
});
test('startup never overwrites content saved in the back-office (deploy keeps Neon data)',()=>{
 const seed=fs.readFileSync('src/lib/seed.ts','utf8');
 // Seeding only happens on an empty catalogue.
 assert.match(seed,/count\(\)/);
 assert.match(seed,/if \(Number\(value\) > 0\) return;/);
 // Settings are inserted only when the row is missing, never updated at boot.
 assert.ok(!/update\(siteSettings\)/.test(seed));
 const catalog=fs.readFileSync('src/lib/catalog.ts','utf8');
 const settingsFn=catalog.slice(catalog.indexOf('export async function getSiteSettings'));
 assert.match(settingsFn,/insert\(siteSettings\)/);
 assert.ok(!/update\(siteSettings\)\.set/.test(settingsFn.split('export async function')[0]||settingsFn));
 // Schema changes stay additive: CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 const migrate=fs.readFileSync('src/lib/schema-migrate.ts','utf8');
 assert.ok(!/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|DROP\s+COLUMN/i.test(migrate));
 assert.match(migrate,/ADD COLUMN IF NOT EXISTS/);
 assert.match(migrate,/CREATE TABLE IF NOT EXISTS/);
});
test('PayPal configuration errors surface the real diagnostic without leaking secrets',async()=>{
 const api=load('src/lib/paypal.ts',{env:{PAYPAL_CLIENT_ID:'fixture-client',PAYPAL_CLIENT_SECRET:'fixture-only-placeholder',PAYPAL_ENVIRONMENT:'live'},fetch:async()=>new Response(JSON.stringify({name:'invalid_client',message:'Invalid request parameters',details:[{description:'The access token could not be obtained'}]}),{status:401,headers:{'Content-Type':'application/json'}})});
 await assert.rejects(api.createPaypalOrder({totalCents:100,description:'Fixture',returnUrl:'https://example.test/checkout',cancelUrl:'https://example.test/checkout',referenceId:'ref-1'}),/PayPal 401 \(invalid_client\)/);
 const shown=api.paypalErrorMessage(new Error('PayPal 401 (invalid_client): The access token could not be obtained'));
 assert.ok(!/fixture-only-placeholder/.test(shown));
 assert.ok(!/fixture-client/.test(shown));
 assert.equal(api.paypalErrorMessage(new Error('fetch failed')),'Could not reach PayPal. Please try again.');
});
test('order e-mail names the reference, buyer, items and total, and never needs a transport',()=>{
 const mail=load('src/lib/order-email.ts',{env:{}});
 const input={orderId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',reference:'MED-AAAAAAAA',event:'placed',paymentMethod:'Invoice (e-mail)',status:'pending_invoice',firstName:'Ana',lastName:'Silva',email:'ana@example.test',phone:'+351900000000',country:'PT',addressLine1:'Rua 1',addressLine2:null,city:'Lisboa',postalCode:'1000-001',shippingMethod:'free',subtotalCents:135000,shippingCents:0,totalCents:135000,lines:[{name:'Cyphaspis walteri',quantity:1,unitPriceCents:135000}],createdAt:new Date('2026-11-03T10:00:00Z'),shopUrl:'https://mediterranic.vercel.app'};
 const out=mail.buildOrderEmail(input);
 assert.match(out.subject,/MED-AAAAAAAA/);assert.match(out.subject,/€1,350/);
 for(const needle of ['Cyphaspis walteri','ana@example.test','Lisboa','€1,350','/orders/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'])assert.ok(out.text.includes(needle),needle);
 assert.ok(out.html.includes('Cyphaspis walteri'));
 assert.equal(mail.mailTransport(),null);
 assert.equal(mail.orderNotificationRecipient(),'mediterranean.world@gmail.com');
 assert.equal(mail.orderNotificationRecipient.call({}),'mediterranean.world@gmail.com');
 const withResend=load('src/lib/order-email.ts',{env:{RESEND_API_KEY:'fixture',ORDER_NOTIFICATION_EMAIL:'owner@example.test'}});
 assert.equal(withResend.mailTransport(),'resend');assert.equal(withResend.orderNotificationRecipient(),'owner@example.test');
 const withBrevo=load('src/lib/order-email.ts',{env:{BREVO_API_KEY:'fixture'}});assert.equal(withBrevo.mailTransport(),'brevo');
});

test('hero stat labels are editable while specimens and eras stay computed',()=>{
 const content=load('src/lib/site-content.ts');
 const stats=content.DEFAULT_CONTENT.home.hero.stats;
 for(const key of ['years','feedbacks','specimens','eras']) assert.ok(typeof stats[key]==='string' && stats[key].length>0,key);
 const fields=JSON.stringify(content.CONTENT_GROUPS);
 assert.match(fields,/home.*hero.*stats.*feedbacks/);
 const page=fs.readFileSync('src/app/page.tsx','utf8');
 assert.match(page,/c\.hero\.stats\.specimens/);
 assert.match(page,/c\.hero\.stats\.eras/);
 // specimens/eras numbers must stay automatic
 assert.match(page,/\{forSale\.length\}/);
 assert.match(page,/\{erasOffered\}/);
 // the old 7,500 figure is gone from defaults
 assert.ok(!/7,500\+/.test(fs.readFileSync('src/lib/seed-settings.ts','utf8')));
 assert.ok(!/7,500\+ verified/.test(fs.readFileSync('src/lib/site-content.ts','utf8')));
});
test('public pages no longer expose the inventory verification banner',()=>{
 const home=fs.readFileSync('src/app/page.tsx','utf8');
 const shop=fs.readFileSync('src/app/shop/page.tsx','utf8');
 for (const [name,file] of [['home',home],['shop',shop]]) assert.ok(!/InventoryStatus/.test(file), name);
 // the component may stay for the back-office, but it must not be linked publicly
 const status=fs.readFileSync('src/components/inventory-status.tsx','utf8');
 assert.match(status,/export async function InventoryStatus/);
});
test('Cambrian collection cover label says Cambrian, and code version manifest is complete',()=>{
 const content=fs.readFileSync('src/lib/site-content.ts','utf8');
 assert.match(content,/Cover · Cambrian/);
 assert.ok(!/Cover · Souss Lagerstätte/.test(content));
 const version=load('src/lib/version.ts');
 assert.match(version.CODE_VERSION,/^\d{4}-\d{2}-\d{2}-[a-z]$/);
 for(const f of ['order-notifications','email-test','editable-hero-stats']) assert.ok(version.REQUIRED_FEATURES.includes(f),f);
});
test('buyer note is accepted, trimmed, bounded and never changes the price',async()=>{
 const mail=load('src/lib/order-email.ts',{env:{}});
 const base={orderId:'a',reference:'MED-A',event:'placed',paymentMethod:'Invoice (e-mail)',status:'pending_invoice',firstName:'A',lastName:'B',email:'a@b.test',phone:null,country:'PT',addressLine1:'Rua 1',addressLine2:null,city:'Lisboa',postalCode:'1000-001',shippingMethod:'free',subtotalCents:1000,shippingCents:0,totalCents:1000,lines:[{name:'X',quantity:1,unitPriceCents:1000}],createdAt:new Date(),shopUrl:'https://x.test'};
 const withNote=mail.buildOrderEmail({...base,customerNote:'I would like to pay by bank transfer and make an offer.'});
 assert.match(withNote.text,/BUYER MESSAGE/);
 assert.match(withNote.text,/bank transfer/);
 assert.match(withNote.html,/Buyer message/);
 const without=mail.buildOrderEmail(base);
 assert.ok(!/BUYER MESSAGE/.test(without.text));
 const service=fs.readFileSync('src/lib/order-service.ts','utf8');
 assert.match(service,/customerNote/);
 assert.match(service,/too long/);
 assert.match(service,/slice\(0, 1000\)/);
 assert.match(service,/customerNote: input\.customerNote/);
 const form=fs.readFileSync('src/components/checkout-form.tsx','utf8');
 assert.match(form,/name="customerNote"/);
 assert.match(form,/customerNote: String\(data\.get\("customerNote"\) \?\? ""\)/);
});
test('tracking links are validated and buyer e-mails carry the order reference',()=>{
 const messages=load('src/lib/order-messages.ts',{imports:{'drizzle-orm':{eq:(...x)=>x},'@/db':{db:{}}, '@/db/schema':{}, '@/lib/mailer':{curatorMailbox:()=>'mediterranean.world@gmail.com',escapeHtml:(v)=>v,mailShell:()=>'',sendMail:async()=>({ok:true,detail:'fixture'})}, '@/lib/order-email':{orderReference:()=> 'MED-FIXTURE'}}});
 const link=messages.normalizeTracking('https://www.dhl.com/track?id=AB123456789');
 assert.equal(link.code,'AB123456789');
 assert.equal(link.url,'https://www.dhl.com/track?id=AB123456789');
 assert.equal(messages.normalizeTracking('AB123456789PT').url,'AB123456789PT');
 assert.equal(messages.normalizeTracking(''),null);
 assert.equal(messages.normalizeTracking('https://bad host/track'),null);
 assert.equal(messages.normalizeTracking('x'),null);
 const mailer=load('src/lib/mailer.ts',{env:{}});
 assert.equal(mailer.mailTransport(),null);
 assert.equal(mailer.curatorMailbox(),'mediterranean.world@gmail.com');
 const reports=fs.readFileSync('src/app/api/admin/orders/tracking/route.ts','utf8');
 assert.match(reports,/sendTrackingEmails/);
 assert.match(reports,/saveOnly/);
 const reply=fs.readFileSync('src/app/api/admin/orders/message/route.ts','utf8');
 assert.match(reply,/sendBuyerMessage/);
 const dashboard=fs.readFileSync('src/components/admin-dashboard.tsx','utf8');
 assert.match(dashboard,/Paste the carrier link/);
 assert.match(dashboard,/Message buyer/);
});
test('Resend test sender is flagged: customers unreachable until a domain is verified',async()=>{
 const restricted=load('src/lib/mailer.ts',{env:{RESEND_API_KEY:'fixture'},fetch:async()=>new Response(JSON.stringify({statusCode:403,name:'validation_error',message:'You can only send testing emails to your own email address (owner@example.test). To send emails to other recipients, please verify a domain at resend.com/domains'}),{status:403})});
 assert.equal(restricted.usesRestrictedSender(),true);
 const out=await restricted.sendMail({to:'buyer@example.test',subject:'s',text:'t',html:'h'});
 assert.equal(out.ok,false);assert.equal(out.restrictedSender,true);assert.match(out.detail,/Verify your domain/);
 const verified=load('src/lib/mailer.ts',{env:{RESEND_API_KEY:'fixture',ORDER_EMAIL_FROM:'Mediterranic <orders@mediterranic.com>'},fetch:async()=>new Response('{"id":"x"}',{status:200})});
 assert.equal(verified.usesRestrictedSender(),false);
 assert.equal((await verified.sendMail({to:'buyer@example.test',subject:'s',text:'t',html:'h'})).ok,true);
 const v=load('src/lib/version.ts',{env:{RESEND_API_KEY:'fixture'}});
 assert.equal(v.codeManifest().email.customersReachable,false);
 const v2=load('src/lib/version.ts',{env:{RESEND_API_KEY:'fixture',ORDER_EMAIL_FROM:'Mediterranic <orders@mediterranic.com>'}});
 assert.equal(v2.codeManifest().email.customersReachable,true);
});
test('invoice note opens as a dialog from the invoice button, PayPal path untouched',()=>{
 const form=fs.readFileSync('src/components/checkout-form.tsx','utf8');
 assert.ok(!/Section number="04" title="A note for the curator"/.test(form));
 assert.match(form,/role="dialog"/);
 assert.match(form,/onClick=\{openInvoiceBox\}/);
 assert.match(form,/name="customerNote"/);
 assert.match(form,/value="invoice"/);
 assert.match(form,/reportValidity\(\)/);
 assert.match(form,/value="paypal"/);
});
