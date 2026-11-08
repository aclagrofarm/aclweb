window.createBlogImage = (article) => {
  const title = article.title_en || article.title || '';
  const categoryLabel = article.category || article.categoryLabel || '';
  const categoryImage = window.blogCategories?.find((category) => category.id === article.category)?.image;
  if (categoryImage) return categoryImage;

  const text = `${title} ${categoryLabel}`.toLocaleLowerCase();
  const paletteByCategory = {
    modern: ['#dbe9d8', '#8ebc7a', '#287149', '#e1be54'],
    soilless: ['#d9ece7', '#72b7a0', '#287d68', '#e1be54'],
    greenhouse: ['#e7edd8', '#9cbd77', '#517d46', '#d2a847'],
    livestock: ['#eee5d3', '#c4a26b', '#725338', '#67905b'],
    fodder: ['#e8edd3', '#a7bd57', '#557c34', '#d5b654'],
    markets: ['#f0e5d4', '#d49b5c', '#9a6241', '#6f9c65'],
    business: ['#e0e9df', '#8fb398', '#427354', '#d5b44b'],
    sustainability: ['#dceae1', '#84b68d', '#34744d', '#d4b853'],
    acl: ['#e4ead9', '#92b276', '#4b7648', '#d4b34e']
  };

  const scenes = {
    smart: '<g stroke="#245a3c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M216 267h202l-25 88H247z" fill="#d5b84f"/><path d="M270 267v-46h84v46" fill="#edf3e6"/><circle cx="275" cy="365" r="30" fill="#345f43"/><circle cx="383" cy="365" r="23" fill="#345f43"/><path d="M311 213l38-39 38 39M349 174v-34" fill="none"/><circle cx="349" cy="126" r="12" fill="#d5b84f"/></g><path d="M102 394h516M138 417h445" stroke="#76975b" stroke-width="7" stroke-linecap="round"/>',
    water: '<g stroke="#2c765f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M176 340h356M201 378h308M228 416h254" fill="none"/><path d="M226 340v-90m102 90v-115m102 115v-86m-204-30h204" fill="none"/><path d="M278 196c0 20-25 20-25 0 0-13 13-27 13-27s12 14 12 27zm102 0c0 20-25 20-25 0 0-13 13-27 13-27s12 14 12 27z" fill="#72b7c1"/></g><path d="M202 316h-46m356 0h44" stroke="#d5b84f" stroke-width="9" stroke-linecap="round"/>',
    hydro: '<g stroke="#326c52" stroke-width="8" stroke-linejoin="round"><path d="M204 190h340v213H204z" fill="#edf3e6"/><path d="M220 246h308M220 309h308M220 371h308" fill="none"/><path d="M251 246v-42m67 42v-42m67 42v-42m67 42v-42m-201 105v-42m67 42v-42m67 42v-42m67 42v-42m-201 104v-42m67 42v-42m67 42v-42m67 42v-42" fill="none"/><path d="M237 201l14-30 14 30m39 0 14-30 14 30m39 0 14-30 14 30m39 0 14-30 14 30M237 305l14-30 14 30m39 0 14-30 14 30m39 0 14-30 14 30m39 0 14-30 14 30M237 367l14-30 14 30m39 0 14-30 14 30m39 0 14-30 14 30m39 0 14-30 14 30" fill="#77a95b"/></g>',
    greenhouse: '<g stroke="#397451" stroke-width="8" stroke-linejoin="round"><path d="M158 390V255l190-135 190 135v135z" fill="#e9f2df"/><path d="M158 255h380M348 120v270M220 390V246m256 144V246" fill="none"/><path d="M254 390v-67m51 67v-91m52 91v-74m51 74v-99m-190 99h256" fill="none"/><path d="M243 321l11-25 12 25m39-20 11-25 12 25m42 45 11-25 12 25m39-52 11-25 12 25" fill="#83ad61"/></g>',
    livestock: '<g stroke="#674c35" stroke-width="8" stroke-linejoin="round"><path d="M203 246q18-38 62-35h129q48 0 58 47l-11 84H218z" fill="#f2eee3"/><path d="M449 258l54-20 36 29-8 71h-74" fill="#c89f69"/><path d="M242 341v47m70-47v47m94-47v47m71-47v47" fill="none" stroke-linecap="round"/><path d="M493 249l23-35m-44 37-21-35" fill="none" stroke-linecap="round"/><path d="M258 276h39m31 0h38" fill="none"/><circle cx="502" cy="282" r="5" fill="#34553d" stroke="none"/></g><path d="M150 408h403" stroke="#78915a" stroke-width="7" stroke-linecap="round"/>',
    poultry: '<g stroke="#775534" stroke-width="8" stroke-linejoin="round"><path d="M224 311q4-72 74-82 65-10 95 38 40-3 62 26l-18 50H249z" fill="#e9d8ab"/><circle cx="372" cy="241" r="35" fill="#f1e4c2"/><path d="M359 202q-4-31 16-39 25 8 21 41" fill="#c8744d"/><path d="M399 238l42 17-41 13" fill="#dca346"/><circle cx="381" cy="233" r="5" fill="#314f38" stroke="none"/><path d="M291 341v45m72-45v45m-98-102-39-21m115 142h41" fill="none" stroke-linecap="round"/></g>',
    fodder: '<g stroke="#477542" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M192 390q-12-114 42-221m-6 221q9-143 79-251m-43 251q30-122 110-208m-63 208q34-105 116-160m-58 160q43-82 103-117" fill="none"/><path d="M213 282l-43-35m95 6 42-52m-9 113 53-51m-9 121 60-47m-8 42 57-20" fill="none"/><path d="M423 350q44-46 93 0v42H423z" fill="#dbbd68"/><path d="M424 371h91" fill="none"/></g>',
    market: '<g stroke="#79583a" stroke-width="8" stroke-linejoin="round"><path d="M171 251h382v155H171z" fill="#f6f0df"/><path d="M151 251l41-84h340l41 84z" fill="#b9573b"/><path d="M192 167v84m85-84v84m85-84v84m85-84v84m85-84v84" fill="none"/><path d="M204 313h105v69H204zm132 0h105v69H336zm132 0h63v69h-63z" fill="#d4b575"/><circle cx="233" cy="330" r="14" fill="#79a75b"/><circle cx="269" cy="330" r="14" fill="#d76e48"/><circle cx="366" cy="330" r="14" fill="#e0b644"/><circle cx="400" cy="330" r="14" fill="#77a45d"/></g>',
    cold: '<g stroke="#466b72" stroke-width="8" stroke-linejoin="round"><path d="M184 194h332v211H184z" fill="#e9f0e9"/><path d="M184 252h332M252 194v211m196-211v211" fill="none"/><path d="M348 273v82m-36-61 72 41m0-41-72 41m36-82-14 15m14-15 14 15m-14 67-14-15m14 15 14-15" fill="none" stroke="#65a5b0" stroke-linecap="round"/><path d="M218 366h-30m326 0h-30" stroke="#d2ae52" stroke-linecap="round"/></g>',
    business: '<g stroke="#356847" stroke-width="8" stroke-linejoin="round"><path d="M186 390V177h336v213z" fill="#f2f4e9"/><path d="M229 350v-68h48v68m44 0V236h48v114m44 0v-91h48v91" fill="#8eb398"/><path d="M218 224l79-35 66 22 107-67" fill="none" stroke="#b08f38" stroke-linecap="round"/><path d="M445 144h25v25" fill="none" stroke="#b08f38" stroke-linecap="round"/></g>',
    soil: '<g stroke="#76583c" stroke-width="8" stroke-linejoin="round"><path d="M150 301q92-45 185 0t185 0v103H150z" fill="#916c4b"/><path d="M150 345q92-45 185 0t185 0v59H150z" fill="#bd9362"/><path d="M338 298v-99m0 44q-43-8-56-43 42-7 56 24m0-1q10-41 52-48-2 44-52 62" fill="#78a95c"/><path d="M270 345q22-27 40 0m53 15q18-21 36 0m-99 22q16-17 33 0" fill="none" stroke="#e5c779" stroke-linecap="round"/></g>',
    education: '<g stroke="#3b6247" stroke-width="8" stroke-linejoin="round"><path d="M180 199h176q34 0 34 35v169H216q-36 0-36-36z" fill="#f0e8cf"/><path d="M390 234q0-35 35-35h176v168q0 36-36 36H390z" fill="#e6efe0"/><path d="M390 234v169M227 247h94m-94 43h105m98-43h97m-97 43h102" fill="none"/><circle cx="329" cy="161" r="31" fill="#d0a76e"/><path d="M270 217q17-28 55-28t55 28" fill="#759b5d"/></g>',
    crop: '<g stroke="#467345" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M185 395q10-115 79-186m-21 186q24-142 115-226m-47 226q36-128 124-184m-61 184q38-92 112-127" fill="none"/><path d="M264 293q-43 2-59-36 42-11 64 18m76-32q0-46 44-60 12 44-40 73m73 74q8-46 52-52 2 47-49 66m-130-34q-41 9-64-22 39-17 69 5" fill="#83ad61"/></g>'
  };

  let scene = 'crop';
  if (/hydropon|aeroponic|vertical farming|हाइड्रो|एरोपोनिक|भर्टिकल|लेटुस|पालुङ्गो|grow light/.test(text)) scene = 'hydro';
  else if (/सिँचाइ|irrigat|पानी|water use|water management|सुख्खा|drought/.test(text)) scene = 'water';
  else if (/ग्रीनहाउस|greenhouse|protected farming|टनेल|tomato|टमाटर|capsicum|काँक्रो|vegetable|तरकारी/.test(text)) scene = 'greenhouse';
  else if (/कुखुरा|poultry|broiler|लेयर|दाना व्यवस्थापन/.test(text)) scene = 'poultry';
  else if (/गाईभैंसी|डेरी|दूध|पशुपालन|livestock|dairy|बाख्रा|पशु फार्म|animal/.test(text)) scene = 'livestock';
  else if (/घाँस|fodder|feed|आहार|नेपियर|साइलेज|silage|पराल|hay|एकीकृत कृषि|कृषि अवशेष/.test(text)) scene = 'fodder';
  else if (/शीत भण्डार|cold storage|बजार|market|प्याकेज|ग्रेडिङ|संकलन|supply chain|मूल्य शृङ्खला|ब्रान्डिङ/.test(text)) scene = 'market';
  else if (/जलवायु|climate|soil|माटो|कम्पोस्ट|जैविक मल|वातावरण|दिगो|sustain|परागसेचक|जैविक विविधता/.test(text)) scene = 'soil';
  else if (/लगानी|नाफा|पुँजी|उद्यम|रोजगारी|business plan|business|वित्तीय|आम्दानी|खर्च|साझेदारी|agri-tourism|पर्यटन/.test(text)) scene = 'business';
  else if (/तालिम|training|शिक्षा|ज्ञान|चीन|किसान क्षमता|परामर्श|consultancy/.test(text)) scene = 'education';
  else if (/सेन्सर|sensor|iot|कृत्रिम बुद्धिमत्ता|\bai\b|smart|precision|यान्त्रिकी|उपकरण|digital|प्रविधि|mechanization/.test(text)) scene = 'smart';

  const palette = paletteByCategory[article.category] || paletteByCategory.modern;
  const [sky, field, deep, accent] = palette;
  const offset = (article.id % 5) * 8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="405" viewBox="0 0 720 405" role="img" aria-label="${article.id} ${title.replace(/[&<>"']/g, '')}"><rect width="720" height="405" fill="${sky}"/><circle cx="590" cy="80" r="44" fill="${accent}" opacity=".88"/><path d="M0 245Q170 174 330 231T720 208V405H0Z" fill="${field}"/><path d="M0 299Q180 232 363 294T720 261V405H0Z" fill="${deep}" opacity=".22"/><g opacity=".38" stroke="#fff" stroke-width="3"><path d="M0 329Q186 268 375 327T720 294" fill="none"/><path d="M0 361Q194 302 385 360T720 326" fill="none"/></g><g transform="translate(${offset} 0)">${scenes[scene]}</g><rect x="22" y="22" width="70" height="34" rx="17" fill="#fff" opacity=".88"/><text x="57" y="45" text-anchor="middle" fill="${deep}" font-family="Arial,sans-serif" font-size="16" font-weight="700">${String(article.id).padStart(3, '0')}</text><path d="M620 373h68" stroke="${accent}" stroke-width="7" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};