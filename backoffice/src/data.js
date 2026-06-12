// Fallback demo data used when the API is unavailable.

export const deliveries = [
  { id:'KG-2841', vendor:'Awa N.',     vAv:'g', deliverer:'Jean K.',  dAv:'o', from:'Akwa',      to:'Bonapriso', type:'Express',  typeTone:'orange', price:'2 500', statusKey:'delivered', statusTone:'ok'   },
  { id:'KG-2840', vendor:'Marie E.',   vAv:'p', deliverer:'Paul N.',  dAv:'g', from:'Deïdo',     to:'Akwa',      type:'Standard', typeTone:'mut',    price:'1 800', statusKey:'inTransit', statusTone:'info' },
  { id:'KG-2839', vendor:'Tobias M.',  vAv:'b', deliverer:'—',        dAv:'k', from:'Bonabéri',  to:'New-Bell',  type:'Standard', typeTone:'mut',    price:'2 100', statusKey:'pending',   statusTone:'warn' },
  { id:'KG-2838', vendor:'Sandrine F.',vAv:'k', deliverer:'Eric M.',  dAv:'b', from:'Akwa',      to:'Deïdo',     type:'VVIP',     typeTone:'info',   price:'4 200', statusKey:'delivered', statusTone:'ok'   },
  { id:'KG-2837', vendor:'Awa N.',     vAv:'g', deliverer:'Jean K.',  dAv:'o', from:'Bonapriso', to:'Akwa',      type:'Express',  typeTone:'orange', price:'3 200', statusKey:'inTransit', statusTone:'info' },
  { id:'KG-2836', vendor:'Marie E.',   vAv:'p', deliverer:'Paul N.',  dAv:'g', from:'New-Bell',  to:'Bonabéri',  type:'Standard', typeTone:'mut',    price:'1 500', statusKey:'issue',     statusTone:'dng'  },
  { id:'KG-2835', vendor:'Tobias M.',  vAv:'b', deliverer:'Eric M.',  dAv:'b', from:'Deïdo',     to:'Akwa',      type:'Standard', typeTone:'mut',    price:'1 900', statusKey:'delivered', statusTone:'ok'   },
  { id:'KG-2834', vendor:'Sandrine F.',vAv:'k', deliverer:'Jean K.',  dAv:'o', from:'Akwa',      to:'Bonapriso', type:'Express',  typeTone:'orange', price:'2 800', statusKey:'cancelled', statusTone:'mut'  },
];

export const vendors = [
  { name:'Awa Nkeng',     handle:'awa.boutique',    av:'g', phone:'+237 6•• ••• 412', kyc:'verified', deliveries:128, rating:'4.8', status:'active'    },
  { name:'Marie Eboa',    handle:'mariefashion',     av:'p', phone:'+237 6•• ••• 778', kyc:'verified', deliveries:96,  rating:'4.9', status:'active'    },
  { name:'Tobias Mbarga', handle:'tech.douala',      av:'b', phone:'+237 6•• ••• 203', kyc:'pending',  deliveries:41,  rating:'4.6', status:'active'    },
  { name:'Sandrine Fouda',handle:'sandycosmetics',   av:'k', phone:'+237 6•• ••• 591', kyc:'verified', deliveries:213, rating:'4.7', status:'suspended' },
];

export const deliverersData = [
  { name:'Jean Kamga',  rating:'4.9', av:'o', vehicle:'Moto · CE 482 AB',     kyc:'verified', trips:412, accept:'92%', wallet:'128 500', status:'online'  },
  { name:'Paul Ndongo', rating:'4.7', av:'g', vehicle:'Tricycle · LT 119 CD', kyc:'verified', trips:289, accept:'88%', wallet:'74 200',  status:'offline' },
  { name:'Eric Manga',  rating:'4.4', av:'b', vehicle:'Voiture · CE 770 KK',  kyc:'rejected', trips:53,  accept:'71%', wallet:'12 000',  status:'review'  },
];

