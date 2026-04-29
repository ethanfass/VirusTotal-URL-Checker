export const MATCH_COLUMNS = 3;
export const MATCH_ROWS = 2;
export const MATCH_PAGE_SIZE = MATCH_COLUMNS * MATCH_ROWS;

export const categoryOptions = [
  { label: 'Any genre/theme', value: '', kind: 'any' },
  { label: 'Action', value: 'genre:4', kind: 'genre', apiValue: '4' },
  { label: 'Adventure', value: 'genre:3', kind: 'genre', apiValue: '3' },
  { label: 'RPG', value: 'genre:5', kind: 'genre', apiValue: '5' },
  { label: 'Shooter', value: 'genre:2', kind: 'genre', apiValue: '2' },
  { label: 'Puzzle', value: 'genre:7', kind: 'genre', apiValue: '7' },
  { label: 'Indie', value: 'genre:51', kind: 'genre', apiValue: '51' },
  { label: 'Strategy', value: 'genre:10', kind: 'genre', apiValue: '10' },
  { label: 'Simulation', value: 'genre:14', kind: 'genre', apiValue: '14' },
  { label: 'Sports', value: 'genre:15', kind: 'genre', apiValue: '15' },
  { label: 'Racing', value: 'genre:1', kind: 'genre', apiValue: '1' },
  { label: 'Platformer', value: 'genre:83', kind: 'genre', apiValue: '83' },
  { label: 'Roguelike', value: 'tag:roguelike', kind: 'tag', apiValue: 'roguelike' },
  { label: 'Roguelite', value: 'tag:roguelite', kind: 'tag', apiValue: 'roguelite' },
  { label: 'Metroidvania', value: 'tag:metroidvania', kind: 'tag', apiValue: 'metroidvania' },
  { label: 'Soulslike', value: 'tag:souls-like', kind: 'tag', apiValue: 'souls-like' },
  { label: 'Deckbuilder', value: 'tag:deck-building', kind: 'tag', apiValue: 'deck-building' },
  { label: 'Survival horror', value: 'tag:survival-horror', kind: 'tag', apiValue: 'survival-horror' },
  { label: 'Battle royale', value: 'tag:battle-royale', kind: 'tag', apiValue: 'battle-royale' },
  { label: 'Open world', value: 'tag:open-world', kind: 'tag', apiValue: 'open-world' },
  { label: 'Story rich', value: 'tag:story-rich', kind: 'tag', apiValue: 'story-rich' },
  { label: 'Co-op', value: 'tag:co-op', kind: 'tag', apiValue: 'co-op' },
  { label: 'Extraction', value: 'tag:extraction', kind: 'tag', apiValue: 'extraction' },
  { label: 'Tactical', value: 'tag:tactical', kind: 'tag', apiValue: 'tactical' },
];

export const categoryByValue = new Map(categoryOptions.map((category) => [category.value, category]));

export const platforms = [
  { label: 'Any platform', value: '' },
  { label: 'PC', value: '1' },
  { label: 'PlayStation', value: '2' },
  { label: 'Xbox', value: '3' },
  { label: 'Nintendo', value: '7' },
  { label: 'iOS', value: '4' },
  { label: 'Android', value: '8' },
  { label: 'Mac', value: '5' },
  { label: 'Linux', value: '6' },
];

const platformNameToId = {
  PC: '1',
  PlayStation: '2',
  Xbox: '3',
  Nintendo: '7',
  iOS: '4',
  Android: '8',
  Mac: '5',
  'Apple Macintosh': '5',
  Linux: '6',
};

const genreNameToId = categoryOptions.reduce((map, category) => {
  if (category.kind === 'genre') {
    map[category.label.toLowerCase()] = category.apiValue;
  }

  return map;
}, {});

export const sortOptions = [
  { label: 'GN algorithm', value: 'queuecraft' },
  { label: 'Most added', value: '-added' },
  { label: 'Best rated', value: '-rating' },
  { label: 'Newest', value: '-released' },
];

export const initialFilters = {
  search: '',
  category: '',
  platform: '',
  minRating: 0,
  ordering: 'queuecraft',
};

