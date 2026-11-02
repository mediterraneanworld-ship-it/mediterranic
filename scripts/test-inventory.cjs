/** Pure inventory regressions: no real credentials, network calls or database writes. */
const assert=require('node:assert/strict');const{test}=require('node:test');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,imports={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:name=>{if(name in imports)return imports[name];throw Error('Unexpected import '+name)},console,URL,AbortSignal,fetch:async()=>{throw Error('Unexpected fetch')}});return module.exports}
const copy=load('src/lib/public-copy.ts');const visibility=load('src/lib/product-visibility.ts',{'@/lib/public-copy':copy});const links=load('src/lib/marketplace-links.ts');const rules=load('src/lib/inventory-rules.ts',{'@/lib/product-visibility':visibility,'@/lib/marketplace-links':links});
const reader=load('src/lib/catawiki-inventory.ts',{'@/lib/marketplace-links':links});
const remote=(channel,id,reference)=>({channel,url:channel==='ebay'?`https://www.ebay.com/itm/${id}`:`https://www.catawiki.com/en/l/${id}`,title:reference?`Specimen ${reference}`:'Testus testus trilobite',description:'Fixture',reference:reference||null,priceCents:10000,imageUrls:[]});
const feed=listings=>({ok:true,complete:true,checkedAt:'2026-11-02T06:00:00.000Z',count:listings.length,listings});

test('one shared count excludes archive, drafts, zero stock and verified inactive offers',()=>{
 const base={published:true,archived:false,stock:1,listingChannel:'direct'};
 const counts=rules.inventoryCounts([base,{...base,listingChannel:'ebay',marketplaceActive:true},{...base,listingChannel:'catawiki',marketplaceActive:false},{...base,stock:0},{...base,archived:true},{...base,published:false},{...base,listingChannel:null}]);
 assert.equal(counts.all,2);assert.equal(counts.direct,1);assert.equal(counts.ebay,1);assert.equal(counts.catawiki,0);assert.equal(counts.all,counts.direct+counts.ebay+counts.catawiki);
});
test('a complete seller section proves one Catawiki offer, not lots elsewhere on the page',()=>{
 const text='Title: View my lots\nAll lots (1)\nIn auction now\n[1 Free shipping Orange Bigotina Starting bid €1 4 days left](https://www.catawiki.com/en/l/108133994-orange-bigotina "Orange Bigotina")\nSeller story\n[Unrelated Current bid €500](https://www.catawiki.com/en/l/9999999999-other)';
 const result=reader.parseCatawikiInventory(text);assert.equal(result.ok,true);assert.equal(result.complete,true);assert.equal(result.count,1);assert.equal(result.listings[0].url,'https://www.catawiki.com/en/l/108133994');assert.equal(result.listings[0].priceCents,100);
});
test('partial or blocked seller reads do not mean zero offers',()=>{
 const partial=reader.parseCatawikiInventory('All lots (7)\nIn auction now\n[Bigotina Current bid €30 2 days left](https://www.catawiki.com/en/l/108133994-bigotina)\nSeller story');
 assert.equal(partial.complete,false);assert.equal(partial.count,null);
 const blocked=reader.parseCatawikiInventory('Title: Error Page\nWarning: Target URL returned error 403');assert.equal(blocked.ok,false);assert.equal(blocked.count,null);
});
test('Catawiki relisting redirects retain catalogue identity #9629',()=>{
 const result=reader.parseCatawikiIdentity('Title: Orange Bigotina\nURL Source: https://www.catawiki.com/en/l/107874965\nFinal URL: https://www.catawiki.com/en/l/108133994-orange-bigotina\nMarkdown Content:\nDescription\nBigotina n. sp. C #9629', 'https://www.catawiki.com/en/l/107874965');
 assert.equal(result.reference,'9629');assert.equal(result.finalUrl,'https://www.catawiki.com/en/l/108133994');
});
test('one Catawiki plus three eBay relistings automatically produce zero Site Only in the fixture catalogue',()=>{
 const specimens=[0,1,2,3].map(i=>({id:i+1,name:'Fixture '+i,species:'Testus testus',specimenReference:String(9600+i),published:true,archived:false,stock:1,listingChannel:'direct'}));
 const sources={catawiki:feed([remote('catawiki','108133994','9600')]),ebay:feed([remote('ebay','999999900001','9601'),remote('ebay','999999900002','9602'),remote('ebay','999999900003','9603')])};
 const plan=rules.planInventoryReconciliation(specimens,sources);assert.equal(plan.links.length,4);assert.equal(plan.imports.length,0);assert.equal(plan.issues.length,0);
 const updated=specimens.map(p=>{const action=plan.links.find(a=>a.productId===p.id);return action?{...p,listingChannel:action.listing.channel,marketplaceActive:true}:p});
 const count=rules.inventoryCounts(updated);assert.equal(count.direct,0);assert.equal(count.ebay,3);assert.equal(count.catawiki,1);assert.equal(count.all,4);
});
test('same species needs one-time identity confirmation, not an automatic merge',()=>{
 const specimens=[1,2].map(id=>({id,name:'Testus '+id,species:'Testus testus',published:true,archived:false,stock:1,listingChannel:'direct'}));
 const plan=rules.planInventoryReconciliation(specimens,{ebay:feed([remote('ebay','999999900001')]),catawiki:feed([])});
 assert.equal(plan.links.length,0);assert.equal(plan.imports.length,0);assert.equal(plan.issues.length,1);assert.equal(plan.holds.length,2);
});
test('an API failure never becomes an empty verified feed or a false return to Site Only',()=>{
 const specimen={id:1,name:'Known',specimenReference:'9601',published:true,archived:false,stock:1,listingChannel:'ebay'};
 const broken={ok:false,complete:false,count:null,listings:[],checkedAt:'now',error:'403'};
 const plan=rules.planInventoryReconciliation([specimen],{ebay:broken,catawiki:feed([])});assert.equal(plan.links.length,0);assert.equal(plan.holds.length,0);assert.equal(plan.imports.length,0);
});
test('competing live offers and archived specimens are not silently moved or resurrected',()=>{
 const p={id:1,name:'Known',specimenReference:'9601',published:true,archived:false,stock:1,listingChannel:'direct'};
 const dual={ebay:feed([remote('ebay','999999900001','9601')]),catawiki:feed([remote('catawiki','108133994','9601')])};
 const plan=rules.planInventoryReconciliation([p],dual);assert.equal(plan.links.length,0);assert.equal(plan.holds.length,1);assert.ok(plan.issues.length>0);
 const archived=rules.planInventoryReconciliation([{...p,archived:true,stock:0}],{ebay:dual.ebay,catawiki:feed([])});assert.equal(archived.links.length,0);assert.equal(archived.imports.length,0);
});
test('new stable references in competing offers do not create two catalogue records',()=>{
 const plan=rules.planInventoryReconciliation([],{ebay:feed([remote('ebay','999999900001','9601')]),catawiki:feed([remote('catawiki','108133994','9601')])});assert.equal(plan.imports.length,0);assert.equal(plan.issues.length,2);
});
test('euro parsing does not truncate plain four-digit bids',()=>{assert.equal(reader.euroCents('Current bid €1350'),135000);assert.equal(reader.euroCents('Current bid €1,350'),135000);assert.equal(reader.euroCents('€1.350,50'),135050)});


