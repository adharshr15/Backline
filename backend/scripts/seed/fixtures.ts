// Hand-authored fixtures for scripts/seed-test-data.ts. Memberships and venue
// reps are spelled out per user (rather than randomized) so every band and
// venue is guaranteed exactly one MANAGER. Everything derived -- follows, shows,
// posts, likes, messages -- is generated from these by plan.ts.

export type CityKey = "austin" | "houston" | "dallas" | "college-station";

export type CraftName =
  | "PHOTOGRAPHER" | "VIDEOGRAPHER" | "PROMOTER" | "SOUND_ENGINEER" | "BOOKER"
  | "TOUR_MANAGER" | "STAGE_MANAGER" | "LIGHTING_TECH" | "DESIGNER" | "MERCH"
  | "JOURNALIST" | "DJ" | "LUTHIER" | "INSTRUCTOR";

export type CityFixture = { key: CityKey; name: string; state: "TX"; lat: number; lng: number };

export type BandFixture = { slug: string; name: string; city: CityKey; genres: string[]; bio: string };

export type VenueFixture = {
  slug: string; name: string; city: CityKey; address: string; capacity: number; diy?: boolean; bio: string;
};

export type UserRole = "musician" | "scene" | "photographer" | "fan";

export type UserFixture = {
  username: string;
  name: string;
  city: CityKey;
  role: UserRole;
  bio: string;
  crafts?: { craft: CraftName; forHire?: boolean; headline?: string }[];
  bands?: [slug: string, role: "MANAGER" | "MEMBER"][];
  venues?: [slug: string, role: "MANAGER" | "REPRESENTATIVE"][];
};

export const CITIES: CityFixture[] = [
  { key: "austin", name: "Austin", state: "TX", lat: 30.2672, lng: -97.7431 },
  { key: "houston", name: "Houston", state: "TX", lat: 29.7604, lng: -95.3698 },
  { key: "dallas", name: "Dallas", state: "TX", lat: 32.7767, lng: -96.797 },
  { key: "college-station", name: "College Station", state: "TX", lat: 30.628, lng: -96.3344 },
];

// ---------------------------------------------------------------------------
// Bands -- the first five/four per city were named by the product owner.
// ---------------------------------------------------------------------------

export const BANDS: BandFixture[] = [
  // Austin
  { slug: "fawn", name: "Fawn", city: "austin", genres: ["dream-pop", "shoegaze"], bio: "Hazy dream pop from East Austin. Loud guitars, soft voices." },
  { slug: "mayfly", name: "Mayfly", city: "austin", genres: ["emo", "math-rock"], bio: "Twinkly emo in odd time signatures. Basement shows forever." },
  { slug: "ritual", name: "Ritual", city: "austin", genres: ["hardcore", "metalcore"], bio: "Austin hardcore. Two-step or go home." },
  { slug: "stab", name: "Stab", city: "austin", genres: ["powerviolence", "hardcore"], bio: "Songs under a minute. Sets under fifteen." },
  { slug: "grocery-bag", name: "Grocery Bag", city: "austin", genres: ["indie-rock", "garage-rock"], bio: "Scrappy indie rock about rent, roommates and HEB." },
  { slug: "cedar-fever", name: "Cedar Fever", city: "austin", genres: ["alt-country", "americana"], bio: "Sad songs for allergy season. Pedal steel on request." },
  { slug: "soft-hex", name: "Soft Hex", city: "austin", genres: ["synth-pop", "post-punk"], bio: "Drum machines and heartbreak." },
  { slug: "barton-static", name: "Barton Static", city: "austin", genres: ["noise-rock", "post-punk"], bio: "Feedback, fuzz and one very tired drummer." },
  { slug: "pale-rodeo", name: "Pale Rodeo", city: "austin", genres: ["psych-rock", "surf-rock"], bio: "Reverb-soaked desert psych." },
  { slug: "lowtide-choir", name: "Lowtide Choir", city: "austin", genres: ["post-rock", "ambient"], bio: "Long instrumental builds. Bring earplugs." },

  // Houston
  { slug: "cement-diver", name: "Cement Diver", city: "houston", genres: ["shoegaze", "grunge"], bio: "Heavy shoegaze from the Bayou City." },
  { slug: "divine-divine", name: "Divine Divine", city: "houston", genres: ["post-punk", "art-pop"], bio: "Angular art-pop. Dance if you want to." },
  { slug: "daze", name: "Daze", city: "houston", genres: ["dream-pop", "bedroom-pop"], bio: "Bedroom pop that outgrew the bedroom." },
  { slug: "glia", name: "Glia", city: "houston", genres: ["emo", "screamo"], bio: "Screamo for the humid months (all of them)." },
  { slug: "tincture", name: "Tincture", city: "houston", genres: ["sludge", "doom-metal"], bio: "Slow, heavy, loud. Gulf Coast sludge." },
  { slug: "bayou-ghost", name: "Bayou Ghost", city: "houston", genres: ["psych-rock", "stoner-metal"], bio: "Fuzz-drenched psych rock." },
  { slug: "humidity", name: "Humidity", city: "houston", genres: ["hardcore", "post-hardcore"], bio: "Houston hardcore. It's always 98 degrees in the pit." },
  { slug: "heights-hymnal", name: "Heights Hymnal", city: "houston", genres: ["singer-songwriter", "folk"], bio: "Solo folk songs from the Heights." },
  { slug: "ship-channel", name: "Ship Channel", city: "houston", genres: ["noise-rock", "industrial"], bio: "Industrial noise rock, like the view from the 610 bridge." },
  { slug: "nightjar", name: "Nightjar", city: "houston", genres: ["latin-rock", "cumbia"], bio: "Rock en español con cumbia de la East End." },

  // Dallas
  { slug: "spurred", name: "Spurred", city: "dallas", genres: ["hardcore", "metalcore"], bio: "Dallas hardcore. Heavy riffs, heavier breakdowns." },
  { slug: "cloverfield", name: "Cloverfield", city: "dallas", genres: ["emo", "pop-punk"], bio: "Pop punk hooks, emo lyrics." },
  { slug: "trauma-ray", name: "Trauma Ray", city: "dallas", genres: ["shoegaze", "grunge"], bio: "Crushing shoegaze from DFW." },
  { slug: "empty-shell-casing", name: "Empty Shell Casing", city: "dallas", genres: ["hardcore", "metal"], bio: "Metallic hardcore." },
  { slug: "trinity-drift", name: "Trinity Drift", city: "dallas", genres: ["dream-pop", "post-rock"], bio: "Slow-motion dream pop along the Trinity." },
  { slug: "glass-lung", name: "Glass Lung", city: "dallas", genres: ["post-punk", "synthwave"], bio: "Cold wave post-punk." },
  { slug: "oak-cliff-casual", name: "Oak Cliff Casual", city: "dallas", genres: ["indie-rock", "power-pop"], bio: "Sunny power pop from across the river." },
  { slug: "mockingbird-hum", name: "Mockingbird Hum", city: "dallas", genres: ["americana", "alt-country"], bio: "Porch songs, mostly solo." },
  { slug: "static-saint", name: "Static Saint", city: "dallas", genres: ["noise-rock", "garage-rock"], bio: "Garage noise from Deep Ellum." },
  { slug: "fair-park-ghosts", name: "Fair Park Ghosts", city: "dallas", genres: ["surf-rock", "garage-rock"], bio: "Haunted surf rock." },

  // College Station
  { slug: "heel", name: "Heel", city: "college-station", genres: ["post-punk", "noise-rock"], bio: "Brazos Valley post-punk." },
  { slug: "minge", name: "Minge", city: "college-station", genres: ["punk", "garage-rock"], bio: "Three chords and a bad attitude." },
  { slug: "memory-ends", name: "Memory Ends", city: "college-station", genres: ["emo", "post-hardcore"], bio: "Emo / post-hardcore from BCS." },
  { slug: "bloodprice", name: "Bloodprice", city: "college-station", genres: ["hardcore", "metalcore"], bio: "Brazos Valley hardcore." },
  { slug: "moonage", name: "Moonage", city: "college-station", genres: ["psych-rock", "stoner-metal"], bio: "Spacey stoner psych." },
  { slug: "brazos-bottom", name: "Brazos Bottom", city: "college-station", genres: ["red-dirt", "country"], bio: "Red dirt country for Northgate Saturdays." },
  { slug: "post-oak", name: "Post Oak", city: "college-station", genres: ["indie-rock", "dream-pop"], bio: "Jangly indie rock." },
  { slug: "wellborn-road", name: "Wellborn Road", city: "college-station", genres: ["folk-punk", "americana"], bio: "Folk punk with a banjo and a grudge." },
  { slug: "maroon-static", name: "Maroon Static", city: "college-station", genres: ["shoegaze", "noise-rock"], bio: "Wall-of-sound shoegaze." },
  { slug: "century-tree", name: "Century Tree", city: "college-station", genres: ["indie-pop", "bedroom-pop"], bio: "Bedroom pop recorded in a dorm closet." },
];

