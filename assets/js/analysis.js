/* KundaliAnalysis — pure computation layer for the Kundali app.
   Extracted from the old pdfgen.js. NO jsPDF, NO PDF output, NO DOM.
   Needs: window.Astronomy (astronomy.browser.min.js), window.KundaliEngine (engine.js).
   Exposed as window.KundaliAnalysis = {yearlyAnalysis, monthlyAnalysis, ...}. */
(function(){
var root = typeof window!=='undefined' ? window : globalThis;

/* ================= Gujarati maps (local fallback; KundaliEngine preferred) ================= */
var GU_RASHI={'Mesh':'મેષ','Vrushabh':'વૃષભ','Mithun':'મિથુન','Kark':'કર્ક','Sinh':'સિંહ','Kanya':'કન્યા','Tula':'તુલા','Vrshchik':'વૃશ્ચિક','Dhanu':'ધનુ','Makar':'મકર','Kumbh':'કુંભ','Meen':'મીન'};
var GU_GRAHA={'Surya':'સૂર્ય','Chandra':'ચંદ્ર','Mangal':'મંગળ','Budh':'બુધ','Guru':'ગુરુ','Shukra':'શુક્ર','Shani':'શનિ','Rahu':'રાહુ','Ketu':'કેતુ'};
var GU_NAK={'Ashwini':'અશ્વિની','Bharani':'ભરણી','Krittika':'કૃત્તિકા','Krutika':'કૃત્તિકા','Rohini':'રોહિણી','Mrigashira':'મૃગશીર્ષ','Ardra':'આર્દ્રા','Punarvasu':'પુનર્વસુ','Pushya':'પુષ્ય','Ashlesha':'આશ્લેષા','Magha':'મઘા','P.Phalguni':'પૂર્વ ફાલ્ગુની','U.Phalguni':'ઉત્તર ફાલ્ગુની','Hasta':'હસ્ત','Chitra':'ચિત્રા','Swati':'સ્વાતિ','Vishakha':'વિશાખા','Anuradha':'અનુરાધા','Jyeshtha':'જ્યેષ્ઠા','Mula':'મૂળ','P.Ashadha':'પૂર્વાષાઢા','U.Ashadha':'ઉત્તરાષાઢા','Shravana':'શ્રવણ','Dhanishtha':'ધનિષ્ઠા','Shatabhisha':'શતભિષા','P.Bhadrapada':'પૂર્વભાદ્રપદ','U.Bhadrapada':'ઉત્તરભાદ્રપદ','Revati':'રેવતી'};
var GU_VARA={'Ravivar':'રવિવાર','Somvar':'સોમવાર','Mangalvar':'મંગળવાર','Budhvar':'બુધવાર','Guruvar':'ગુરુવાર','Shukravar':'શુક્રવાર','Shanivar':'શનિવાર'};
var GU_TITHI={'Pratipada':'પ્રતિપદા','Dwitiya':'દ્વિતીયા','Tritiya':'તૃતીયા','Chaturthi':'ચતુર્થી','Panchami':'પંચમી','Shashthi':'ષષ્ઠી','Saptami':'સપ્તમી','Ashtami':'અષ્ટમી','Navami':'નવમી','Dashami':'દશમી','Ekadashi':'એકાદશી','Dwadashi':'દ્વાદશી','Trayodashi':'ત્રયોદશી','Chaturdashi':'ચતુર્દશી','Purnima':'પૂર્ણિમા','Amavasya':'અમાવસ્યા'};
var GU_PAKSHA={'Shukla':'શુક્લ','Krishna':'કૃષ્ણ'};
var GU_YOGA={'Budha-Aditya':'બુધ-આદિત્ય','Gajakesari':'ગજકેસરી','Kemadruma':'કેમદ્રુમ','Chandra-Mangal':'ચંદ્ર-મંગળ','Guru-Mangal':'ગુરુ-મંગળ','Dhana':'ધન','Rajayoga':'રાજયોગ','Neechbhanga':'નીચભંગ','Vipareeta':'વિપરીત','Shasha':'શશ','Ruchaka':'રુચક','Hansa':'હંસ'};
var GU_SADE={'Dhaiya (Kantak/Ashtam Shani) chalu':'ઢૈયા (કંટક શનિ) ચાલુ','Sade Sati chalu':'સાડાસાતી ચાલુ','Sade Sati/Dhaiya nathi':'સાડાસાતી/ઢૈયા નથી','mukta':'મુક્ત'};
var RASHIS=['Mesh','Vrushabh','Mithun','Kark','Sinh','Kanya','Tula','Vrshchik','Dhanu','Makar','Kumbh','Meen'];
var RASHI_LORD={'Mesh':'Mangal','Vrushabh':'Shukra','Mithun':'Budh','Kark':'Chandra','Sinh':'Surya','Kanya':'Budh','Tula':'Shukra','Vrshchik':'Mangal','Dhanu':'Guru','Makar':'Shani','Kumbh':'Shani','Meen':'Guru'};
var GRAHA_SHORT={'Surya':'સૂ','Chandra':'ચં','Mangal':'મં','Budh':'બુ','Guru':'ગુ','Shukra':'શુ','Shani':'શ','Rahu':'રા','Ketu':'કે'};
var GRAHAS=['Surya','Chandra','Mangal','Budh','Guru','Shukra','Shani','Rahu','Ketu'];
var DASHA_LORDS=['Ketu','Shukra','Surya','Chandra','Mangal','Rahu','Guru','Shani','Budh'];
var DASHA_YEARS={Ketu:7,Shukra:20,Surya:6,Chandra:10,Mangal:7,Rahu:18,Guru:16,Shani:19,Budh:17};
var GU_MONTHS=['જાન્યુઆરી','ફેબ્રુઆરી','માર્ચ','એપ્રિલ','મે','જૂન','જુલાઈ','ઓગસ્ટ','સપ્ટેમ્બર','ઓક્ટોબર','નવેમ્બર','ડિસેમ્બર'];

/* ================= small helpers ================= */
function ENG(){ return root.KundaliEngine||null; }
function D(x){ var e=ENG(); if(e&&typeof e.D==='function'){ try{return e.D(x);}catch(_){} } return GU_GRAHA[x]||GU_RASHI[x]||GU_NAK[x]||GU_VARA[x]||GU_TITHI[x]||GU_PAKSHA[x]||GU_YOGA[x]||x; }
function DY(y){ var e=ENG(); if(e&&typeof e.DY==='function'){ try{return e.DY(y);}catch(_){} } var m=/^([A-Za-z.\-]+)( \((.*)\))?$/.exec(String(y)); if(!m) return y; var base=GU_YOGA[m[1]]||m[1]; return m[3]?base+' ('+D(m[3])+')':base; }
function GSHORT(g){ var e=ENG(); if(e&&e.GRAHA_SHORT&&e.GRAHA_SHORT[g]) return e.GRAHA_SHORT[g]; return GRAHA_SHORT[g]||g; }
function houseLord(lagnaRi,bhav){ var e=ENG(); if(e&&typeof e.houseLord==='function'){ try{return e.houseLord(lagnaRi,bhav);}catch(_){} } var r=RASHIS[(lagnaRi+bhav-1)%12]; return {lord:RASHI_LORD[r],rashi:r}; }
function planetsInGu(houses,bhav){ var e=ENG(),out=[]; if(e&&typeof e.planetsIn==='function'){ try{ var s=e.planetsIn(houses,bhav); if(typeof s==='string') return s||'કોઈ નહીં'; if(s&&s.length) return s.map(D).join(', '); return 'કોઈ નહીં'; }catch(_){} } for(var g in houses){ if(houses[g]===bhav) out.push(D(g)); } return out.length?out.join(', '):'કોઈ નહીં'; }
function fill(t,data){ return String(t).replace(/\{([a-z_]+)\}/g,function(m,k){ return (data&&data[k]!==undefined&&data[k]!==null)?data[k]:m; }); }
function words(t,n){ var w=String(t).split(/\s+/); return w.slice(0,n).join(' ')+(w.length>n?'…':''); }
function wordsFrom(t,start,n){ var w=String(t).split(/\s+/); if(start>=w.length) start=0; var s=w.slice(start,start+n).join(' '); return s+(w.length>start+n?'…':''); }
function pad2(n){ return String(n).padStart(2,'0'); }
function parseISO(s){ var p=String(s).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
function isoOf(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function dateGu(iso){ var p=String(iso).split('-'); return (p[2]||'')+'-'+(p[1]||'')+'-'+(p[0]||''); }
function sadeGu(status){ return GU_SADE[status]||status; }

/* ================= Varshphal analysis engine ================= */
function rashiIdxOf(name,jsDate){ return RASHIS.indexOf(planetRashi(name,jsDate)); }
function houseFrom(ri,refRi){ return ((((ri-refRi)%12)+12)%12)+1; }
function sadeAt(satRi,moonRi){
  var rel=((((satRi-moonRi)%12)+12)%12);
  if(rel===11||rel===0||rel===1) return {status:'Sade Sati chalu', phase:(rel===11?'pratham':(rel===0?'beejo (peak)':'trijo (antim)')), rel:rel};
  if(rel===3||rel===7) return {status:'Dhaiya (Kantak/Ashtam Shani) chalu', phase:'dhaiya', rel:rel};
  return {status:'Sade Sati/Dhaiya nathi', phase:'mukta', rel:rel};
}
function dashaOn(chart,iso){
  var md=null,i,mds=chart.mahadashas||[];
  for(i=0;i<mds.length;i++){ if(mds[i].start<=iso && iso<=mds[i].end){ md=mds[i]; break; } }
  if(!md) return {mdLord:null, adLord:null};
  var ads=(chart.current_mahadasha && md.lord===chart.current_mahadasha.lord && chart.antardashas) ? chart.antardashas : antardashasOf(md.lord, md.start);
  var ad=null;
  for(i=0;i<ads.length;i++){ if(ads[i].start<=iso && iso<=ads[i].end){ ad=ads[i]; break; } }
  return {mdLord:md.lord, adLord:ad?ad.lord:null};
}
function transitAt(chart,jsDate){
  var moonRi=chart.planets.Chandra.rashi_idx, lagnaRi=chart.lagna.rashi_idx;
  function tr(name){ var ri=rashiIdxOf(name,jsDate); return {rashi:RASHIS[ri], ri:ri, hMoon:houseFrom(ri,moonRi), hLagna:houseFrom(ri,lagnaRi)}; }
  var shani=tr('Shani'), guru=tr('Guru'), rahu=tr('Rahu');
  var kri=(rahu.ri+6)%12;
  var ketu={rashi:RASHIS[kri], ri:kri, hMoon:houseFrom(kri,moonRi), hLagna:houseFrom(kri,lagnaRi)};
  return {shani:shani, guru:guru, rahu:rahu, ketu:ketu, sade:sadeAt(shani.ri,moonRi)};
}
function yearlyAnalysis(chart,birth,year){
  var yS=year+'-01-01', yE=year+'-12-31';
  var segments=[];
  (chart.mahadashas||[]).forEach(function(md){
    if(md.end<yS || md.start>yE) return;
    var oS=md.start<yS?yS:md.start, oE=md.end>yE?yE:md.end;
    var ads=(chart.current_mahadasha && md.lord===chart.current_mahadasha.lord && chart.antardashas) ? chart.antardashas : antardashasOf(md.lord, md.start);
    ads.forEach(function(ad){
      if(ad.end<oS || ad.start>oE) return;
      segments.push({mdLord:md.lord, adLord:ad.lord, start:ad.start<oS?oS:ad.start, end:ad.end>oE?oE:ad.end, contd:ad.start<oS});
    });
  });
  segments.sort(function(a,b){ return a.start<b.start?-1:(a.start>b.start?1:0); });
  var trm=transitAt(chart,new Date(year,6,1,12,0,0));
  var dd=dashaOn(chart,year+'-07-01');
  return {year:year, umar:year-(birth&&birth.y?birth.y:year), segments:segments,
    adChanges:segments.slice(1).map(function(s){return s.start;}),
    midMD:dd.mdLord, shani:trm.shani, guru:trm.guru, rahu:trm.rahu, ketu:trm.ketu, sade:trm.sade};
}
function monthlyAnalysis(chart,year,m0){
  var mid=new Date(year,m0,15,12,0,0);
  var trm=transitAt(chart,mid);
  var dd=dashaOn(chart,isoOf(mid));
  return {iso:isoOf(mid), mdLord:dd.mdLord, adLord:dd.adLord,
    shani:trm.shani, guru:trm.guru, rahu:trm.rahu, ketu:trm.ketu, sade:trm.sade};
}
function masikCat(hMoon){
  if(hMoon===1||hMoon===4||hMoon===7||hMoon===10) return 'kendra';
  if(hMoon===5||hMoon===9) return 'trikon';
  if(hMoon===6||hMoon===8||hMoon===12) return 'dusthana';
  return 'anya';
}
function transitChanges(chart,year){
  var out=[];
  ['Shani','Guru','Rahu'].forEach(function(pl){
    var prev=null;
    for(var m=0;m<12;m++){
      var rs=planetRashi(pl,new Date(year,m,15,12,0,0));
      if(prev&&rs!==prev) out.push({planet:pl,month:m,from:prev,to:rs});
      prev=rs;
    }
  });
  return out;
}
/* Antardasha table for a mahadasha (same math as engine: standard MD years) */
function antardashasOf(mdLord,startISO){
  var out=[],mi=DASHA_LORDS.indexOf(mdLord);
  var mdY=DASHA_YEARS[mdLord]||0,cur=parseISO(startISO);
  for(var k=0;k<9;k++){
    var al=DASHA_LORDS[(mi+k)%9];
    var yrs=mdY*DASHA_YEARS[al]/120;
    var end=new Date(cur.getTime()+yrs*365.25*86400000);
    out.push({lord:al,start:isoOf(cur),end:isoOf(end)});
    cur=end;
  }
  return out;
}

/* ================= Gochar planet rashi (sidereal) ================= */
var BODYMAP={Surya:'Sun',Chandra:'Moon',Mangal:'Mars',Budh:'Mercury',Guru:'Jupiter',Shukra:'Venus',Shani:'Saturn'};
function daysJ2000(dt){ return (Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate(),12)-Date.UTC(2000,0,1,12))/86400000; }
function ayanamsaOf(d){ return 23.8527778 + d/365.25*0.013969; }
function norm360(x){ x%=360; return x<0?x+360:x; }
/* JPL Keplerian elements J2000 + rate/century: [a,da,e,de,I,dI,L,dL,lp,dlp,om,dom] */
var ELEMENTS={
  Mercury:[0.38709927,0.00000037,0.20563593,0.00001906,7.00497902,-0.00594749,252.25032350,149472.67411175,77.45779628,0.16047689,48.33076593,-0.12534081],
  Venus:[0.72333566,0.00000390,0.00677672,-0.00004107,3.39467605,-0.00078890,181.97909950,58517.81538729,131.60246718,0.00268329,76.67984255,-0.27769418],
  Earth:[1.00000261,0.00000562,0.01671123,-0.00004392,-0.00001531,-0.01294668,100.46457166,35999.37244981,102.93768193,0.32327364,0,0],
  Mars:[1.52371034,0.00001847,0.09339410,0.00007882,1.84969142,-0.00813131,-4.55343205,19140.30268499,-23.94362959,0.44441088,49.55953891,-0.29257343],
  Jupiter:[5.20288700,-0.00011607,0.04838624,-0.00013253,1.30439695,-0.00183714,34.39644051,3034.74612775,14.72847983,0.21252668,100.47390909,0.20469106],
  Saturn:[9.53667594,-0.00125060,0.05386179,-0.00050991,2.48599187,0.00193639,49.95424423,1222.49362201,92.59887831,-0.41897216,113.66242448,-0.28867794]
};
function helioXYZ(el,d){
  var r=Math.PI/180,T=d/36525;
  var a=el[0]+el[1]*T,e=el[2]+el[3]*T,I=(el[4]+el[5]*T)*r;
  var L=norm360(el[6]+el[7]*T),lp=norm360(el[8]+el[9]*T),om=norm360(el[10]+el[11]*T);
  var w=(lp-om)*r,M=norm360(L-lp)*r,E=M+e*Math.sin(M),i;
  for(i=0;i<6;i++) E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
  var xp=a*(Math.cos(E)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(E);
  var omr=om*r;
  var cw=Math.cos(w),sw=Math.sin(w),co=Math.cos(omr),so=Math.sin(omr),ci=Math.cos(I),si=Math.sin(I);
  return [(cw*co-sw*so*ci)*xp+(-sw*co-cw*so*ci)*yp,
          (cw*so+sw*co*ci)*xp+(-sw*so+cw*co*ci)*yp,
          (sw*si)*xp+(cw*si)*yp];
}
function geoLonFallback(planetKey,d){
  var E=helioXYZ(ELEMENTS.Earth,d),P=helioXYZ(ELEMENTS[planetKey],d);
  return norm360(Math.atan2(P[1]-E[1],P[0]-E[0])*180/Math.PI);
}
function tropicalFallback(name,d){
  var r=Math.PI/180;
  switch(name){
    case 'Surya':{ var M=norm360(357.529+0.9856003*d),L=norm360(280.460+0.9856474*d); return norm360(L+1.915*Math.sin(M*r)+0.020*Math.sin(2*M*r)); }
    case 'Chandra':{ var Lm=norm360(218.316+13.176396*d),Mm=norm360(134.963+13.064993*d),Ms=norm360(357.529+0.9856003*d),Ls=norm360(280.460+0.9856474*d),Dd=norm360(Lm-Ls);
      return norm360(Lm+6.289*Math.sin(Mm*r)+1.274*Math.sin((2*Dd-Mm)*r)+0.658*Math.sin(2*Dd*r)+0.214*Math.sin(2*Ms*r)-0.186*Math.sin(Ms*r)); }
    case 'Mangal': return geoLonFallback('Mars',d);
    case 'Budh': return geoLonFallback('Mercury',d);
    case 'Guru': return geoLonFallback('Jupiter',d);
    case 'Shukra': return geoLonFallback('Venus',d);
    case 'Shani': return geoLonFallback('Saturn',d);
    case 'Rahu': return norm360(125.045-0.052954*d);
    case 'Ketu': return norm360(125.045-0.052954*d+180);
  }
  return 0;
}
function planetRashi(name,jsDate){
  var d=daysJ2000(jsDate),aya=ayanamsaOf(d),lon;
  try{
    var A=root.Astronomy;
    /* NB: astronomy-engine v2 EclipticLongitude() is HELIOCENTRIC — wrong for gochar.
       Use geocentric: EclipticGeoMoon for Chandra, GeoVector+Ecliptic for planets. */
    if(A&&BODYMAP[name]){
      if(name==='Chandra'&&typeof A.EclipticGeoMoon==='function'){
        lon=A.EclipticGeoMoon(jsDate).lon;
      }else if(name!=='Surya'&&typeof A.GeoVector==='function'&&typeof A.Ecliptic==='function'){
        lon=A.Ecliptic(A.GeoVector(BODYMAP[name],jsDate,true)).elon;
      }else lon=tropicalFallback(name,d);
    } else lon=tropicalFallback(name,d);
  }catch(_){ lon=tropicalFallback(name,d); }
  return RASHIS[Math.floor(norm360(lon-aya)/30)%12];
}

root.KundaliAnalysis={
  yearlyAnalysis:yearlyAnalysis, monthlyAnalysis:monthlyAnalysis,
  transitAt:transitAt, dashaOn:dashaOn, transitChanges:transitChanges,
  antardashasOf:antardashasOf, rashiIdxOf:rashiIdxOf, houseFrom:houseFrom,
  sadeAt:sadeAt, planetRashi:planetRashi, masikCat:masikCat, dateGu:dateGu,
  sadeGu:sadeGu, parseISO:parseISO, isoOf:isoOf, pad2:pad2, todayISO:todayISO,
  fill:fill, words:words, wordsFrom:wordsFrom, D:D, DY:DY, GSHORT:GSHORT,
  houseLord:houseLord, planetsInGu:planetsInGu,
  daysJ2000:daysJ2000, ayanamsaOf:ayanamsaOf, norm360:norm360,
  helioXYZ:helioXYZ, geoLonFallback:geoLonFallback, tropicalFallback:tropicalFallback,
  BODYMAP:BODYMAP, GU_MONTHS:GU_MONTHS, RASHIS:RASHIS, GRAHAS:GRAHAS,
  DASHA_LORDS:DASHA_LORDS, DASHA_YEARS:DASHA_YEARS
};
})();