test('a distinct stable catalogue ID may import a new fossil of an already known species',()=>{
 const specimen={id:1,name:'Known Testus',species:'Testus testus',specimenReference:'9601',published:true,archived:false,stock:1,listingChannel:'direct'};
 const listing={...remote('ebay','999999900001','9602'),title:'Testus testus'};
 const plan=rules.planInventoryReconciliation([specimen],{ebay:feed([listing]),catawiki:feed([])});
 assert.equal(plan.imports.length,1);assert.equal(plan.links.length,0);assert.equal(plan.holds.length,0);
});


test('one confirmed photo+copy signature recognizes a new eBay number without a catalogue reference',()=>{
 const identity=load('src/lib/marketplace-identity.ts',{'node:crypto':require('node:crypto')});
 const description='A unique physical Testus fossil with a documented repaired left spine and a distinctive natural crack in its own matrix. Price EUR 50.';
 const image='https://i.ebayimg.com/images/g/UniqueFixturePhoto/s-l1600.jpg';
 const signatures=identity.listingIdentityTokens(description,[image]);assert.equal(signatures.length,1);
 assert.equal(identity.listingIdentityTokens(description.replace('EUR 50','EUR 80'),[image.replace('1600','500')])[0],signatures[0]);
 let p={id:1,name:'Testus',species:'Testus testus',published:true,archived:false,stock:1,listingChannel:'direct'};
 p={...p,...links.rememberListing(p,'ebay','https://www.ebay.com/itm/999999900001','now',signatures)};
 const listing={...remote('ebay','999999900002'),identityTokens:signatures};
 const match=links.matchListing(listing,[p]);assert.equal(match.kind,'identity');assert.equal(match.productId,1);
 const plan=rules.planInventoryReconciliation([p],{ebay:feed([listing]),catawiki:feed([])});assert.equal(plan.links.length,1);assert.equal(plan.issues.length,0);
 const ambiguous=links.matchListing(listing,[p,{...p,id:2}]);assert.equal(ambiguous.productId,undefined);assert.equal(ambiguous.kind,'candidate');
});