// ---------------------------------------------------------------------------
// Venues -- the first four/five/three/four per city were named by the product
// owner. Addresses are approximate; this is test data.
// ---------------------------------------------------------------------------

export const VENUES: VenueFixture[] = [
  // Austin
  { slug: "pearl-st-co-op", name: "Pearl St. Co-op", city: "austin", address: "2000 Pearl St", capacity: 120, diy: true, bio: "Student co-op hosting house shows in West Campus." },
  { slug: "chess-club", name: "Chess Club", city: "austin", address: "E 7th St", capacity: 200, bio: "Small room, big sound. Checkmate." },
  { slug: "coral-snake", name: "Coral Snake", city: "austin", address: "E Cesar Chavez St", capacity: 80, diy: true, bio: "DIY space in East Austin. All ages, BYOB." },
  { slug: "radio-east", name: "Radio/East", city: "austin", address: "3504 Montopolis Dr", capacity: 600, bio: "Outdoor stage under the oaks." },
  { slug: "mohawk", name: "Mohawk", city: "austin", address: "912 Red River St", capacity: 900, bio: "Indoor/outdoor Red River institution." },
  { slug: "hotel-vegas", name: "Hotel Vegas", city: "austin", address: "1502 E 6th St", capacity: 350, bio: "East Sixth garage rock headquarters." },
  { slug: "cheer-up-charlies", name: "Cheer Up Charlies", city: "austin", address: "900 Red River St", capacity: 400, bio: "Queer-owned bar and venue with a limestone backdrop." },
  { slug: "swan-dive", name: "Swan Dive", city: "austin", address: "615 Red River St", capacity: 250, bio: "Red River club for touring and local acts." },
  { slug: "empire-control-room", name: "Empire Control Room", city: "austin", address: "606 E 7th St", capacity: 600, bio: "Two stages, late nights." },
  { slug: "elysium", name: "Elysium", city: "austin", address: "705 Red River St", capacity: 300, bio: "Goth, darkwave and industrial nights." },

  // Houston
  { slug: "notsuoh", name: "Notsuoh", city: "houston", address: "314 Main St", capacity: 200, bio: "Downtown art bar. Anything goes." },
  { slug: "bad-astronaut", name: "Bad Astronaut", city: "houston", address: "Lockwood Dr", capacity: 250, bio: "Brewery taproom with a stage out back." },
  { slug: "the-end", name: "The End", city: "houston", address: "Near Northside", capacity: 100, diy: true, bio: "DIY warehouse space. All ages." },
  { slug: "white-swan", name: "White Swan", city: "houston", address: "4419 Navigation Blvd", capacity: 250, bio: "East End bar with live music most nights." },
  { slug: "1810-ojeman", name: "1810 Ojeman", city: "houston", address: "1810 Ojeman Rd", capacity: 120, diy: true, bio: "House venue in Spring Branch. Be nice to the neighbors." },
  { slug: "satellite-bar", name: "Satellite Bar", city: "houston", address: "6922 Harrisburg Blvd", capacity: 300, bio: "East End rock club." },
  { slug: "rudyards", name: "Rudyard's", city: "houston", address: "2010 Waugh Dr", capacity: 150, bio: "Upstairs room at a Montrose pub." },
  { slug: "last-concert-cafe", name: "Last Concert Cafe", city: "houston", address: "1403 Nance St", capacity: 400, bio: "Knock on the red door." },
  { slug: "the-secret-group", name: "The Secret Group", city: "houston", address: "2101 Polk St", capacity: 500, bio: "EaDo venue for music and comedy." },
  { slug: "warehouse-live", name: "Warehouse Live", city: "houston", address: "813 St Emanuel St", capacity: 1200, bio: "Three rooms, from 200 to 1,200." },

  // Dallas
  { slug: "witch-house", name: "Witch House", city: "dallas", address: "East Dallas", capacity: 80, diy: true, bio: "DIY house venue. Message for the address." },
  { slug: "rubber-gloves", name: "Rubber Gloves", city: "dallas", address: "E Sycamore St", capacity: 250, bio: "Rehearsal studios and a legendary stage." },
  { slug: "andys", name: "Andy's", city: "dallas", address: "N Locust St", capacity: 200, bio: "Dive bar with a stage in back." },
  { slug: "three-links", name: "Three Links", city: "dallas", address: "2704 Elm St", capacity: 250, bio: "Deep Ellum bar with a patio and a PA." },
  { slug: "club-dada", name: "Club Dada", city: "dallas", address: "2720 Elm St", capacity: 350, bio: "Deep Ellum since 1986." },
  { slug: "deep-ellum-art-co", name: "Deep Ellum Art Co.", city: "dallas", address: "3200 Commerce St", capacity: 600, bio: "Gallery, bar and outdoor stage." },
  { slug: "trees", name: "Trees", city: "dallas", address: "2709 Elm St", capacity: 700, bio: "Historic Deep Ellum rock club." },
  { slug: "sons-of-hermann-hall", name: "Sons of Hermann Hall", city: "dallas", address: "3414 Elm St", capacity: 500, bio: "The oldest dance hall in Dallas." },
  { slug: "the-prophet-bar", name: "The Prophet Bar", city: "dallas", address: "2548 Elm St", capacity: 400, bio: "Two rooms in Deep Ellum." },
  { slug: "double-wide", name: "Double Wide", city: "dallas", address: "3510 Commerce St", capacity: 200, bio: "Trailer-park-themed dive with loud bands." },

  // College Station
  { slug: "the-101", name: "The 101", city: "college-station", address: "101 S Main St", capacity: 200, bio: "Downtown Bryan bar with a small stage." },
  { slug: "camp-house", name: "CAMP House", city: "college-station", address: "Southside", capacity: 90, diy: true, bio: "DIY house shows since forever. All ages." },
  { slug: "the-grand-stafford", name: "The Grand Stafford", city: "college-station", address: "106 S Main St", capacity: 400, bio: "Restored theater in downtown Bryan." },
  { slug: "aggie-park", name: "Aggie Park", city: "college-station", address: "Texas A&M campus", capacity: 1000, bio: "Outdoor stage on campus." },
  { slug: "revolution-cafe", name: "Revolution Café & Bar", city: "college-station", address: "211 S Main St", capacity: 200, bio: "Courtyard shows in downtown Bryan." },
  { slug: "the-palace-theater", name: "The Palace Theater", city: "college-station", address: "216 W 26th St", capacity: 300, bio: "Historic theater, now a concert hall." },
  { slug: "lakeside-icehouse", name: "Lakeside Icehouse", city: "college-station", address: "Harvey Mitchell Pkwy", capacity: 500, bio: "Icehouse with a lakeside stage." },
  { slug: "hurricane-harrys", name: "Hurricane Harry's", city: "college-station", address: "Harvey Rd", capacity: 800, bio: "Big dance hall, bigger country nights." },
  { slug: "the-tap", name: "The Tap", city: "college-station", address: "Harvey Rd", capacity: 250, bio: "Sports bar by day, band bar by night." },
  { slug: "dixie-chicken", name: "Dixie Chicken", city: "college-station", address: "307 University Dr", capacity: 250, bio: "Northgate institution." },
];

