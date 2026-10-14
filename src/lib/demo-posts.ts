import type { FeedPost, PostCategory } from "@/lib/posts";

// Données de démo du feed, en attendant l'API back-end (mêmes posts que scripts/seed.mts).
// hoursAgo : ancienneté du post, recalculée à chaque requête pour que le feed paraisse récent.
export type DemoPost = Omit<FeedPost, "createdAt"> & { category: PostCategory; hoursAgo: number };

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=80&fm=jpg`;

const AUTHORS = {
  elena: { id: "00000000-0000-4000-a000-000000000001", username: "wander_elena", displayName: "Elena Rostova", avatarUrl: unsplash("1438761681033-6461ffad8d80") },
  marcoSophie: { id: "00000000-0000-4000-a000-000000000002", username: "marco_sophie", displayName: "Marco & Sophie", avatarUrl: unsplash("1507003211169-0a1dd7228f2d") },
  ines: { id: "00000000-0000-4000-a000-000000000003", username: "ines_voyage", displayName: "Inès Moreau", avatarUrl: unsplash("1494790108377-be9c29b29330") },
  thomas: { id: "00000000-0000-4000-a000-000000000004", username: "thomas_trek", displayName: "Thomas Lefèvre", avatarUrl: unsplash("1500648767791-00dcc994a43e") },
  mai: { id: "00000000-0000-4000-a000-000000000005", username: "mai_eats", displayName: "Mai Nguyen", avatarUrl: unsplash("1534528741775-53994a69daeb") },
};

export const DEMO_POSTS: DemoPost[] = [
  {
    id: "00000000-0000-4000-b000-000000000001",
    author: AUTHORS.elena,
    hoursAgo: 2,
    title: "Kyoto au petit matin, avant la foule",
    content:
      "Réveil à 5h30 pour remonter les ruelles de Higashiyama jusqu'à la pagode Yasaka dans un silence total. La lumière dorée sur les toits en bois, c'est la sérénité absolue. Fin de balade avec un matcha chaud dans un salon de thé centenaire.",
    location: "Higashiyama, Kyoto",
    countryCode: "JP",
    category: "culture",
    tag: "Guide d'automne",
    highlight: "Itinéraire et hébergements détaillés",
    imageUrl: unsplash("1493976040374-85c8e12f0c0e"),
    imageAlt: "Ruelle traditionnelle de Kyoto menant à la pagode Yasaka au coucher du soleil",
  },
  {
    id: "00000000-0000-4000-b000-000000000002",
    author: AUTHORS.marcoSophie,
    hoursAgo: 5,
    title: "Couchers de soleil sur les falaises d'Oia",
    content:
      "Quatre jours à Santorin entre maisons blanchies à la chaux et eaux turquoise. Notre conseil : dîner tôt à Oia puis redescendre vers Ammoudi pour éviter la foule du coucher de soleil. Budget complet et bonnes adresses ci-dessous.",
    location: "Oia, Santorin",
    countryCode: "GR",
    category: "coast",
    tag: "Séjour côtier",
    highlight: "7 hébergements et sorties en bateau",
    imageUrl: unsplash("1570077188670-e3a8d69ac5ff"),
    imageAlt: "Village blanc d'Oia à flanc de falaise surplombant la mer Égée",
  },
  {
    id: "00000000-0000-4000-b000-000000000003",
    author: AUTHORS.mai,
    hoursAgo: 9,
    title: "Le meilleur ramen de ma vie (et il coûte 9 €)",
    content:
      "Bouillon tonkotsu mijoté 18 heures, œuf mariné parfait et crevettes grillées. Comptoir de huit places, pas de réservation : arrivez avant l'ouverture. J'ai listé mes cinq autres comptoirs préférés du quartier.",
    location: "Shinjuku, Tokyo",
    countryCode: "JP",
    category: "food",
    tag: "Street food",
    highlight: "6 adresses testées et approuvées",
    imageUrl: unsplash("1569718212165-3a8278d5f624"),
    imageAlt: "Bol de ramen avec œufs marinés, crevettes et baguettes posées dessus",
  },
  {
    id: "00000000-0000-4000-b000-000000000004",
    author: AUTHORS.thomas,
    hoursAgo: 20,
    title: "Machu Picchu par le chemin de l'Inca",
    content:
      "Quatre jours de marche, trois cols et une arrivée par la Porte du Soleil au lever du jour. L'itinéraire a été optimisé avec l'IA pour l'acclimatation à l'altitude : départ de Cusco, deux nuits à Ollantaytambo, puis le trek.",
    location: "Machu Picchu, Cusco",
    countryCode: "PE",
    category: "ai_curated",
    tag: "Trek",
    highlight: "Itinéraire jour par jour généré par l'IA",
    imageUrl: unsplash("1526392060635-9d6019884377"),
    imageAlt: "Citadelle inca du Machu Picchu entourée de montagnes et de nuages",
  },
  {
    id: "00000000-0000-4000-b000-000000000005",
    author: AUTHORS.ines,
    hoursAgo: 30,
    title: "Lisbonne en tram 28, de l'Alfama à Estrela",
    content:
      "Le tram 28 traverse les plus beaux quartiers de la ville. Montez au terminus de Martim Moniz pour avoir une place assise, puis descendez à chaque miradouro. Pastéis de nata obligatoires à chaque arrêt.",
    location: "Alfama, Lisbonne",
    countryCode: "PT",
    category: "culture",
    tag: "City break",
    highlight: "Parcours complet en 9 arrêts",
    imageUrl: unsplash("1585208798174-6cedd86e019a"),
    imageAlt: "Tram jaune de Lisbonne dans une rue bordée de façades colorées",
  },
  {
    id: "00000000-0000-4000-b000-000000000006",
    author: AUTHORS.thomas,
    hoursAgo: 46,
    title: "Moraine Lake, le lac le plus photogénique des Rocheuses",
    content:
      "Eau turquoise, dix sommets enneigés en arrière-plan. La route est fermée aux voitures : réservez la navette Parks Canada dès l'ouverture des ventes. Prévoyez trois jours à Banff pour combiner avec Lake Louise.",
    location: "Banff, Alberta",
    countryCode: "CA",
    category: "ai_curated",
    tag: "Nature",
    highlight: "Planning de 3 jours généré par l'IA",
    imageUrl: unsplash("1503614472-8c93d56e92ce"),
    imageAlt: "Lac turquoise de Moraine Lake au pied de montagnes enneigées",
  },
  {
    id: "00000000-0000-4000-b000-000000000007",
    author: AUTHORS.elena,
    hoursAgo: 70,
    title: "Le temple flottant d'Ulun Danu au lever du jour",
    content:
      "Posé sur le lac Bratan, dans les hauteurs fraîches de Bali. Arrivée à 6h pour la brume sur l'eau et le temple sans personne. Combinez avec les rizières de Jatiluwih, à quarante minutes.",
    location: "Bedugul, Bali",
    countryCode: "ID",
    category: "culture",
    tag: "Temples",
    highlight: "Boucle d'une journée dans le centre de Bali",
    imageUrl: unsplash("1537996194471-e657df975ab4"),
    imageAlt: "Temple balinais à toits étagés se reflétant dans un lac calme",
  },
  {
    id: "00000000-0000-4000-b000-000000000008",
    author: AUTHORS.mai,
    hoursAgo: 96,
    title: "Ruelles de nuit et izakayas cachés",
    content:
      "Les lanternes rouges indiquent les petits bars où l'on mange des brochettes yakitori debout au comptoir. Allez-y après 20h, quand les salariés sortent du bureau : c'est là que l'ambiance est la meilleure.",
    location: "Tokyo",
    countryCode: "JP",
    category: "food",
    tag: "Food tour",
    highlight: "4 izakayas où manger pour moins de 20 €",
    imageUrl: unsplash("1528360983277-13d401cdc186"),
    imageAlt: "Ruelle japonaise de nuit éclairée par une lanterne rouge",
  },
  {
    id: "00000000-0000-4000-b000-000000000009",
    author: AUTHORS.marcoSophie,
    hoursAgo: 120,
    title: "Escaliers blancs et criques secrètes des Cyclades",
    content:
      "Loin de l'agitation de Mykonos, on a passé une semaine à sauter d'île en île en ferry. Chaque matin une nouvelle crique, chaque soir des poissons grillés sur le port.",
    location: "Cyclades",
    countryCode: "GR",
    category: "coast",
    tag: "Island hopping",
    highlight: "Horaires de ferry et budget de la semaine",
    imageUrl: unsplash("1533105079780-92b9be482077"),
    imageAlt: "Escalier blanc d'une île grecque descendant vers la mer bleue",
  },
  {
    id: "00000000-0000-4000-b000-000000000010",
    author: AUTHORS.ines,
    hoursAgo: 150,
    title: "Cinq jours dans les oasis du Sud marocain",
    content:
      "Palmeraies, kasbahs en terre crue et nuits étoilées. L'IA a construit la boucle depuis Marrakech en évitant les trajets de plus de quatre heures par jour. On a dormi dans une kasbah restaurée au milieu de la palmeraie.",
    location: "Vallée du Drâa",
    countryCode: "MA",
    category: "ai_curated",
    tag: "Road trip",
    highlight: "Boucle de 5 jours générée par l'IA",
    imageUrl: unsplash("1489749798305-4fea3ae63d43"),
    imageAlt: "Kasbah en terre crue devant une palmeraie et des montagnes",
  },
];