const sexFocusedTitlePatterns = [
  /\bsex\b/i,
  /\bsexy\b/i,
  /\bsexual\b/i,
  /\bhentai\b/i,
  /\berotic\b/i,
  /\beroge\b/i,
  /\bporn\b/i,
  /\bpornography\b/i,
  /\bxxx\b/i,
];

const sexFocusedTagPatterns = [
  /\bsexual\b/i,
  /\bhentai\b/i,
  /\berotic\b/i,
  /\beroge\b/i,
  /\bnsfw\b/i,
  /\bporn\b/i,
  /\badult\b/i,
  /\badult visual novel\b/i,
  /\badult game\b/i,
];

const ignoredMatchTags = new Set([
  'singleplayer',
  'multiplayer',
  'steam achievements',
  'full controller support',
  'steam cloud',
  'steam trading cards',
  'stats',
  'controller',
  'great soundtrack',
]);

const utilityDisplayTags = new Set([
  'steam achievements',
  'steam cloud',
  'steam trading cards',
  'full controller support',
  'controller',
  'stats',
  'steam leaderboards',
  'valve anti cheat enabled',
  'captions available',
  'remote play on phone',
  'remote play on tablet',
  'remote play on tv',
  'remote play together',
]);

const broadMatchGenres = new Set(['action', 'adventure', 'indie']);
const supportiveMatchTags = new Set(['co-op', 'online co-op', 'local co-op', 'cooperative']);
const seriesStopWords = new Set([
  'the',
  'a',
  'an',
  'and',
  'of',
  'edition',
  'ultimate',
  'definitive',
  'deluxe',
  'complete',
  'gold',
  'remastered',
  'remake',
  'reload',
  'redux',
  'directors',
  'cut',
  'hd',
  'vr',
  'demo',
  'beta',
  'alpha',
]);

export function cleanGame(game) {
  return {
    ...game,
    added: Number(game.added || game.ratings_count || 0),
    rating: Number(game.rating || 0),
    ratings_count: Number(game.ratings_count || 0),
    metacritic: game.metacritic || null,
    playtime: Number(game.playtime || 0),
    genres: game.genres || [],
    parent_platforms: game.parent_platforms || [],
    tags: game.tags || [],
  };
}

function names(items, selector = (item) => item.name) {
  return items.map(selector).filter(Boolean);
}

export function getGenreNames(game) {
  return names(game.genres);
}

export function getPlatformNames(game) {
  return names(game.parent_platforms, (item) => item.platform?.name);
}

export function getTagNames(game) {
  return names(game.tags);
}

export function normalizeMatchLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getPrimaryGenreNames(game) {
  return getGenreNames(game)
    .map(normalizeMatchLabel)
    .filter((genre) => genre && !broadMatchGenres.has(genre));
}

export function getSignalTagNames(game) {
  return getTagNames(game)
    .map(normalizeMatchLabel)
    .filter((tag) => tag && !ignoredMatchTags.has(tag) && !supportiveMatchTags.has(tag));
}

export function toTitleLabel(label) {
  return label.replace(/\b[a-z]/g, (character) => character.toUpperCase()).replace(/\b(Rpg|Mmo|Mmorpg|Fps|Pvp|Pve|Vr|Ar)\b/g, (match) => match.toUpperCase());
}

export function getDisplayTagNames(game) {
  return getTagNames(game)
    .filter((tag) => !utilityDisplayTags.has(normalizeMatchLabel(tag)))
    .map(toTitleLabel);
}