// ---------------------------------------------------------------------------
// Users -- 15 per city: 8 musicians, 3 scene workers (booker, promoter, sound
// engineer) who run most of the venues, 1 photographer, 3 pure fans.
// ---------------------------------------------------------------------------

export const USERS: UserFixture[] = [
  // Austin
  { username: "nora.castillo", name: "Nora Castillo", city: "austin", role: "musician", bio: "Guitar/vox in Fawn. I also make gig posters.",
    crafts: [{ craft: "DESIGNER", forHire: true, headline: "Gig posters and album art" }],
    bands: [["fawn", "MANAGER"], ["soft-hex", "MEMBER"], ["lowtide-choir", "MEMBER"]] },
  { username: "elibrandt", name: "Eli Brandt", city: "austin", role: "musician", bio: "Mayfly. Tapping riffs since 2015.",
    bands: [["mayfly", "MANAGER"], ["grocery-bag", "MEMBER"]] },
  { username: "julesokafor", name: "Jules Okafor", city: "austin", role: "musician", bio: "Vocals in Ritual. Drums in Stab.",
    bands: [["ritual", "MANAGER"], ["stab", "MEMBER"]] },
  { username: "marcov", name: "Marco Villarreal", city: "austin", role: "musician", bio: "Stab / Ritual. I run Coral Snake -- DM for shows.",
    bands: [["stab", "MANAGER"], ["ritual", "MEMBER"]], venues: [["coral-snake", "MANAGER"]] },
  { username: "hpruitt", name: "Hannah Pruitt", city: "austin", role: "musician", bio: "Grocery Bag, Fawn, Pale Rodeo. Film photos on the side.",
    crafts: [{ craft: "PHOTOGRAPHER" }],
    bands: [["grocery-bag", "MANAGER"], ["fawn", "MEMBER"], ["pale-rodeo", "MEMBER"]] },
  { username: "devraman", name: "Dev Raman", city: "austin", role: "musician", bio: "Synths in Soft Hex. DJ at Elysium on Thursdays.",
    crafts: [{ craft: "DJ", forHire: true, headline: "Darkwave / post-punk sets" }],
    bands: [["soft-hex", "MANAGER"], ["barton-static", "MEMBER"]] },
  { username: "lukeferris", name: "Luke Ferris", city: "austin", role: "musician", bio: "Cedar Fever and Pale Rodeo. Pedal steel for hire, kinda.",
    bands: [["cedar-fever", "MANAGER"], ["pale-rodeo", "MANAGER"]] },
  { username: "samwhitaker", name: "Sam Whitaker", city: "austin", role: "musician", bio: "Barton Static, Lowtide Choir, Mayfly. I live at Pearl St.",
    bands: [["barton-static", "MANAGER"], ["lowtide-choir", "MANAGER"], ["mayfly", "MEMBER"]], venues: [["pearl-st-co-op", "MANAGER"]] },
  { username: "priyabooks", name: "Priya Desai", city: "austin", role: "scene", bio: "Talent buyer on Red River. Send me your EPK.",
    crafts: [{ craft: "BOOKER", forHire: true, headline: "Booking Red River rooms" }],
    venues: [["mohawk", "MANAGER"], ["swan-dive", "MANAGER"], ["elysium", "MANAGER"], ["chess-club", "REPRESENTATIVE"]] },
  { username: "tonygarzapresents", name: "Tony Garza", city: "austin", role: "scene", bio: "Tony Garza Presents. East side shows every weekend.",
    crafts: [{ craft: "PROMOTER", forHire: true, headline: "Tony Garza Presents" }],
    venues: [["hotel-vegas", "MANAGER"], ["radio-east", "MANAGER"], ["cheer-up-charlies", "REPRESENTATIVE"]] },
  { username: "raelive", name: "Rae Lindqvist", city: "austin", role: "scene", bio: "FOH engineer. I'll make your band sound better than it is.",
    crafts: [{ craft: "SOUND_ENGINEER", forHire: true, headline: "FOH + live recording" }],
    venues: [["empire-control-room", "MANAGER"], ["cheer-up-charlies", "MANAGER"], ["chess-club", "MANAGER"]] },
  { username: "camshoots", name: "Camila Reyes", city: "austin", role: "photographer", bio: "Live music photographer. Pit-dwelling since 2019.",
    crafts: [{ craft: "PHOTOGRAPHER", forHire: true, headline: "Live music photos" }, { craft: "VIDEOGRAPHER" }] },
  { username: "bentran", name: "Ben Tran", city: "austin", role: "fan", bio: "UT student. At a show most nights." },
  { username: "liv.hart", name: "Olivia Hart", city: "austin", role: "fan", bio: "Shoegaze or nothing." },
  { username: "marcusbell", name: "Marcus Bell", city: "austin", role: "fan", bio: "Hardcore kid, grown up. Still in the pit." },

  // Houston
  { username: "diegosalinas", name: "Diego Salinas", city: "houston", role: "musician", bio: "Cement Diver + Nightjar. East End born and raised.",
    bands: [["cement-diver", "MANAGER"], ["nightjar", "MANAGER"], ["bayou-ghost", "MEMBER"]] },
  { username: "tashamonroe", name: "Tasha Monroe", city: "houston", role: "musician", bio: "Divine Divine. Also designing your next flyer.",
    crafts: [{ craft: "DESIGNER", forHire: true, headline: "Flyers, merch, logos" }],
    bands: [["divine-divine", "MANAGER"], ["daze", "MEMBER"]] },
  { username: "kevnguyen", name: "Kevin Nguyen", city: "houston", role: "musician", bio: "Daze. Cement Diver on bass. Shooting on a Contax T2.",
    crafts: [{ craft: "PHOTOGRAPHER" }],
    bands: [["daze", "MANAGER"], ["cement-diver", "MEMBER"]] },
  { username: "aaronpike", name: "Aaron Pike", city: "houston", role: "musician", bio: "Screaming in Glia. Guitar in Humidity.",
    bands: [["glia", "MANAGER"], ["humidity", "MEMBER"]] },
  { username: "lenafischer", name: "Lena Fischer", city: "houston", role: "musician", bio: "Tincture / Ship Channel / Divine Divine. Screen printer.",
    crafts: [{ craft: "MERCH", forHire: true, headline: "Screen printing for bands" }],
    bands: [["tincture", "MANAGER"], ["ship-channel", "MEMBER"], ["divine-divine", "MEMBER"]] },
  { username: "jordanellis", name: "Jordan Ellis", city: "houston", role: "musician", bio: "Bayou Ghost. I host shows at 1810 Ojeman.",
    bands: [["bayou-ghost", "MANAGER"], ["tincture", "MEMBER"]], venues: [["1810-ojeman", "MANAGER"]] },
  { username: "isamoreno", name: "Isa Moreno", city: "houston", role: "musician", bio: "Drums in Humidity, Glia and Nightjar. Yes, all three.",
    bands: [["humidity", "MANAGER"], ["glia", "MEMBER"], ["nightjar", "MEMBER"]] },
  { username: "calebhayes", name: "Caleb Hayes", city: "houston", role: "musician", bio: "Heights Hymnal (solo) and Ship Channel (not solo). I run The End.",
    bands: [["heights-hymnal", "MANAGER"], ["ship-channel", "MANAGER"]], venues: [["the-end", "MANAGER"]] },
  { username: "moniquebooks", name: "Monique Baptiste", city: "houston", role: "scene", bio: "Booking EaDo and beyond.",
    crafts: [{ craft: "BOOKER", forHire: true, headline: "Booking EaDo venues" }],
    venues: [["warehouse-live", "MANAGER"], ["the-secret-group", "MANAGER"], ["bad-astronaut", "MANAGER"], ["last-concert-cafe", "REPRESENTATIVE"]] },
  { username: "rickdelgado", name: "Rick Delgado", city: "houston", role: "scene", bio: "Bayou City Nights. Putting local bands on real stages.",
    crafts: [{ craft: "PROMOTER", forHire: true, headline: "Bayou City Nights" }],
    venues: [["notsuoh", "MANAGER"], ["white-swan", "MANAGER"], ["satellite-bar", "REPRESENTATIVE"]] },
  { username: "gracekim", name: "Grace Kim", city: "houston", role: "scene", bio: "Sound engineer. Ask me about your monitor mix.",
    crafts: [{ craft: "SOUND_ENGINEER", forHire: true, headline: "Live sound, Houston" }],
    venues: [["satellite-bar", "MANAGER"], ["rudyards", "MANAGER"], ["last-concert-cafe", "MANAGER"]] },
  { username: "andreshoots", name: "Andre Wallace", city: "houston", role: "photographer", bio: "Photos + words for a Houston music zine.",
    crafts: [{ craft: "PHOTOGRAPHER", forHire: true, headline: "Live and promo photos" }, { craft: "JOURNALIST", headline: "Writes for a Houston zine" }] },
  { username: "sofiaherrera", name: "Sofia Herrera", city: "houston", role: "fan", bio: "Cumbia + shoegaze. Don't ask." },
  { username: "tbrooks", name: "Tyler Brooks", city: "houston", role: "fan", bio: "Metal and tacos." },
  { username: "meichen", name: "Mei Chen", city: "houston", role: "fan", bio: "Rice grad, still going to basement shows." },

  // Dallas
  { username: "ryancoleman", name: "Ryan Coleman", city: "dallas", role: "musician", bio: "Spurred vox. ESC guitar.",
    bands: [["spurred", "MANAGER"], ["empty-shell-casing", "MEMBER"]] },
  { username: "ashnunez", name: "Ashley Nunez", city: "dallas", role: "musician", bio: "Cloverfield. Photos when I'm not playing.",
    crafts: [{ craft: "PHOTOGRAPHER" }],
    bands: [["cloverfield", "MANAGER"], ["oak-cliff-casual", "MEMBER"]] },
  { username: "brandonleigh", name: "Brandon Leigh", city: "dallas", role: "musician", bio: "Trauma Ray guitar. Pedalboard too big.",
    bands: [["trauma-ray", "MANAGER"], ["trinity-drift", "MEMBER"], ["fair-park-ghosts", "MEMBER"]] },
  { username: "carlosibarra", name: "Carlos Ibarra", city: "dallas", role: "musician", bio: "Empty Shell Casing. Witch House host.",
    bands: [["empty-shell-casing", "MANAGER"], ["spurred", "MEMBER"]], venues: [["witch-house", "MANAGER"]] },
  { username: "haileystone", name: "Hailey Stone", city: "dallas", role: "musician", bio: "Trinity Drift. Designing merch for friends.",
    crafts: [{ craft: "DESIGNER", forHire: true, headline: "Merch and cover art" }],
    bands: [["trinity-drift", "MANAGER"], ["trauma-ray", "MEMBER"]] },
  { username: "quinnparker", name: "Quinn Parker", city: "dallas", role: "musician", bio: "Glass Lung. DJ nights at the Prophet Bar.",
    crafts: [{ craft: "DJ" }],
    bands: [["glass-lung", "MANAGER"], ["static-saint", "MEMBER"]] },
  { username: "joshalbright", name: "Josh Albright", city: "dallas", role: "musician", bio: "Oak Cliff Casual, Mockingbird Hum, Cloverfield.",
    bands: [["oak-cliff-casual", "MANAGER"], ["mockingbird-hum", "MANAGER"], ["cloverfield", "MEMBER"]] },
  { username: "zoemartinez", name: "Zoe Martinez", city: "dallas", role: "musician", bio: "Static Saint, Fair Park Ghosts. I shoot music videos.",
    crafts: [{ craft: "VIDEOGRAPHER", forHire: true, headline: "Music videos on a budget" }],
    bands: [["static-saint", "MANAGER"], ["fair-park-ghosts", "MANAGER"], ["glass-lung", "MEMBER"]] },
  { username: "derekwalsh", name: "Derek Walsh", city: "dallas", role: "scene", bio: "Booking Deep Ellum.",
    crafts: [{ craft: "BOOKER", forHire: true, headline: "Booking Deep Ellum" }],
    venues: [["trees", "MANAGER"], ["club-dada", "MANAGER"], ["three-links", "MANAGER"]] },
  { username: "brittanycole", name: "Brittany Cole", city: "dallas", role: "scene", bio: "Promoter. If it's loud, I'm into it.",
    crafts: [{ craft: "PROMOTER", forHire: true, headline: "Loud shows in Dallas" }],
    venues: [["deep-ellum-art-co", "MANAGER"], ["the-prophet-bar", "MANAGER"], ["andys", "MANAGER"], ["trees", "REPRESENTATIVE"]] },
  { username: "hectorruiz", name: "Hector Ruiz", city: "dallas", role: "scene", bio: "Sound guy. Twenty years of Deep Ellum ringing in my ears.",
    crafts: [{ craft: "SOUND_ENGINEER", forHire: true, headline: "FOH, DFW" }],
    venues: [["sons-of-hermann-hall", "MANAGER"], ["double-wide", "MANAGER"], ["rubber-gloves", "MANAGER"], ["club-dada", "REPRESENTATIVE"]] },
  { username: "ninapatel", name: "Nina Patel", city: "dallas", role: "photographer", bio: "Concert photographer and writer.",
    crafts: [{ craft: "PHOTOGRAPHER", forHire: true, headline: "Concert photography" }, { craft: "JOURNALIST" }] },
  { username: "chrisdunn", name: "Chris Dunn", city: "dallas", role: "fan", bio: "SMU. Always at Three Links." },
  { username: "mayaj", name: "Maya Johnson", city: "dallas", role: "fan", bio: "Emo revival survivor." },
  { username: "evanscott", name: "Evan Scott", city: "dallas", role: "fan", bio: "Here for the hardcore." },

  // College Station
  { username: "garrettlyle", name: "Garrett Lyle", city: "college-station", role: "musician", bio: "Heel. Maroon Static. Class of '25.",
    bands: [["heel", "MANAGER"], ["maroon-static", "MEMBER"]] },
  { username: "kaylabenson", name: "Kayla Benson", city: "college-station", role: "musician", bio: "Minge vocals. Memory Ends bass.",
    bands: [["minge", "MANAGER"], ["memory-ends", "MEMBER"]] },
  { username: "matthuang", name: "Matt Huang", city: "college-station", role: "musician", bio: "Memory Ends + Bloodprice. Photos of my friends' bands.",
    crafts: [{ craft: "PHOTOGRAPHER" }],
    bands: [["memory-ends", "MANAGER"], ["bloodprice", "MEMBER"]] },
  { username: "tannerreed", name: "Tanner Reed", city: "college-station", role: "musician", bio: "Bloodprice. CAMP House resident.",
    bands: [["bloodprice", "MANAGER"], ["minge", "MEMBER"]], venues: [["camp-house", "MANAGER"]] },
  { username: "alliegomez", name: "Allie Gomez", city: "college-station", role: "musician", bio: "Moonage. Viz grad making band art.",
    crafts: [{ craft: "DESIGNER", forHire: true, headline: "Band art and flyers" }],
    bands: [["moonage", "MANAGER"], ["post-oak", "MEMBER"]] },
  { username: "codywheeler", name: "Cody Wheeler", city: "college-station", role: "musician", bio: "Brazos Bottom. Banjo in Wellborn Road.",
    bands: [["brazos-bottom", "MANAGER"], ["wellborn-road", "MEMBER"]] },
  { username: "sarahkowalski", name: "Sarah Kowalski", city: "college-station", role: "musician", bio: "Post Oak, Century Tree, and Heel on keys.",
    bands: [["post-oak", "MANAGER"], ["century-tree", "MANAGER"], ["heel", "MEMBER"]] },
  { username: "jakemorrison", name: "Jake Morrison", city: "college-station", role: "musician", bio: "Wellborn Road, Maroon Static, Moonage. Merch table guy.",
    crafts: [{ craft: "MERCH" }],
    bands: [["wellborn-road", "MANAGER"], ["maroon-static", "MANAGER"], ["moonage", "MEMBER"]] },
  { username: "laurenprice", name: "Lauren Price", city: "college-station", role: "scene", bio: "Booking downtown Bryan.",
    crafts: [{ craft: "BOOKER", forHire: true, headline: "Booking downtown Bryan" }],
    venues: [["the-grand-stafford", "MANAGER"], ["the-palace-theater", "MANAGER"], ["the-101", "MANAGER"]] },
  { username: "miguelsoto", name: "Miguel Soto", city: "college-station", role: "scene", bio: "Northgate shows. Hit me up for a slot.",
    crafts: [{ craft: "PROMOTER", forHire: true, headline: "Northgate shows" }],
    venues: [["hurricane-harrys", "MANAGER"], ["the-tap", "MANAGER"], ["dixie-chicken", "MANAGER"], ["the-101", "REPRESENTATIVE"]] },
  { username: "emmaclarke", name: "Emma Clarke", city: "college-station", role: "scene", bio: "Live sound for BCS.",
    crafts: [{ craft: "SOUND_ENGINEER", forHire: true, headline: "Live sound, Brazos Valley" }],
    venues: [["revolution-cafe", "MANAGER"], ["lakeside-icehouse", "MANAGER"], ["aggie-park", "MANAGER"]] },
  { username: "noahfriedman", name: "Noah Friedman", city: "college-station", role: "photographer", bio: "Photo + video for bands in the Brazos Valley.",
    crafts: [{ craft: "PHOTOGRAPHER", forHire: true, headline: "Photo + video packages" }, { craft: "VIDEOGRAPHER", forHire: true }] },
  { username: "racheladams", name: "Rachel Adams", city: "college-station", role: "fan", bio: "Aggie. Northgate every Friday." },
  { username: "luiscantu", name: "Luis Cantu", city: "college-station", role: "fan", bio: "Driving to Houston for shows since high school." },
  { username: "megantate", name: "Megan Tate", city: "college-station", role: "fan", bio: "Country by day, hardcore by night." },
];

