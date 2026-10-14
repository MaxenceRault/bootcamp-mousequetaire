// Seed manuel des données de démo : npm run seed (local uniquement, rôle brb_admin).
// Relançable : seuls les comptes et posts de démo sont recréés, dans une transaction.
// Les comptes de démo n'ont ni email ni mot de passe.

import { AuthTypes, Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { City, Country, State } from "country-state-city";
import pg from "pg";

const { CLOUD_SQL_INSTANCE, DB_USER, DB_NAME } = process.env;

if (!CLOUD_SQL_INSTANCE || !DB_USER || !DB_NAME) {
  console.error("CLOUD_SQL_INSTANCE, DB_USER et DB_NAME doivent être définies dans .env.local");
  process.exit(1);
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=80&fm=jpg`;

const USERS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    username: "wander_elena",
    display_name: "Elena Rostova",
    avatar_url: unsplash("1438761681033-6461ffad8d80"),
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    username: "marco_sophie",
    display_name: "Marco & Sophie",
    avatar_url: unsplash("1507003211169-0a1dd7228f2d"),
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    username: "ines_voyage",
    display_name: "Inès Moreau",
    avatar_url: unsplash("1494790108377-be9c29b29330"),
  },
  {
    id: "00000000-0000-4000-a000-000000000004",
    username: "thomas_trek",
    display_name: "Thomas Lefèvre",
    avatar_url: unsplash("1500648767791-00dcc994a43e"),
  },
  {
    id: "00000000-0000-4000-a000-000000000005",
    username: "mai_eats",
    display_name: "Mai Nguyen",
    avatar_url: unsplash("1534528741775-53994a69daeb"),
  },
];

const [elena, marcoSophie, ines, thomas, mai] = USERS.map((user) => user.id);

type Place = { country: string; state?: string; city?: string };

type DemoPost = {
  author_id: string;
  minutesAgo: number;
  days: number;
  archetype: string;
  destination: Place;
  title: string;
  long_description: string;
  photo_url: string;
  photo_alt: string;
};

const POSTS: DemoPost[] = [
  {
    author_id: elena,
    minutesAgo: 2,
    days: 1,
    archetype: "slow_travel_photography",
    destination: { country: "JP", state: "26", city: "Kyoto" },
    title: "Kyoto au petit matin, avant la foule",
    long_description:
      "Réveil à 5h30 pour remonter les ruelles de Higashiyama jusqu'à la pagode Yasaka dans un silence total. La lumière dorée sur les toits en bois, c'est la sérénité absolue. Fin de balade avec un matcha chaud dans un salon de thé centenaire.",
    photo_url: unsplash("1493976040374-85c8e12f0c0e"),
    photo_alt: "Ruelle traditionnelle de Kyoto menant à la pagode Yasaka au coucher du soleil",
  },
  {
    author_id: marcoSophie,
    minutesAgo: 5,
    days: 4,
    archetype: "slow_travel_photography",
    destination: { country: "GR", state: "L", city: "Oía" },
    title: "Couchers de soleil sur les falaises d'Oia",
    long_description:
      "Quatre jours à Santorin entre maisons blanchies à la chaux et eaux turquoise. Notre conseil : dîner tôt à Oia puis redescendre vers Ammoudi pour éviter la foule du coucher de soleil. Budget complet et bonnes adresses ci-dessous.",
    photo_url: unsplash("1570077188670-e3a8d69ac5ff"),
    photo_alt: "Village blanc d'Oia à flanc de falaise surplombant la mer Égée",
  },
  {
    author_id: mai,
    minutesAgo: 9,
    days: 1,
    archetype: "culinary_heritage",
    destination: { country: "JP", state: "13", city: "Tokyo" },
    title: "Le meilleur ramen de ma vie (et il coûte 9 €)",
    long_description:
      "Bouillon tonkotsu mijoté 18 heures, œuf mariné parfait et crevettes grillées. Comptoir de huit places, pas de réservation : arrivez avant l'ouverture. J'ai listé mes cinq autres comptoirs préférés du quartier.",
    photo_url: unsplash("1569718212165-3a8278d5f624"),
    photo_alt: "Bol de ramen avec œufs marinés, crevettes et baguettes posées dessus",
  },
  {
    author_id: thomas,
    minutesAgo: 14,
    days: 4,
    archetype: "mountain_trek",
    destination: { country: "PE", state: "CUS", city: "Cusco" },
    title: "Machu Picchu par le chemin de l'Inca",
    long_description:
      "Quatre jours de marche, trois cols et une arrivée par la Porte du Soleil au lever du jour. L'itinéraire a été optimisé avec l'IA pour l'acclimatation à l'altitude : départ de Cusco, deux nuits à Ollantaytambo, puis le trek.",
    photo_url: unsplash("1526392060635-9d6019884377"),
    photo_alt: "Citadelle inca du Machu Picchu entourée de montagnes et de nuages",
  },
  {
    author_id: ines,
    minutesAgo: 20,
    days: 2,
    archetype: "solo_architecture",
    destination: { country: "PT", state: "11", city: "Lisbon" },
    title: "Lisbonne en tram 28, de l'Alfama à Estrela",
    long_description:
      "Le tram 28 traverse les plus beaux quartiers de la ville. Montez au terminus de Martim Moniz pour avoir une place assise, puis descendez à chaque miradouro. Pastéis de nata obligatoires à chaque arrêt.",
    photo_url: unsplash("1585208798174-6cedd86e019a"),
    photo_alt: "Tram jaune de Lisbonne dans une rue bordée de façades colorées",
  },
  {
    author_id: thomas,
    minutesAgo: 27,
    days: 3,
    archetype: "mountain_trek",
    destination: { country: "CA", state: "AB", city: "Banff" },
    title: "Moraine Lake, le lac le plus photogénique des Rocheuses",
    long_description:
      "Eau turquoise, dix sommets enneigés en arrière-plan. La route est fermée aux voitures : réservez la navette Parks Canada dès l'ouverture des ventes. Prévoyez trois jours à Banff pour combiner avec Lake Louise.",
    photo_url: unsplash("1503614472-8c93d56e92ce"),
    photo_alt: "Lac turquoise de Moraine Lake au pied de montagnes enneigées",
  },
  {
    author_id: elena,
    minutesAgo: 35,
    days: 1,
    archetype: "solo_architecture",
    destination: { country: "ID", state: "BA", city: "Bedugul" },
    title: "Le temple flottant d'Ulun Danu au lever du jour",
    long_description:
      "Posé sur le lac Bratan, dans les hauteurs fraîches de Bali. Arrivée à 6h pour la brume sur l'eau et le temple sans personne. Combinez avec les rizières de Jatiluwih, à quarante minutes.",
    photo_url: unsplash("1537996194471-e657df975ab4"),
    photo_alt: "Temple balinais à toits étagés se reflétant dans un lac calme",
  },
  {
    author_id: mai,
    minutesAgo: 44,
    days: 1,
    archetype: "culinary_heritage",
    destination: { country: "JP", state: "13", city: "Tokyo" },
    title: "Ruelles de nuit et izakayas cachés",
    long_description:
      "Les lanternes rouges indiquent les petits bars où l'on mange des brochettes yakitori debout au comptoir. Allez-y après 20h, quand les salariés sortent du bureau : c'est là que l'ambiance est la meilleure.",
    photo_url: unsplash("1528360983277-13d401cdc186"),
    photo_alt: "Ruelle japonaise de nuit éclairée par une lanterne rouge",
  },
  {
    author_id: marcoSophie,
    minutesAgo: 54,
    days: 7,
    archetype: "slow_travel_photography",
    destination: { country: "GR", state: "L" },
    title: "Escaliers blancs et criques secrètes des Cyclades",
    long_description:
      "Loin de l'agitation de Mykonos, on a passé une semaine à sauter d'île en île en ferry. Chaque matin une nouvelle crique, chaque soir des poissons grillés sur le port.",
    photo_url: unsplash("1533105079780-92b9be482077"),
    photo_alt: "Escalier blanc d'une île grecque descendant vers la mer bleue",
  },
  {
    author_id: ines,
    minutesAgo: 65,
    days: 5,
    archetype: "slow_travel_photography",
    destination: { country: "MA", state: "08", city: "Zagora" },
    title: "Cinq jours dans les oasis du Sud marocain",
    long_description:
      "Palmeraies, kasbahs en terre crue et nuits étoilées. L'IA a construit la boucle depuis Marrakech en évitant les trajets de plus de quatre heures par jour. On a dormi dans une kasbah restaurée au milieu de la palmeraie.",
    photo_url: unsplash("1489749798305-4fea3ae63d43"),
    photo_alt: "Kasbah en terre crue devant une palmeraie et des montagnes",
  },
];

// Même contrôle que post.service.
function placeExists({ country, state, city }: Place) {
  if (!Country.getCountryByCode(country)) return false;
  if (!state) return !city;
  if (!State.getStateByCodeAndCountry(state, country)) return false;
  return !city || City.getCitiesOfState(country, state).some(({ name }) => name === city);
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s/)[0].slice(0, 252);

for (const post of POSTS) {
  if (!placeExists(post.destination)) {
    console.error(`Échec du seed (lieux) : destination inconnue pour « ${post.title} »`);
    process.exit(1);
  }
}

const connector = new Connector();
const client = new pg.Client({
  ...(await connector.getOptions({
    instanceConnectionName: CLOUD_SQL_INSTANCE,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  })),
  user: DB_USER,
  database: DB_NAME,
});

try {
  await client.connect();
  await client.query("begin");

  for (const user of USERS) {
    await client.query(
      `insert into users (id, username, display_name, avatar_url)
       values ($1, $2, $3, $4)
       on conflict (id) do update
         set username = excluded.username, display_name = excluded.display_name, avatar_url = excluded.avatar_url`,
      [user.id, user.username, user.display_name, user.avatar_url],
    );
  }

  const { rows: archetypes } = await client.query<{ id: number; slug: string }>("select id, slug from archetype");
  const archetypeIds = new Map(archetypes.map(({ id, slug }) => [slug, id]));

  // Jamais les posts des vrais utilisateurs.
  const demoIds = USERS.map(({ id }) => id);
  await client.query("delete from post where author_id = any($1::uuid[])", [demoIds]);

  // Le feed est trié par id : les posts de démo sont datés après le plus récent post réel.
  const { rows: newest } = await client.query<{ created_at: Date | null }>(
    "select max(created_at) as created_at from post where not (author_id = any($1::uuid[]))",
    [demoIds],
  );
  const now = Date.now();
  const maxMinutesAgo = Math.max(...POSTS.map(({ minutesAgo }) => minutesAgo));
  const windowStart = Math.max(
    now - maxMinutesAgo * 60_000,
    newest[0].created_at ? new Date(newest[0].created_at).getTime() + 1_000 : 0,
  );
  const publishedAt = (minutesAgo: number) => new Date(now - (minutesAgo / maxMinutesAgo) * (now - windowStart));

  let tagLinks = 0;

  for (const { minutesAgo, days, archetype, destination, ...post } of [...POSTS].reverse()) {
    const archetypeId = archetypeIds.get(archetype);
    if (!archetypeId) throw new Error(`type de récit inconnu : ${archetype}`);

    const createdAt = publishedAt(minutesAgo);
    const endDate = new Date(createdAt.getTime() - 7 * 86_400_000);
    const startDate = new Date(endDate.getTime() - (days - 1) * 86_400_000);

    const { rows: inserted } = await client.query<{ id: number }>(
      `insert into post (author_id, title, photo_url, photo_alt, short_description, long_description,
         destination_country_code, destination_state_code, destination_city, start_date, end_date,
         archetype_id, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning id`,
      [
        post.author_id,
        post.title,
        post.photo_url,
        post.photo_alt,
        firstSentence(post.long_description),
        post.long_description,
        destination.country,
        destination.state ?? null,
        destination.city ?? null,
        isoDate(startDate),
        isoDate(endDate),
        archetypeId,
        createdAt,
      ],
    );

    const places = destination.state ? [{ country: destination.country }, destination] : [destination];
    const { rows: tags } = await client.query<{ id: number }>(
      `insert into tag (country_code, state_code, city)
       select * from unnest($1::char(2)[], $2::varchar[], $3::varchar[])
       on conflict (country_code, state_code, city) do update set country_code = excluded.country_code
       returning id`,
      [places.map((p) => p.country), places.map((p) => p.state ?? null), places.map((p) => p.city ?? null)],
    );
    await client.query("insert into post_tag (post_id, tag_id) select $1, unnest($2::int[])", [
      inserted[0].id,
      tags.map(({ id }) => id),
    ]);
    tagLinks += tags.length;
  }

  await client.query("commit");
  console.log(`Seed terminé : ${USERS.length} users, ${POSTS.length} posts, ${tagLinks} liens post-tag.`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("Échec du seed :", (error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
  connector.close();
}