function searchableText(game) {
  return [game.name, game.slug, ...getGenreNames(game), ...getPlatformNames(game), ...getTagNames(game)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isAllowedGame(game) {
  const titleText = `${game.name || ''} ${game.slug || ''}`;
  const tagText = getTagNames(game).join(' ');

  return (
    !sexFocusedTitlePatterns.some((pattern) => pattern.test(titleText)) &&
    !sexFocusedTagPatterns.some((pattern) => pattern.test(tagText))
  );
}

export function labelList(items, fallback = 'Unknown') {
  return items.length ? items.slice(0, 3).join(', ') : fallback;
}

export function fullLabelList(items, fallback = 'Unknown') {
  return items.length ? items.join(', ') : fallback;
}

export function numberLabel(value, fallback = 'N/A') {
  const numeric = Number(value || 0);
  return numeric ? numeric.toLocaleString() : fallback;
}

export function countLabel(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '0';
}

export function dateLabel(value, fallback = 'TBA') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function releaseYearLabel(value, fallback = 'TBA') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return String(date.getFullYear());
}

export function releaseWindowMatches(game, releaseWindow) {
  if (!releaseWindow) {
    return true;
  }

  const year = Number(releaseYearLabel(game?.released, '0'));
  if (!year) {
    return false;
  }

  if (releaseWindow === 'recent') {
    return year >= 2020;
  }

  if (releaseWindow === 'modern') {
    return year >= 2010 && year < 2020;
  }

  if (releaseWindow === 'classic') {
    return year < 2010;
  }

  return true;
}

export function playtimeBucketMatches(game, playtimeBucket) {
  if (!playtimeBucket) {
    return true;
  }

  const playtime = Number(game?.playtime || 0);
  if (!playtime) {
    return false;
  }

  if (playtimeBucket === 'short') {
    return playtime < 15;
  }

  if (playtimeBucket === 'medium') {
    return playtime >= 15 && playtime < 40;
  }

  if (playtimeBucket === 'long') {
    return playtime >= 40;
  }

  return true;
}

export function getDeveloperNames(detail) {
  return names(detail?.developers || []);
}

export function getPublisherNames(detail) {
  return names(detail?.publishers || []);
}

function getStoreNames(detail) {
  return names(detail?.stores || [], (item) => item.store?.name);
}

export function getDetailPlatformNames(game, detail) {
  return detail?.platforms?.length ? names(detail.platforms, (item) => item.platform?.name) : getPlatformNames(game);
}

export function getStorefrontNames(game, fallbackDetail) {
  const stores = getStoreNames(game).length ? getStoreNames(game) : getStoreNames(fallbackDetail);
  return stores.length ? stores : [];
}

export function getStorefrontOrPlatformNames(game, fallbackDetail) {
  const storefronts = getStorefrontNames(game, fallbackDetail);
  return storefronts.length ? storefronts : getDetailPlatformNames(game, fallbackDetail);
}

export function firstTrailer(movies = []) {
  return movies.find((movie) => movie.data?.max || movie.data?.['480']) || null;
}

export function trailerSource(movie) {
  return movie?.data?.max || movie?.data?.['480'] || '';
}

function placeholderImageFor(game) {
  const title = game.name || 'Unknown Game';
  const seed = [...title].reduce((total, character) => total + character.charCodeAt(0), Number(game.id || 0));
  const palette = [
    ['#25f4ff', '#b8ff2c', '#101723'],
    ['#ff2bbf', '#ffe27a', '#15111f'],
    ['#b8ff2c', '#25f4ff', '#10180e'],
    ['#ffe27a', '#ff4d5e', '#1c1410'],
  ];
  const [primary, secondary, base] = palette[seed % palette.length];
  const initial = title.trim().charAt(0).toUpperCase() || '?';
  const escapedTitle = title.replace(/[&<>"']/g, (character) => {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
    return entities[character];
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="${base}"/><path d="M0 132L320 74V180H0Z" fill="${primary}" opacity=".72"/><path d="M0 32H320M0 64H320M0 96H320M0 128H320M40 0V180M80 0V180M120 0V180M160 0V180M200 0V180M240 0V180M280 0V180" stroke="${secondary}" stroke-width="2" opacity=".16"/><rect x="18" y="18" width="284" height="144" fill="none" stroke="#000" stroke-width="8"/><text x="160" y="92" text-anchor="middle" font-family="monospace" font-size="56" font-weight="700" fill="#fff">${initial}</text><text x="160" y="132" text-anchor="middle" font-family="monospace" font-size="16" font-weight="700" fill="#fff">${escapedTitle}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function imageFor(game) {
  return game.background_image || placeholderImageFor(game);
}

export function handleImageError(event, game) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = placeholderImageFor(game);
}

export function categoryMatchesGame(game, categoryValue) {
  if (!categoryValue) {
    return true;
  }

  const category = categoryByValue.get(categoryValue);
  if (!category) {
    return true;
  }

  const genreText = getGenreNames(game).join(' ').toLowerCase();
  const tagText = getTagNames(game).join(' ').toLowerCase();
  const searchText = searchableText(game);
  const label = category.label.toLowerCase();
  const apiValue = category.apiValue?.replaceAll('-', ' ') || '';

  if (category.kind === 'genre') {
    return genreText.includes(label);
  }

  return tagText.includes(label) || tagText.includes(apiValue) || searchText.includes(label) || searchText.includes(apiValue);
}

function queryRelevance(game, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  const name = (game.name || '').toLowerCase();
  const slug = (game.slug || '').replaceAll('-', ' ').toLowerCase();
  const text = searchableText(game);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (name === normalizedQuery || slug === normalizedQuery) {
    return 180;
  }

  if (name.startsWith(normalizedQuery) || slug.startsWith(normalizedQuery)) {
    return 115;
  }

  if (name.includes(normalizedQuery) || slug.includes(normalizedQuery)) {
    return 85;
  }

  if (tokens.every((token) => text.includes(token))) {
    return 55;
  }

  return -45;
}

function queuecraftScore(game, query = '') {
  const ratings = game.ratings_count || Math.max(game.added, 0);
  const ratingCount = game.ratings_count || 0;
  const added = game.added || ratings || 0;
  const rating = game.rating || 0;
  const bayesianRating = ((rating || 0) * ratings + 3.35 * 650) / Math.max(ratings + 650, 1);
  const popularity = Math.log10(added + 1) * 8;
  const critic = game.metacritic ? game.metacritic / 14 : 2;
  const confidenceScore = ratingCount >= 40 ? 8 : ratingCount >= 18 ? 5 : ratingCount >= 8 ? 2 : ratingCount >= 3 ? -2 : -14;
  const underdogBonus =
    ratingCount >= 8 && ratingCount <= 600 && rating >= 3
      ? Math.max(0, 22 - Math.log10(added + 1) * 4.5) + Math.max(0, rating - 3) * 8
      : 0;
  const blockbusterPenalty = added > 80000 ? 30 : added > 30000 ? 20 : added > 10000 ? 10 : added > 3500 ? 4 : 0;

  return queryRelevance(game, query) + bayesianRating * 28 + popularity + critic + confidenceScore + underdogBonus - blockbusterPenalty;
}

export function sortGames(games, filters, preferMatchScore = false) {
  const query = filters.search || '';
  const nextGames = [...games];

  if (filters.ordering === '-added') {
    return nextGames.sort((a, b) => (b.added || b.ratings_count || 0) - (a.added || a.ratings_count || 0));
  }

  if (filters.ordering === '-rating') {
    return nextGames.sort((a, b) => b.rating - a.rating || (b.ratings_count || 0) - (a.ratings_count || 0));
  }

  if (filters.ordering === '-released') {
    return nextGames.sort((a, b) => new Date(b.released || 0) - new Date(a.released || 0));
  }

  return nextGames.sort((a, b) => {
    const aScore = preferMatchScore ? (a.matchScore || 0) * 3.2 + queuecraftScore(a, query) * 0.42 : queuecraftScore(a, query);
    const bScore = preferMatchScore ? (b.matchScore || 0) * 3.2 + queuecraftScore(b, query) * 0.42 : queuecraftScore(b, query);
    return bScore - aScore;
  });
}

export function localFilter(games, filters, excludedIds = new Set()) {
  const query = filters.search.trim().toLowerCase();
  const wantedPlatform = filters.platform
    ? platforms.find((platform) => platform.value === filters.platform)?.label.toLowerCase()
    : '';

  const filtered = games
    .map(cleanGame)
    .filter(isAllowedGame)
    .filter((game) => {
      const platformText = getPlatformNames(game).join(' ').toLowerCase();
      const haystack = searchableText(game);

      return (
        !excludedIds.has(game.id) &&
        (!query || query.split(/\s+/).every((token) => haystack.includes(token))) &&
        categoryMatchesGame(game, filters.category) &&
        (!wantedPlatform || platformText.includes(wantedPlatform)) &&
        game.rating >= filters.minRating
      );
    });

  return sortGames(filtered, filters);
}

export function applyApiCategory(params, filters) {
  if (filters.rawGenres) {
    params.set('genres', filters.rawGenres);
  }

  if (filters.rawTags) {
    params.set('tags', filters.rawTags);
  }

  const category = categoryByValue.get(filters.category);
  if (!category) {
    return;
  }

  if (category.kind === 'genre') {
    params.set('genres', category.apiValue);
  }

  if (category.kind === 'tag') {
    params.set('tags', category.apiValue);
  }
}

export function countBy(items) {
  return items.reduce((map, item) => {
    if (item) {
      map.set(item, (map.get(item) || 0) + 1);
    }

    return map;
  }, new Map());
}

export function topKeys(map, limit = 3) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function getGenreIdsFromGames(games) {
  const ids = games.flatMap((game) =>
    getGenreNames(game)
      .map((genre) => genreNameToId[genre.toLowerCase()])
      .filter(Boolean),
  );

  return topKeys(countBy(ids), 3);
}

export function getPlatformIdsFromGames(games) {
  const ids = games.flatMap((game) =>
    getPlatformNames(game)
      .map((platform) => platformNameToId[platform])
      .filter(Boolean),
  );

  return topKeys(countBy(ids), 3);
}

export function getImportantTagSlugs(games) {
  const tagCounts = countBy(
    games.flatMap((game) =>
      getTagNames(game)
        .map(normalizeMatchLabel)
        .filter((tag) => tag && !ignoredMatchTags.has(tag)),
    ),
  );

  return topKeys(tagCounts, 4).map((tag) => tag.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
}

function toSignalSlug(label) {
  return normalizeMatchLabel(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function uniqueValues(items) {
  return [...new Set(items.filter(Boolean))];
}

function getGameGenreIds(game) {
  return uniqueValues(
    getGenreNames(game)
      .map((genre) => genreNameToId[genre.toLowerCase()])
      .filter(Boolean),
  );
}

function getGamePlatformIds(game) {
  return uniqueValues(
    getPlatformNames(game)
      .map((platform) => platformNameToId[platform])
      .filter(Boolean),
  );
}

export function getSupportiveTagNames(game) {
  return getTagNames(game)
    .map(normalizeMatchLabel)
    .filter((tag) => supportiveMatchTags.has(tag));
}

export function getSeriesKey(game) {
  const baseName = (game.name || game.slug || '')
    .toLowerCase()
    .replace(/tom clancy'?s\s+/g, '')
    .replace(/ea sports\s+/g, '')
    .split(':')[0]
    .split(' - ')[0]
    .trim();
  const tokens = normalizeMatchLabel(baseName)
    .split(/\s+/)
    .filter((token) => token && !seriesStopWords.has(token) && !/^\d+$/.test(token));

  return tokens.slice(0, 3).join(' ');
}

export function buildGameSignalProfile(game) {
  return {
    id: game.id,
    name: game.name,
    seriesKey: getSeriesKey(game),
    genreIds: getGameGenreIds(game).slice(0, 2),
    platformIds: getGamePlatformIds(game).slice(0, 2),
    tagSlugs: uniqueValues(getSignalTagNames(game).map(toSignalSlug)).slice(0, 3),
    primaryGenres: new Set(getPrimaryGenreNames(game)),
    genres: new Set(getGenreNames(game).map(normalizeMatchLabel).filter(Boolean)),
    platforms: new Set(getPlatformNames(game).map(normalizeMatchLabel).filter(Boolean)),
    signalTags: new Set(getSignalTagNames(game)),
    supportiveTags: new Set(getSupportiveTagNames(game)),
  };
}

export function sharedLabels(game, selectedGames, getter, normalize = (value) => value.toLowerCase()) {
  const selectedLabels = new Set(selectedGames.flatMap(getter).map(normalize).filter(Boolean));
  const seen = new Set();

  return getter(game).filter((label) => {
    const normalized = normalize(label);
    if (!normalized || !selectedLabels.has(normalized) || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}