/** Backyards and living rooms for shows with no venue profile. */
export const DIY_SPOTS: Record<CityKey, { name: string; address: string }[]> = {
  austin: [
    { name: "The Treehouse (house show)", address: "Hyde Park -- DM for address" },
    { name: "Burnet Rd Backyard", address: "North Loop -- DM for address" },
  ],
  houston: [
    { name: "The Bunker (house show)", address: "Third Ward -- DM for address" },
    { name: "Garage on Harvard", address: "The Heights -- DM for address" },
  ],
  dallas: [
    { name: "The Den (house show)", address: "Lower Greenville -- DM for address" },
    { name: "Bishop Arts Backyard", address: "Oak Cliff -- DM for address" },
  ],
  "college-station": [
    { name: "The Barn (house show)", address: "Wellborn -- DM for address" },
    { name: "Southside Porch", address: "Southside -- DM for address" },
  ],
};

export const SHOW_NOTES = [
  "All ages.",
  "21+. Bring ID.",
  "$10 at the door, nobody turned away for lack of funds.",
  "$5 before 9pm.",
  "Free show! Tip the bands.",
  "Early show, out by 11.",
];

// ---------------------------------------------------------------------------
// Text pools. {band}, {venue}, {city}, {friend} are filled in by plan.ts.
// ---------------------------------------------------------------------------