test('country/marketplace descriptors and exception metadata are preserved for sync panel visibility',()=>{
 assert.equal(rules.describeEbayMarketplace('EBAY_ES').label,'EBAY_ES · Spain (ebay.es)');
 assert.equal(rules.describeEbayMarketplace(null).label,'EBAY_US · United States (ebay.com)');
 assert.equal(rules.describeCatawikiMarketplace('https://www.catawiki.com/en/u/3881635-mediterranic').label,'International / EU (catawiki.com/en · EUR)');
 assert.equal(rules.describeCatawikiMarketplace('https://www.catawiki.com/pt/l/108133994').label,'Portugal (catawiki.com/pt · EUR)');
 assert.equal(rules.describeListingMarketplace('https://www.ebay.fr/itm/999999900001','ebay','EBAY_US').includes('France'),true);
 const specimens=[1,2].map(id=>({id,name:'Testus '+id,species:'Testus testus',published:true,archived:false,stock:1,listingChannel:'direct'}));
 const esFeed={...feed([{...remote('ebay','999999900001'),url:'https://www.ebay.es/itm/999999900001'}]),marketplace:rules.describeEbayMarketplace('EBAY_ES').label};
 const plan=rules.planInventoryReconciliation(specimens,{ebay:esFeed,catawiki:feed([])});
 assert.equal(plan.issues.length,1);
 assert.equal(plan.issues[0].marketplace,'EBAY_ES · Spain (ebay.es)');
});

test('Further from the same shelf keeps only same geological Era, puts available first, and omits unavailable when enough exist',()=>{
 const shelf=load('src/lib/shelf-recommendations.ts',{'@/lib/product-visibility':visibility});
 const item=(id,slug,period,available,archived=false)=>({
  id,slug,period,collection:/cambrian/i.test(period)?'cambrian-dawn':/devonian/i.test(period)?'devonian-crown':'ordovician-mariners',
  published:true,featured:false,archived,stock:available?1:0,listingChannel:available?'ebay':null
 });
 const catalogue=[
  item(1,'dicranurus','Devonian',true),
  item(2,'agerina','Ordovician',false,true),
  item(3,'bigotina','Cambrian',true),
  item(4,'daguinaspis-unavail','Cambrian',false,true),
  item(5,'fezouata','Ordovician',true),
  item(6,'daguinaspis-avail','Cambrian',true),
  item(7,'bigotinops','Lower Cambrian',true),
  item(8,'cyphaspis','Devonian',true),
  item(9,'perrector-unavail','Cambrian',false,false),
  item(10,'perrector-avail','Cambrian',true),
  item(11,'comura-unavail','Devonian',false,true),
 ];
 // Viewing an unavailable Cambrian piece: 4 available Cambrian exist -> 0 unavailable shown
 const enough=shelf.selectSameShelfProducts(catalogue[8],catalogue,4);
 assert.deepEqual(Array.from(enough,p=>p.slug),['bigotina','daguinaspis-avail','bigotinops','perrector-avail']);
 assert.equal(enough.every(p=>visibility.isAvailable(p)),true);

 // Viewing bigotina (Cambrian): 3 other available Cambrian exist -> 3 available first + 1 unavailable Cambrian at the end
 const padded=shelf.selectSameShelfProducts(catalogue[2],catalogue,4);
 assert.deepEqual(Array.from(padded,p=>p.slug),['daguinaspis-avail','bigotinops','perrector-avail','perrector-unavail']);

 // Viewing cyphaspis (Devonian): 1 available Devonian first + 1 unavailable Devonian at the end; no Cambrian/Ordovician mixed in
 const devonian=shelf.selectSameShelfProducts(catalogue[7],catalogue,4);
 assert.deepEqual(Array.from(devonian,p=>p.slug),['dicranurus','comura-unavail']);
});

test('specimen period and channel labels resolve the same filters accepted by the shop URL',()=>{
 const shop=load('src/lib/shop-links.ts');
 assert.equal(shop.shopPeriodHref('Cambrian'),'/shop?period=Cambrian');
 assert.equal(shop.shopPeriodHref('Lower Cambrian'),'/shop?period=Cambrian');
 assert.equal(shop.shopPeriodFromLabel('Middle Devonian'),'Devonian');
 assert.equal(shop.shopPeriodHref('Unknown'),null);
 assert.equal(shop.normalizeShopPeriod('Ordovician'),'Ordovician');
 assert.equal(shop.normalizeShopPeriod('Jurassic'),'all');
 assert.equal(shop.shopChannelHref('ebay'),'/shop?channel=ebay');
 assert.equal(shop.shopChannelHref('catawiki'),'/shop?channel=catawiki');
 assert.equal(shop.shopChannelHref('direct'),'/shop?channel=direct');
 assert.equal(shop.shopChannelHref(null),null);
 assert.equal(shop.normalizeShopChannel('invalid'),'all');
});
