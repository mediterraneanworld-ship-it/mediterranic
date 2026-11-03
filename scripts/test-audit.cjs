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
test('PayPal auth failure is classified and never leaks the secret',async()=>{
 const api=load('src/lib/paypal.ts',{env:{PAYPAL_CLIENT_ID:'fixture-client',PAYPAL_CLIENT_SECRET:'fixture-secret-value',PAYPAL_ENV:'sandbox'},fetch:async()=>new Response(JSON.stringify({error:'invalid_client',error_description:'The client credentials are invalid'}),{status:401,headers:{'Content-Type':'application/json'}})});
 await assert.rejects(
  api.createPaypalOrder({totalCents:100,description:'Fixture',referenceId:'auth-fixture',returnUrl:'https://example.test/checkout',cancelUrl:'https://example.test/checkout'}),
  (error)=>error.code==='PAYPAL_AUTH_FAILED'&&error.paypalName==='invalid_client'&&/sandbox/.test(error.message)&&!error.message.includes('fixture-secret-value'));
});
test('PayPal environment auto-detects live keys when PAYPAL_ENV is unset',async()=>{
 const hosts=[];
 const api=load('src/lib/paypal.ts',{env:{PAYPAL_CLIENT_ID:'live-fixture-client',PAYPAL_CLIENT_SECRET:'live-fixture-secret'},fetch:async(url)=>{const u=String(url);hosts.push(new URL(u).hostname);
  if(u.includes('sandbox')&&u.includes('oauth2/token'))return new Response(JSON.stringify({error:'invalid_client'}),{status:401,headers:{'Content-Type':'application/json'}});
  if(u.includes('oauth2/token'))return new Response(JSON.stringify({access_token:'fixture-live-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({id:'LIVEORDER1',status:'CREATED',links:[{rel:'approve',href:'https://www.paypal.com/checkoutnow?token=LIVEORDER1'}]}),{status:200,headers:{'Content-Type':'application/json'}});}});
 const order=await api.createPaypalOrder({totalCents:500,description:'Fixture',referenceId:'detect-fixture',returnUrl:'https://example.test/checkout',cancelUrl:'https://example.test/checkout'});
 assert.equal(order.id,'LIVEORDER1');assert.ok(hosts.includes('api-m.paypal.com'));
 const summary=api.paypalConfigSummary();assert.equal(summary.resolvedEnvironment,'live');assert.equal(api.paypalEnvironment(),'live');
});
test('PayPal order rejection keeps the issue code for diagnosis',async()=>{
 const api=load('src/lib/paypal.ts',{env:{PAYPAL_CLIENT_ID:'fixture-client',PAYPAL_CLIENT_SECRET:'fixture-secret',PAYPAL_ENV:'live'},fetch:async(url)=>String(url).includes('oauth2/token')
  ?new Response(JSON.stringify({access_token:'fixture-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}})
  :new Response(JSON.stringify({name:'UNPROCESSABLE_ENTITY',message:'The requested action could not be performed.',details:[{issue:'DUPLICATE_INVOICE_ID',description:'Invoice ID already used.'}],debug_id:'debug-fixture'}),{status:422,headers:{'Content-Type':'application/json'}})});
 await assert.rejects(
  api.createPaypalOrder({totalCents:100,description:'Fixture',referenceId:'reject-fixture',returnUrl:'https://example.test/checkout',cancelUrl:'https://example.test/checkout'}),
  (error)=>error.code==='PAYPAL_ORDER_REJECTED'&&/DUPLICATE_INVOICE_ID/.test(error.message)&&/debug-fixture/.test(error.message));
});
test('PayPal config summary exposes variable names and an ID tail, never secrets',()=>{
 const api=load('src/lib/paypal.ts',{env:{PAYPAL_CLIENT_ID:'abcdefghwxyz',PAYPAL_SECRET:'a-very-secret-value'}});
 const summary=api.paypalConfigSummary();
 assert.equal(summary.configured,true);assert.equal(summary.clientIdTail,'wxyz');assert.equal(summary.secretSource,'PAYPAL_SECRET');
 assert.equal(summary.explicitEnvironment,null);assert.equal(JSON.stringify(summary).includes('a-very-secret-value'),false);
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
test('order status transitions guard payment, shipping and stock restoration',()=>{
 const service=orderService({id:1,slug:'test',name:'Fixture',published:true,stock:1,archived:false,listingChannel:'direct',priceCents:12345});
 const plan=service.planOrderTransition;
 const allows=(status,action,to,restoreStock)=>{const p=plan(status,action);assert.equal(p.ok,true,`${status} + ${action}`);assert.equal(p.to,to);assert.equal(p.restoreStock,restoreStock)};
 const denies=(status,action)=>assert.equal(plan(status,action).ok,false,`${status} + ${action}`);
 allows('pending_invoice','confirm','confirmed',false);
 allows('payment_review','confirm','confirmed',false);
 denies('pending_payment','confirm');
 denies('confirmed','confirm');
 allows('confirmed','ship','shipped',false);
 denies('pending_invoice','ship');
 allows('shipped','complete','completed',false);
 allows('confirmed','complete','completed',false);
 denies('pending_invoice','complete');
 allows('confirmed','cancel','cancelled',true);
 allows('shipped','cancel','cancelled',true);
 allows('pending_invoice','cancel','cancelled',false);
 allows('pending_payment','cancel','cancelled',false);
 allows('payment_review','cancel','cancelled',false);
 denies('completed','cancel');
 denies('cancelled','cancel');
 allows('shipped','tracking','shipped',false);
 allows('completed','tracking','completed',false);
 denies('confirmed','tracking');
});
test('public copy corrections do not mutate stored input',()=>{
 const copy=load('src/lib/public-copy.ts');const stored={title:'Insured worldwide shipping',analytics:{bodyScripts:'insured is a script literal'},logoImage:'/images/insured.png'};const out=copy.safeContent(stored);assert.equal(stored.title,'Insured worldwide shipping');assert.ok(!/insured/i.test(out.title));assert.equal(out.analytics.bodyScripts,stored.analytics.bodyScripts);assert.equal(out.logoImage,stored.logoImage);
});