export const CAPTIONS = {
  band: [
    "New merch just landed. Come find us at the table.",
    "Practice space vibes. New songs coming soon.",
    "Thank you {city}! That was one of our favorite sets ever.",
    "Tracking drums this weekend. Record out this winter.",
    "Van is fixed (for now). See you on the road.",
    "Shoutout to {friend} for the support on the last one.",
    "Rehearsing the new set. It's heavier.",
    "We made a zine. Free at every show.",
    "Loading out after a sweaty one.",
  ],
  venue: [
    "Fresh coat of paint on the stage. Come see it.",
    "Bar's stocked and the PA is loud. See you this weekend.",
    "New patio lights are up.",
    "Booking for next month -- send us your band!",
    "Thanks to everyone who came out last night.",
    "Sound check for tonight's bill. Doors soon.",
  ],
  photographer: [
    "{band} at {venue}. What a set.",
    "Some favorites from last weekend with {band}.",
    "Pit shots from {venue}.",
    "{band} live in {city}. Shot on 35mm.",
    "Crowd surfers of {city}, I salute you.",
    "Golden hour load-in with {band}.",
  ],
  user: [
    "Best show I've been to all year. {band} ruled.",
    "Record haul from the merch table.",
    "Ears still ringing from {venue}.",
    "Me and the crew before {band}.",
    "Can't wait for the next one.",
  ],
};