export const transactions = [
  { id:'TX-90412', kind:'commission', party:'KG-2841', amount:'+75',      amountTone:'pos', operator:'—'     },
  { id:'TX-90411', kind:'payout',     party:'Jean K.', amount:'+425',     amountTone:'',    operator:'MTN'   },
  { id:'TX-90408', kind:'withdrawal', party:'Paul N.', amount:'–45 000',  amountTone:'neg', operator:'Orange'},
  { id:'TX-90405', kind:'commission', party:'KG-2838', amount:'+54',      amountTone:'pos', operator:'—'     },
  { id:'TX-90401', kind:'payout',     party:'Awa N.',  amount:'+1 800',   amountTone:'',    operator:'MTN'   },
];

export const withdrawalsData = [
  { name:'Paul Ndongo', amount:'45 000',  operator:'Orange Money · +237 6•• 778', action:'pay'  },
  { name:'Jean Kamga',  amount:'120 000', operator:'MTN MoMo · +237 6•• 412',    action:'pay'  },
  { name:'Eric Manga',  amount:'12 000',  operator:'MTN MoMo · +237 6•• 203',    action:'hold' },
];

export const zonesData = [
  { name:'Akwa',      count:842, x:30, y:34, tone:''  },
  { name:'Bonapriso', count:689, x:58, y:50, tone:''  },
  { name:'Bonabéri',  count:531, x:22, y:66, tone:'o' },
  { name:'Deïdo',     count:410, x:70, y:28, tone:''  },
  { name:'New-Bell',  count:298, x:48, y:74, tone:'o' },
];

export const pricingRules = [
  { type:'Standard', tone:'mut',    base:'1 000', perKm:'250' },
  { type:'Express',  tone:'orange', base:'1 800', perKm:'400' },
  { type:'VVIP',     tone:'info',   base:'3 000', perKm:'600' },
];

export const tickets = [
  {
    id:'#T-1042', who:'Marie Eboa', av:'p',
    subject:{ fr:'Colis non reçu – KG-2836', en:'Parcel not received – KG-2836' },
    priority:{ fr:'Élevée', en:'High' }, pTone:'dng',
    msgs:[
      { from:'client', text:{ fr:"Mon client n'a jamais reçu le colis KG-2836.", en:'My client never received parcel KG-2836.' } },
      { from:'admin',  text:{ fr:'Bonjour Marie, nous ouvrons une enquête avec le livreur Paul N.', en:'Hi Marie, we are opening an investigation with deliverer Paul N.' } },
    ],
  },
  {
    id:'#T-1041', who:'Jean Kamga', av:'o',
    subject:{ fr:'Retrait MoMo bloqué', en:'MoMo withdrawal blocked' },
    priority:{ fr:'Moyenne', en:'Medium' }, pTone:'warn',
    msgs:[{ from:'client', text:{ fr:'Mon retrait de 120 000 est en attente depuis 2h.', en:'My 120,000 withdrawal has been pending for 2h.' } }],
  },
  {
    id:'#T-1039', who:'Awa Nkeng', av:'g',
    subject:{ fr:'Question sur la commission', en:'Question about commission' },
    priority:{ fr:'Basse', en:'Low' }, pTone:'mut',
    msgs:[{ from:'client', text:{ fr:'Comment est calculée la commission de 3% ?', en:'How is the 3% commission calculated?' } }],
  },
  {
    id:'#T-1037', who:'Eric Manga', av:'b',
    subject:{ fr:'KYC rejeté à tort', en:'KYC wrongly rejected' },
    priority:{ fr:'Moyenne', en:'Medium' }, pTone:'warn',
    msgs:[{ from:'client', text:{ fr:"Ma pièce a été rejetée alors qu'elle est valide.", en:'My ID was rejected but it is valid.' } }],
  },
  {
    id:'#T-1035', who:'Sandrine F.', av:'k',
    subject:{ fr:'Compte suspendu', en:'Account suspended' },
    priority:{ fr:'Élevée', en:'High' }, pTone:'dng',
    msgs:[{ from:'client', text:{ fr:'Pourquoi mon compte vendeur est-il suspendu ?', en:'Why is my vendor account suspended?' } }],
  },
];
