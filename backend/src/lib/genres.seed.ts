/**
 * The canonical genre taxonomy.
 *
 * Single source of truth for scripts/seed-genres.ts (dev/prod) and
 * tests/helpers.ts::seedGenres() (test DB, re-seeded per suite) -- importing it
 * in both is what stops the two from drifting.
 *
 * `aliases` exist so the strings users and the legacy free-text Band.genre column
 * actually contain resolve to the right row. Every label in the shipped
 * GenreFilterChips resolves through this list: "R&B" via soul-rnb, "Indie" via
 * indie-rock. That is the compatibility requirement for /bands?genre=.
 *
 * Two judgment calls worth revisiting: `rap` is an alias of hip-hop rather than a
 * sibling, and `indie` maps to indie-rock rather than indie-pop. The latin branch
 * is deliberately deep -- Houston and Texas have large Tejano and corridos scenes
 * that a generic taxonomy erases.
 */
export type GenreSeed = {
  slug: string;
  name: string;
  parent?: string;
  aliases?: string[];
  sortOrder?: number;
};

export const GENRE_SEED: GenreSeed[] = [
  // Roots
  { slug: "rock", name: "Rock", sortOrder: 10 },
  { slug: "punk", name: "Punk", sortOrder: 20, aliases: ["punk rock"] },
  { slug: "metal", name: "Metal", sortOrder: 30, aliases: ["heavy metal"] },
  { slug: "hip-hop", name: "Hip-Hop", sortOrder: 40, aliases: ["hip hop", "hiphop", "rap"] },
  { slug: "electronic", name: "Electronic", sortOrder: 50, aliases: ["electronica", "edm", "electronic dance music"] },
  { slug: "pop", name: "Pop", sortOrder: 60 },
  { slug: "folk", name: "Folk", sortOrder: 70, aliases: ["acoustic"] },
  { slug: "country", name: "Country", sortOrder: 80 },
  { slug: "jazz", name: "Jazz", sortOrder: 90 },
  { slug: "soul-rnb", name: "Soul & R&B", sortOrder: 100, aliases: ["r&b", "rnb", "r and b", "rhythm and blues", "soul"] },
  { slug: "blues", name: "Blues", sortOrder: 110 },
  { slug: "experimental", name: "Experimental", sortOrder: 120, aliases: ["avant-garde", "avant garde"] },
  { slug: "latin", name: "Latin", sortOrder: 130 },
  { slug: "global", name: "Global", sortOrder: 140, aliases: ["world", "world music"] },
  { slug: "classical", name: "Classical", sortOrder: 150 },

  // Rock
  { slug: "indie-rock", name: "Indie Rock", parent: "rock", aliases: ["indie"] },
  { slug: "alt-rock", name: "Alternative Rock", parent: "rock", aliases: ["alternative", "alt rock", "alternative rock"] },
  { slug: "garage-rock", name: "Garage Rock", parent: "rock", aliases: ["garage"] },
  { slug: "psych-rock", name: "Psych Rock", parent: "rock", aliases: ["psychedelic", "psychedelic rock", "psych"] },
  { slug: "shoegaze", name: "Shoegaze", parent: "rock", aliases: ["shoe gaze", "nugaze", "nu-gaze", "gaze"] },
  { slug: "dream-pop", name: "Dream Pop", parent: "rock", aliases: ["dreampop"] },
  { slug: "post-rock", name: "Post-Rock", parent: "rock", aliases: ["post rock", "postrock"] },
  { slug: "math-rock", name: "Math Rock", parent: "rock", aliases: ["math"] },
  { slug: "noise-rock", name: "Noise Rock", parent: "rock" },
  { slug: "grunge", name: "Grunge", parent: "rock" },
  { slug: "surf-rock", name: "Surf Rock", parent: "rock", aliases: ["surf"] },
  { slug: "prog-rock", name: "Prog Rock", parent: "rock", aliases: ["progressive rock", "prog"] },
  { slug: "jam-band", name: "Jam Band", parent: "rock", aliases: ["jam"] },
  { slug: "classic-rock", name: "Classic Rock", parent: "rock" },

  // Punk
  { slug: "hardcore", name: "Hardcore", parent: "punk", aliases: ["hxc", "hardcore punk"] },
  { slug: "powerviolence", name: "Powerviolence", parent: "hardcore", aliases: ["power violence"] },
  { slug: "post-hardcore", name: "Post-Hardcore", parent: "hardcore", aliases: ["post hardcore"] },
  { slug: "post-punk", name: "Post-Punk", parent: "punk", aliases: ["post punk", "postpunk"] },
  { slug: "pop-punk", name: "Pop Punk", parent: "punk" },
  { slug: "emo", name: "Emo", parent: "punk", aliases: ["midwest emo", "emo revival"] },
  { slug: "screamo", name: "Screamo", parent: "emo" },
  { slug: "ska-punk", name: "Ska Punk", parent: "punk" },
  { slug: "riot-grrrl", name: "Riot Grrrl", parent: "punk", aliases: ["riot girl"] },
  { slug: "folk-punk", name: "Folk Punk", parent: "punk" },
  { slug: "crust-punk", name: "Crust Punk", parent: "punk", aliases: ["crust", "d-beat"] },
  { slug: "oi", name: "Oi!", parent: "punk", aliases: ["street punk"] },

  // Metal
  { slug: "death-metal", name: "Death Metal", parent: "metal" },
  { slug: "black-metal", name: "Black Metal", parent: "metal" },
  { slug: "doom-metal", name: "Doom", parent: "metal", aliases: ["doom"] },
  { slug: "sludge", name: "Sludge", parent: "metal", aliases: ["sludge metal"] },
  { slug: "stoner-metal", name: "Stoner", parent: "metal", aliases: ["stoner rock", "stoner"] },
  { slug: "thrash", name: "Thrash", parent: "metal", aliases: ["thrash metal"] },
  { slug: "metalcore", name: "Metalcore", parent: "metal", aliases: ["metal core"] },
  { slug: "deathcore", name: "Deathcore", parent: "metal" },
  { slug: "grindcore", name: "Grindcore", parent: "metal", aliases: ["grind"] },
  { slug: "nu-metal", name: "Nu Metal", parent: "metal", aliases: ["numetal"] },
  { slug: "prog-metal", name: "Prog Metal", parent: "metal", aliases: ["progressive metal", "djent"] },

  // Hip-Hop
  { slug: "boom-bap", name: "Boom Bap", parent: "hip-hop" },
  { slug: "trap", name: "Trap", parent: "hip-hop" },
  { slug: "drill", name: "Drill", parent: "hip-hop" },
  { slug: "underground-hip-hop", name: "Underground Hip-Hop", parent: "hip-hop", aliases: ["underground rap"] },
  { slug: "cloud-rap", name: "Cloud Rap", parent: "hip-hop" },

  // Electronic
  { slug: "house", name: "House", parent: "electronic" },
  { slug: "techno", name: "Techno", parent: "electronic" },
  { slug: "dnb", name: "Drum & Bass", parent: "electronic", aliases: ["drum and bass", "drum & bass", "d&b", "jungle"] },
  { slug: "dubstep", name: "Dubstep", parent: "electronic" },
  { slug: "synthwave", name: "Synthwave", parent: "electronic", aliases: ["retrowave", "darkwave"] },
  { slug: "idm", name: "IDM", parent: "electronic" },
  { slug: "ambient", name: "Ambient", parent: "electronic" },
  { slug: "hyperpop", name: "Hyperpop", parent: "electronic" },
  { slug: "breakcore", name: "Breakcore", parent: "electronic" },
  { slug: "industrial", name: "Industrial", parent: "electronic" },

  // Pop
  { slug: "indie-pop", name: "Indie Pop", parent: "pop" },
  { slug: "bedroom-pop", name: "Bedroom Pop", parent: "pop" },
  { slug: "power-pop", name: "Power Pop", parent: "pop" },
  { slug: "synth-pop", name: "Synth Pop", parent: "pop", aliases: ["synthpop"] },
  { slug: "art-pop", name: "Art Pop", parent: "pop" },

  // Folk / Country
  { slug: "singer-songwriter", name: "Singer-Songwriter", parent: "folk", aliases: ["singer songwriter"] },
  { slug: "americana", name: "Americana", parent: "folk" },
  { slug: "bluegrass", name: "Bluegrass", parent: "folk" },
  { slug: "alt-country", name: "Alt-Country", parent: "country", aliases: ["alt country"] },
  { slug: "honky-tonk", name: "Honky-Tonk", parent: "country" },
  { slug: "red-dirt", name: "Red Dirt", parent: "country", aliases: ["texas country"] },

  // Jazz / Soul
  { slug: "jazz-fusion", name: "Jazz Fusion", parent: "jazz", aliases: ["fusion"] },
  { slug: "free-jazz", name: "Free Jazz", parent: "jazz" },
  { slug: "bebop", name: "Bebop", parent: "jazz" },
  { slug: "funk", name: "Funk", parent: "soul-rnb" },
  { slug: "neo-soul", name: "Neo-Soul", parent: "soul-rnb", aliases: ["neo soul"] },
  { slug: "gospel", name: "Gospel", parent: "soul-rnb" },

  // Experimental
  { slug: "noise", name: "Noise", parent: "experimental" },
  { slug: "drone", name: "Drone", parent: "experimental" },
  { slug: "no-wave", name: "No Wave", parent: "experimental" },

  // Latin / Global
  { slug: "cumbia", name: "Cumbia", parent: "latin" },
  { slug: "reggaeton", name: "Reggaeton", parent: "latin" },
  { slug: "tejano", name: "Tejano", parent: "latin", aliases: ["tex-mex", "conjunto"] },
  { slug: "corridos", name: "Corridos", parent: "latin", aliases: ["corridos tumbados", "regional mexicano"] },
  { slug: "salsa", name: "Salsa", parent: "latin" },
  { slug: "latin-rock", name: "Latin Rock", parent: "latin", aliases: ["rock en espanol", "rock en español"] },
  { slug: "reggae", name: "Reggae", parent: "global" },
  { slug: "dub", name: "Dub", parent: "global" },
  { slug: "ska", name: "Ska", parent: "global" },
  { slug: "afrobeat", name: "Afrobeat", parent: "global", aliases: ["afrobeats"] },
  { slug: "k-pop", name: "K-Pop", parent: "global", aliases: ["kpop"] },
];