export const COMMENTS = [
  "so good!!",
  "wish I was there",
  "see you at the next one",
  "this rules",
  "🔥🔥🔥",
  "legends",
  "when's the next show?",
  "need this on a shirt",
  "incredible shot",
  "best night",
  "🖤",
  "loud as hell, loved it",
];

/** Message scripts. Speaker "a" opens the thread. */
export type ScriptLine = { from: "a" | "b"; text: string };

export const BOOKING_SCRIPT: ScriptLine[] = [
  { from: "a", text: "Hey! We're {band} from {city}. Any open dates at {venue} coming up? We'd love to put a bill together with some friends." },
  { from: "b", text: "Hey {band}! We've got {date1} and {date2} open right now. What's your usual draw?" },
  { from: "a", text: "Usually 60-80 locally. {date1} works great for us." },
  { from: "b", text: "Perfect, penciling you in for {date1}. Doors at 8, three-band bill. I'll send the advance sheet this week." },
  { from: "a", text: "Amazing, thank you!! We'll start promoting once it's confirmed." },
];

export const VENUE_OUTREACH_SCRIPT: ScriptLine[] = [
  { from: "b", text: "Hi {band}, we loved your last set. Want to support a touring act at {venue} on {date1}?" },
  { from: "a", text: "Yes! What's the deal?" },
  { from: "b", text: "Guarantee plus a door split, 30 min set. Load-in at 6." },
  { from: "a", text: "We're in. Can we bring merch?" },
  { from: "b", text: "Of course. Merch table's by the front door." },
  { from: "a", text: "🙌 see you then" },
];

