const ROLE_C={Top:'#e0503e',Jungle:'#3fb950',Mid:'#4b9cff',ADC:'#f0b232',Support:'#c586e0'};
const API={Malphite:'Malphite',Sion:'Sion',Shen:'Shen',Wukong:'MonkeyKing',Vi:'Vi',Viego:'Viego',Nocturne:'Nocturne',Briar:'Briar',Warwick:'Warwick',"Kha'Zix":'Khazix',Annie:'Annie',Orianna:'Orianna',Galio:'Galio',LeBlanc:'Leblanc',Diana:'Diana',Akali:'Akali',Lux:'Lux',Caitlyn:'Caitlyn',Ashe:'Ashe',Jinx:'Jinx',Kalista:'Kalista',"Miss Fortune":'MissFortune',Rell:'Rell',Alistar:'Alistar',Morgana:'Morgana',Thresh:'Thresh',Braum:'Braum',Seraphine:'Seraphine',Yorick:'Yorick',Veigar:'Veigar',Talon:'Talon',Ekko:'Ekko',Yone:'Yone',Twitch:'Twitch',Lissandra:'Lissandra',Maokai:'Maokai',"Tahm Kench":'TahmKench',Smolder:'Smolder'};
const PLAYERS=[
 {name:'Shabir',handle:'TribuIation#EUW',rank:'Gold III',init:'S',roles:['Jungle','ADC'],clash:'ADC',
  pool:[['Kha\'Zix',101,49],['Xerath',40,55],['Jinx',37,49],['Caitlyn',32,50],['Warwick',26,54],['Kalista',15,60],['Ekko',15,60],['Twitch',13,69],['Lissandra',13,69]],
  note:'Jungle main who flexes ADC. Caitlyn = our reliable Clash carry. Kha\'Zix is the dive-comp JG card.'},
 {name:'Harendra',handle:'Merkedi#Neru',rank:'Bronze IV*',init:'H',roles:['Top','Jungle'],clash:'Top',
  pool:[['Malphite',10,40],['Shen',8,50],['Sylas',11,36],['Shyvana',5,60],['Udyr',4,75],['Sion',3,67],['Kai\'Sa',3,67]],
  note:'Widest, shallowest pool — our #1 improvement lever. Collapse to 3 tanks: Malphite / Sion / Shen.'},
 {name:'Steven',handle:'OrionVII#EUW',rank:'Gold IV',init:'St',roles:['Mid'],clash:'Mid',
  pool:[['Lux',68,60],['Mel',67,42],['LeBlanc',36,58],['Annie',20,65],['Diana',13,54],['Yone',12,58],['Veigar',9,67],['Orianna',14,43]],
  note:'Deep, dependable mid main. Annie/Orianna/Galio fit our engage identity perfectly. Bench Yasuo for Clash.'},
 {name:'Eshantha',handle:'Quiet Rapture#SKT',rank:'Gold III · peak Gold I',init:'E',roles:['Support','Mid','Top'],clash:'Support',
  pool:[['Veigar',40,73],['Alistar',25,64],['Anivia',23,52],['Morgana',13,69],['Yorick',13,69],['Rell',7,71],['Seraphine',7,57],['Galio',15,60]],
  note:'Highest peak on the team. Elite engage-support pool = the engine of our #1 comp. Our shot-caller for fights.'},
 {name:'Geeth',handle:'Synister#ezclp',rank:'Gold I 🔥',init:'G',roles:['Jungle','ADC','Mid','Top','Support'],clash:'Jungle',
  pool:[['Viego',13,69],['Talon',10,70],['Shen',6,83],['Lux',5,80],['Briar',9,56],['Maokai',6,67],['Tahm Kench',7,57],['Nocturne',14,50]],
  note:'True all-role flex & best/hottest player. Default jungle (Viego 69%). The swing piece every comp is built around.'}
];
const SEATS=[['Top','Harendra','Merkedi'],['Jungle','Geeth','Synister'],['Mid','Steven','OrionVII'],['ADC','Shabir','TribuIation'],['Support','Eshantha','Quiet Rapture']];
const ORDER5=['Harendra','Geeth','Steven','Shabir','Eshantha'];