export const PROMOTER_SCRIPT: ScriptLine[] = [
  { from: "a", text: "Hey {band}, I'm putting together a show at {venue} on {date1}. Want the opening slot?" },
  { from: "b", text: "Oh hell yeah. Who else is on it?" },
  { from: "a", text: "{friend} is headlining. Door split, $10 cover." },
  { from: "b", text: "Count us in!" },
];

export const PHOTOGRAPHER_SCRIPT: ScriptLine[] = [
  { from: "a", text: "Hey! Loved your set last month. Mind if I shoot your next show?" },
  { from: "b", text: "Yes please!! We desperately need new photos." },
  { from: "a", text: "Sweet, I'll be in the pit. I'll send a gallery the week after." },
  { from: "b", text: "You're the best. I'll put you on the list." },
];

export const FAN_SCRIPT: ScriptLine[] = [
  { from: "a", text: "You going to the {band} show at {venue}?" },
  { from: "b", text: "Obviously. Want to carpool?" },
  { from: "a", text: "Yes. I'll pick you up at 7." },
  { from: "b", text: "Bring earplugs this time lol" },
  { from: "a", text: "never" },
];

/** Buyer ("a") asking a seller ("b") about a listing, attached to the first message. */
export const LISTING_SCRIPT: ScriptLine[] = [
  { from: "a", text: "Hi! Is the {listing} still available?" },
  { from: "b", text: "Yep, still have it. Want to come check it out?" },
  { from: "a", text: "Yes! Any flexibility on price?" },
  { from: "b", text: "I can knock a little off if you pick up this week." },
  { from: "a", text: "Deal. Does Saturday afternoon work?" },
  { from: "b", text: "Perfect, I'll send you the address." },
];

// ---------------------------------------------------------------------------
// Marketplace listings -- 10 per city. Categories come from the app's
// GEAR_CATEGORIES (frontend/backline/services/listing.service.ts), plus the odd
// custom one the picker allows. The first listing in each city is user-owned:
// plan.ts opens a buyer conversation about it. Rent prices are per day.
// ---------------------------------------------------------------------------

export type ListingFixture = {
  city: CityKey;
  owner: ["user" | "band" | "venue", string];
  title: string;
  description: string;
  category: string | null;
  kind: "RENT" | "SALE";
  /** null = "DM for price". */
  price: number | null;
  openToTrades?: boolean;
  status?: "ACTIVE" | "CLAIMED" | "CLOSED";
};

export const LISTINGS: ListingFixture[] = [
  // Austin
  { city: "austin", owner: ["user", "nora.castillo"], title: "Fender Jazzmaster (MIM, 2019)", category: "Guitar", kind: "SALE", price: 750, openToTrades: true,
    description: "Sunburst Player Jazzmaster. New strings, set up last month. A few dings on the back, plays great. Open to trades for a baritone." },
  { city: "austin", owner: ["band", "barton-static"], title: "Big Muff + ProCo RAT bundle", category: "Pedals / FX", kind: "SALE", price: 120,
    description: "Our old fuzz and distortion. Both work perfectly, Velcro on the bottom. Selling as a pair." },
  { city: "austin", owner: ["user", "devraman"], title: "Korg Minilogue XD", category: "Keys / Synth", kind: "SALE", price: 450, openToTrades: true,
    description: "Barely gigged. Comes with the power supply and a soft case. Would trade for a drum machine." },
  { city: "austin", owner: ["venue", "chess-club"], title: "Ampeg SVT + 8x10 backline", category: "Amp", kind: "RENT", price: 60,
    description: "House bass rig available to rent for off-site shows. Pickup and return on Red River." },
  { city: "austin", owner: ["user", "raelive"], title: "Shure SM58s (set of 4)", category: "Microphones", kind: "RENT", price: 25,
    description: "Four SM58s with clips and XLRs. Perfect for house shows. Deposit required." },
  { city: "austin", owner: ["band", "ritual"], title: "Orange Rockerverb 50 head", category: "Amp", kind: "SALE", price: 1100, openToTrades: true,
    description: "Mk III, footswitch included. Loud as hell. Would consider trades for a Marshall head." },
  { city: "austin", owner: ["user", "samwhitaker"], title: "Tama Imperialstar 5-piece kit", category: "Drums", kind: "RENT", price: 50,
    description: "Shell pack plus hardware. Rent it for your show or your out-of-town band's tour stop." },
  { city: "austin", owner: ["venue", "mohawk"], title: "QSC K12.2 PA pair + mixer", category: "PA / Speakers", kind: "RENT", price: 150,
    description: "Two powered tops, stands and a 12-channel mixer. Weekend rate available." },
  { city: "austin", owner: ["user", "camshoots"], title: "LED uplighting kit (8 pars)", category: "Lighting", kind: "RENT", price: 40,
    description: "Eight battery LED pars with a remote. Makes any living room look like a venue." },
  { city: "austin", owner: ["user", "elibrandt"], title: "Fender hardshell case", category: "Cases / Stands", kind: "SALE", price: 60, status: "CLAIMED",
    description: "Fits a Strat or Tele. Latches all work. Claimed, pending pickup." },

  // Houston
  { city: "houston", owner: ["user", "diegosalinas"], title: "Fender Mustang Bass (reissue)", category: "Bass", kind: "SALE", price: 600, openToTrades: true,
    description: "Short scale, competition stripe. Flatwounds on it. Trades welcome." },
  { city: "houston", owner: ["band", "tincture"], title: "Sunn Model T reissue", category: "Amp", kind: "SALE", price: 1800,
    description: "100W of doom. Recently serviced. Local pickup only, it weighs a ton." },
  { city: "houston", owner: ["user", "gracekim"], title: "Behringer X32 Rack mixer", category: "PA / Speakers", kind: "RENT", price: 75,
    description: "Digital mixer with iPad control. I can come run it for you for an extra fee." },
  { city: "houston", owner: ["venue", "warehouse-live"], title: "Moving head lights (x4)", category: "Lighting", kind: "RENT", price: 120,
    description: "Four moving heads with DMX controller. Available on nights we're dark." },
  { city: "houston", owner: ["user", "kevnguyen"], title: "Roland Juno-60", category: "Keys / Synth", kind: "SALE", price: null, openToTrades: true,
    description: "Vintage Juno, fully recapped. Serious offers only. DM for price." },
  { city: "houston", owner: ["band", "cement-diver"], title: "Boss DD-7 + TC Hall of Fame", category: "Pedals / FX", kind: "SALE", price: 150,
    description: "Delay and reverb we replaced with a multi-FX. Both mint." },
  { city: "houston", owner: ["user", "isamoreno"], title: "Zildjian K cymbal pack", category: "Drums", kind: "SALE", price: 700, openToTrades: true,
    description: "14\" hats, 18\" crash, 20\" ride. No cracks. Might trade for a snare." },
  { city: "houston", owner: ["user", "lenafischer"], title: "4-color screen printing press", category: "Merch", kind: "RENT", price: 30,
    description: "Print your own shirts. I'll show you the ropes the first time." },
  { city: "houston", owner: ["venue", "satellite-bar"], title: "House drum kit backline", category: "Drums", kind: "RENT", price: 45,
    description: "Kit, hardware and throne. Bring your own snare and cymbals." },
  { city: "houston", owner: ["user", "calebhayes"], title: "Martin D-18 acoustic", category: "Guitar", kind: "SALE", price: 1500, status: "CLAIMED",
    description: "Beautiful dreadnought with a hardshell case. Claimed, thanks all." },

  // Dallas
  { city: "dallas", owner: ["user", "brandonleigh"], title: "Strymon BigSky", category: "Pedals / FX", kind: "SALE", price: 380, openToTrades: true,
    description: "Shoegaze reverb machine. Selling because I bought a second one (don't ask)." },
  { city: "dallas", owner: ["band", "spurred"], title: "Mesa Dual Rectifier head", category: "Amp", kind: "SALE", price: 1200,
    description: "3-channel Dual Rec. Tubes replaced this year. Heavy riffs included." },
  { city: "dallas", owner: ["user", "quinnparker"], title: "Pioneer DDJ-FLX6", category: "DJ Gear", kind: "SALE", price: 500,
    description: "4-deck controller, works with Rekordbox and Serato. Bag included." },
  { city: "dallas", owner: ["venue", "trees"], title: "Line array PA (weekend)", category: "PA / Speakers", kind: "RENT", price: 400,
    description: "Festival-size rig for outdoor shows. Delivery and a tech available for a fee." },
  { city: "dallas", owner: ["user", "hectorruiz"], title: "Drum mic kit (7 mics)", category: "Microphones", kind: "RENT", price: 40,
    description: "Kick, snare, toms and overheads, with clips. Great for live recordings." },
  { city: "dallas", owner: ["user", "zoemartinez"], title: "Aputure 300d + light stands", category: "Lighting", kind: "RENT", price: 50,
    description: "Video light for music videos and band photos. Softbox included." },
  { city: "dallas", owner: ["band", "glass-lung"], title: "Roland TR-8S drum machine", category: "Keys / Synth", kind: "SALE", price: 520, openToTrades: true,
    description: "Our old drummer. Would trade for a polysynth." },
  { city: "dallas", owner: ["user", "joshalbright"], title: "Gibson SG Standard", category: "Guitar", kind: "SALE", price: 1100, openToTrades: true,
    description: "Cherry red, 2016. Gig bag included. Trades considered." },
  { city: "dallas", owner: ["venue", "sons-of-hermann-hall"], title: "Upright piano -- free to a good home", category: "Keys / Synth", kind: "SALE", price: 0,
    description: "Needs tuning and four strong friends. You haul it, it's yours." },
  { city: "dallas", owner: ["user", "ashnunez"], title: "Road cases (set of 3)", category: "Cases / Stands", kind: "SALE", price: 200, status: "CLAIMED",
    description: "Heavy-duty cases for a head, a pedalboard and cables. Claimed." },

  // College Station
  { city: "college-station", owner: ["user", "garrettlyle"], title: "Fender Hot Rod Deluxe", category: "Amp", kind: "SALE", price: 450, openToTrades: true,
    description: "40W 1x12 combo. Great clean tone. Open to trades for a smaller amp." },
  { city: "college-station", owner: ["band", "bloodprice"], title: "Ampeg PF-800 + 4x10 cab", category: "Amp", kind: "SALE", price: 650,
    description: "Bass rig. Light head, loud cab. Selling as a pair." },
  { city: "college-station", owner: ["user", "emmaclarke"], title: "Portable PA for house shows", category: "PA / Speakers", kind: "RENT", price: 80,
    description: "Two tops, a sub and a small mixer. Fits in a hatchback." },
  { city: "college-station", owner: ["venue", "aggie-park"], title: "Stage lighting rig", category: "Lighting", kind: "RENT", price: 200,
    description: "Truss, 12 pars and a controller. Campus orgs welcome." },
  { city: "college-station", owner: ["user", "jakemorrison"], title: "Merch display grid + lights", category: "Cases / Stands", kind: "SALE", price: 80,
    description: "Folding grid wall, hooks and a clip light. Your merch table will look pro." },
  { city: "college-station", owner: ["user", "noahfriedman"], title: "Zoom H6 recorder", category: "Recording", kind: "RENT", price: 20,
    description: "Record your set. Comes with an SD card and the X/Y capsule." },
  { city: "college-station", owner: ["band", "moonage"], title: "Electro-Harmonix POG2", category: "Pedals / FX", kind: "SALE", price: 200, openToTrades: true,
    description: "Octave madness. Trade for a phaser?" },
  { city: "college-station", owner: ["user", "codywheeler"], title: "Deering Goodtime banjo", category: "Banjo", kind: "SALE", price: 400, openToTrades: true,
    description: "5-string with a resonator. Wellborn Road-tested." },
  { city: "college-station", owner: ["venue", "camp-house"], title: "XLR + instrument cable bundle", category: "Cables / Accessories", kind: "RENT", price: 10,
    description: "Twenty cables in a bin. Please return them coiled." },
  { city: "college-station", owner: ["user", "sarahkowalski"], title: "Nord Electro 6D", category: "Keys / Synth", kind: "SALE", price: 1400, status: "CLAIMED",
    description: "61-key, gig bag and sustain pedal. Claimed, sorry!" },
];
