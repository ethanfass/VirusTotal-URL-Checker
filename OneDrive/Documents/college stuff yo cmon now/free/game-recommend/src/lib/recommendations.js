import { fallbackGames } from '../data/fallbackGames.js';
import {
  buildGameSignalProfile,
  cleanGame,
  countBy,
  getGenreIdsFromGames,
  getGenreNames,
  getImportantTagSlugs,
  getPlatformIdsFromGames,
  getPlatformNames,
  getPrimaryGenreNames,
  getSignalTagNames,
  getTagNames,
  isAllowedGame,
  localFilter,
  normalizeMatchLabel,
  toTitleLabel,
} from './gameData.js';
import { RAWG_KEY, fetchRawgGames } from './rawg.js';

function countSetOverlap(sourceSet, targetSet) {
  let overlap = 0;
  sourceSet.forEach((value) => {
    if (targetSet.has(value)) {
      overlap += 1;
    }
  });

  return overlap;
}

function affinityBetweenProfiles(candidateProfile, selectedProfile) {
  const primaryOverlap = countSetOverlap(candidateProfile.primaryGenres, selectedProfile.primaryGenres);
  const signalOverlap = countSetOverlap(candidateProfile.signalTags, selectedProfile.signalTags);
  const genreOverlap = countSetOverlap(candidateProfile.genres, selectedProfile.genres);
  const platformOverlap = countSetOverlap(candidateProfile.platforms, selectedProfile.platforms);
  const supportiveOverlap = countSetOverlap(candidateProfile.supportiveTags, selectedProfile.supportiveTags);

  return {
    score: primaryOverlap * 62 + signalOverlap * 30 + genreOverlap * 10 + platformOverlap * 4 + supportiveOverlap * 4,
    primaryOverlap,
    signalOverlap,
    genreOverlap,
    platformOverlap,
  };
}

function genreWeight(genre) {
  const normalizedGenre = normalizeMatchLabel(genre);

  if (normalizedGenre === 'indie') {
    return 5;
  }

  if (['action', 'adventure', 'indie'].includes(normalizedGenre)) {
    return 12;
  }

  return 34;
}

function preferenceAffinitySummary(candidateProfile, sourceGames) {
  const sourceProfiles = sourceGames.map(buildGameSignalProfile);
  const affinities = sourceProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    seriesKey: profile.seriesKey,
    ...affinityBetweenProfiles(candidateProfile, profile),
  }));
  const best = affinities.reduce(
    (currentBest, entry) => (entry.score > currentBest.score ? entry : currentBest),
    { id: null, name: '', seriesKey: '', score: 0, primaryOverlap: 0, signalOverlap: 0, genreOverlap: 0, platformOverlap: 0 },
  );
  const average = affinities.reduce((total, entry) => total + entry.score, 0) / Math.max(affinities.length, 1);
  const sameSeries = candidateProfile.seriesKey ? affinities.some((entry) => entry.seriesKey && entry.seriesKey === candidateProfile.seriesKey) : false;

  return {
    best,
    average,
    sameSeries,
  };
}

function collectSharedLabels(game, selectedGames, getter, formatter = (value) => value) {
  const selectedLabels = new Set(selectedGames.flatMap(getter).map(normalizeMatchLabel).filter(Boolean));
  const seen = new Set();

  return getter(game)
    .filter((label) => {
      const normalized = normalizeMatchLabel(label);
      if (!normalized || !selectedLabels.has(normalized) || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .map(formatter);
}

function formatReasonLabels(labels, limit = 4) {
  return labels.slice(0, limit).join(', ');
}

function gameHasExcludedSignal(game, signal) {
  if (signal.type === 'genre') {
    return getGenreNames(game).map(normalizeMatchLabel).includes(signal.value);
  }

  if (signal.type === 'platform') {
    return getPlatformNames(game).map(normalizeMatchLabel).includes(signal.value);
  }

  return getTagNames(game).map(normalizeMatchLabel).includes(signal.value);
}

function passesExcludedSignals(game, preferences = {}) {
  return !(preferences.excludedSignals || []).some((signal) => gameHasExcludedSignal(game, signal));
}

export function passesMatchMode(game, mode = 'safe') {
  const added = game.added || game.ratings_count || 0;
  const ratingCount = game.ratings_count || 0;
  const rating = game.rating || 0;

  if (mode === 'safe') {
    return rating >= 3.6 && (ratingCount >= 25 || added >= 300);
  }

  if (mode === 'hidden') {
    return rating >= 3.0 && added <= 6000;
  }

  return rating >= 2.6;
}

export function gameMatchBreakdown(game, selectedGames, preferences = {}) {
  const candidateProfile = buildGameSignalProfile(game);
  const selectedProfiles = selectedGames.map(buildGameSignalProfile);
  const selectedGenres = countBy(selectedGames.flatMap(getGenreNames));
  const selectedPlatforms = countBy(selectedGames.flatMap(getPlatformNames));
  const selectedSignalTags = countBy(selectedGames.flatMap(getSignalTagNames));
  const selectedSupportiveTags = countBy(
    selectedGames.flatMap((selectedGame) =>
      getTagNames(selectedGame)
        .map(normalizeMatchLabel)
        .filter((tag) => ['co-op', 'online co-op', 'local co-op', 'cooperative'].includes(tag)),
    ),
  );
  const selectedPrimaryGenres = new Set(selectedProfiles.flatMap((profile) => [...profile.primaryGenres]));

  const primaryGenreScore = [...candidateProfile.primaryGenres].reduce((score, genre) => score + (selectedPrimaryGenres.has(genre) ? 42 : 0), 0);
  const genreScore = getGenreNames(game).reduce((score, genre) => score + (selectedGenres.get(genre) || 0) * genreWeight(genre), 0);
  const platformScore = Math.min(
    getPlatformNames(game).reduce((score, platform) => score + (selectedPlatforms.get(platform) || 0) * 4, 0),
    18,
  );
  const signalTagScore = getSignalTagNames(game).reduce((score, tag) => score + Math.min(selectedSignalTags.get(tag) || 0, 3) * 18, 0);
  const supportiveTagScore = getTagNames(game)
    .map(normalizeMatchLabel)
    .filter((tag) => ['co-op', 'online co-op', 'local co-op', 'cooperative'].includes(tag))
    .reduce((score, tag) => score + Math.min(selectedSupportiveTags.get(tag) || 0, 2) * 4, 0);
  const sourceAffinities = selectedProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    ...affinityBetweenProfiles(candidateProfile, profile),
  }));
  const bestSourceAffinity = sourceAffinities.reduce(
    (best, entry) => (entry.score > best.score ? entry : best),
    { id: null, name: '', score: 0, primaryOverlap: 0, signalOverlap: 0, genreOverlap: 0, platformOverlap: 0 },
  );
  const sourceCoverage = sourceAffinities.filter((entry) => entry.score >= 32).length;
  const averageSourceAffinity =
    sourceAffinities.reduce((total, entry) => total + entry.score, 0) / Math.max(sourceAffinities.length, 1);
  const qualityScore = Math.round(
    (game.rating || 0) * 4 +
      Math.min(Math.log10((game.ratings_count || game.added || 0) + 1) * 1.4, 4) +
      (game.metacritic ? game.metacritic / 50 : 0),
  );
  const extraPrimaryGenres = Math.max(candidateProfile.primaryGenres.size - bestSourceAffinity.primaryOverlap, 0);
  const diffuseGenrePenalty = bestSourceAffinity.signalOverlap === 0 && bestSourceAffinity.primaryOverlap > 0 ? extraPrimaryGenres * 14 : 0;
  const selectedNeedsPrimaryOverlap = selectedPrimaryGenres.size > 0;
  const hasStrongOverlap = bestSourceAffinity.score >= 54 || primaryGenreScore > 0 || signalTagScore >= 18;
  const weakOverlapPenalty =
    selectedNeedsPrimaryOverlap && !hasStrongOverlap ? -125 : genreScore === 0 && signalTagScore === 0 && bestSourceAffinity.score < 28 ? -55 : 0;
  const rejectedSummary = preferenceAffinitySummary(candidateProfile, preferences.rejectedGames || []);
  const avoidancePenalty = Math.min(
    Math.round(rejectedSummary.best.score * 0.28 + rejectedSummary.average * 0.16 + (rejectedSummary.sameSeries ? 54 : 0)),
    132,
  );
  const baseScore =
    bestSourceAffinity.score +
    averageSourceAffinity * 0.55 +
    sourceCoverage * 16 +
    primaryGenreScore +
    genreScore +
    platformScore +
    signalTagScore +
    supportiveTagScore +
    qualityScore -
    diffuseGenrePenalty +
    weakOverlapPenalty;

  return {
    score: Math.round(baseScore - avoidancePenalty),
    baseScore: Math.round(baseScore),
    hasStrongOverlap,
    selectedNeedsPrimaryOverlap,
    bestSourceAffinity: bestSourceAffinity.score,
    bestSourceMatchId: bestSourceAffinity.id,
    bestSourceMatchName: bestSourceAffinity.name,
    sourceCoverage,
    genreScore,
    signalTagScore,
    avoidancePenalty,
    bestRejectedMatchName: rejectedSummary.best.name,
  };
}

function isMeaningfulMatch(game, selectedGames, preferences = {}) {
  const breakdown = game.matchBreakdown || gameMatchBreakdown(game, selectedGames, preferences);
  const wildcardMode = preferences.matchMode === 'wildcard';

  // Wildcards accept any non-rejected game so cross-genre picks can compete.
  if (wildcardMode) {
    return breakdown.avoidancePenalty < 120;
  }

  if (!breakdown.selectedNeedsPrimaryOverlap) {
    return (breakdown.genreScore > 0 || breakdown.signalTagScore > 0 || breakdown.bestSourceAffinity >= 24) && breakdown.avoidancePenalty < 120;
  }

  return (breakdown.hasStrongOverlap || breakdown.bestSourceAffinity >= 32) && breakdown.avoidancePenalty < 120;
}

export function gameMatchScore(game, selectedGames, preferences = {}) {
  return gameMatchBreakdown(game, selectedGames, preferences).score;
}

export function matchScoreForMode(game, breakdown, preferences = {}) {
  const mode = preferences.matchMode || 'safe';
  const added = game.added || game.ratings_count || 0;
  const ratingCount = game.ratings_count || 0;
  const rating = game.rating || 0;

  if (mode === 'safe') {
    // Strongly reward established, well-reviewed games so they rise far above the noise.
    const confidence = Math.min(Math.log10(ratingCount + added + 1) * 42, 168);
    const ratingLift = Math.max(0, rating - 3.2) * 52;
    return Math.round(breakdown.score + confidence + ratingLift);
  }

  if (mode === 'hidden') {
    // Preserve genre affinity but demote anything with mass-market reach.
    const popularityPenalty = Math.max(0, Math.log10(added + 1) * 40 - 18);
    const qualityBonus = Math.max(0, rating - 3.0) * 24;
    return Math.round(breakdown.score * 1.15 - popularityPenalty + qualityBonus);
  }

  // wildcard: dilute strong affinity so tangential games can compete;
  // wildcardOrder is a per-fetch random value (0-1) attached during fetchMatches.
  const variety = (game.wildcardOrder || 0) * 140;
  const freshness = Math.max(0, 80 - Math.min(Math.log10(ratingCount + 1) * 26, 80));
  return Math.round(breakdown.score * 0.35 + freshness + variety);
}

export function getPreviewMatchReasons(game, selectedGames, preferences = {}) {
  if (!selectedGames.length || selectedGames.some((selectedGame) => selectedGame.id === game.id)) {
    return [];
  }

  const breakdown = game.matchBreakdown || gameMatchBreakdown(game, selectedGames, preferences);
  const coreGenres = collectSharedLabels(game, selectedGames, getPrimaryGenreNames, toTitleLabel);
  const genres = collectSharedLabels(game, selectedGames, getGenreNames);
  const traits = collectSharedLabels(game, selectedGames, getSignalTagNames, toTitleLabel);
  const platforms = collectSharedLabels(game, selectedGames, getPlatformNames);
  const reasons = [];

  if (coreGenres.length) {
    reasons.push(`Matches your core styles: ${formatReasonLabels(coreGenres, 3)}.`);
  } else if (genres.length) {
    reasons.push(`Shares genres with your list: ${formatReasonLabels(genres, 3)}.`);
  }

  if (traits.length) {
    reasons.push(`Lines up on traits like ${formatReasonLabels(traits, 4)}.`);
  }

  if (platforms.length) {
    reasons.push(`Fits the systems you already play on: ${formatReasonLabels(platforms, 3)}.`);
  }

  if (breakdown.bestSourceMatchName) {
    reasons.push(`Closest overall to ${breakdown.bestSourceMatchName} from your selected games.`);
  }

  if (breakdown.sourceCoverage > 1) {
    reasons.push(`Connects with ${breakdown.sourceCoverage} different games in your current list.`);
  }

  return reasons.slice(0, 4);
}

export function buildMatchScoreStats(matches) {
  if (!matches.length) {
    return new Map();
  }

  const scores = matches.map((game) => game.matchScore || 0);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return new Map(
    matches.map((game, index) => [
      game.id,
      {
        score: game.matchScore || 0,
        rank: index + 1,
        total: matches.length,
        min,
        max,
      },
    ]),
  );
}

function diversifyMatches(matches, selectedGames, preferences = {}, limit = 30) {
  if (matches.length <= 1) {
    return matches.slice(0, limit);
  }

  const selectedPrimaryGenres = new Set(selectedGames.flatMap(getPrimaryGenreNames));
  const remaining = [...matches];
  const chosen = [];
  const sourceCounts = new Map();
  const seriesCounts = new Map();
  const primaryGenreCounts = new Map();
  const tagCounts = new Map();

  while (remaining.length && chosen.length < limit) {
    let bestIndex = 0;
    let bestAdjustedScore = -Infinity;

    remaining.forEach((game, index) => {
      const profile = game.signalProfile || buildGameSignalProfile(game);
      const breakdown = game.matchBreakdown || gameMatchBreakdown(game, selectedGames, preferences);
      const sourceCount = sourceCounts.get(breakdown.bestSourceMatchName) || 0;
      const seriesCount = profile.seriesKey ? seriesCounts.get(profile.seriesKey) || 0 : 0;
      const primaryGenres = [...profile.primaryGenres].filter((genre) => selectedPrimaryGenres.has(genre));
      const repeatedPrimaryPenalty = primaryGenres.reduce((total, genre) => total + (primaryGenreCounts.get(genre) || 0) * 18, 0);
      const freshPrimaryBonus = primaryGenres.some((genre) => !primaryGenreCounts.has(genre)) ? 16 : 0;
      const repeatedTagPenalty = [...profile.signalTags].reduce((total, tag) => total + (tagCounts.get(tag) || 0) * 9, 0);
      const freshTagBonus = [...profile.signalTags].some((tag) => !tagCounts.has(tag)) ? 12 : 0;
      const sourceBonus = breakdown.sourceCoverage > 1 ? 10 : 0;
      const sourcePenalty = sourceCount * 26;
      const seriesPenalty = seriesCount ? 44 + (seriesCount - 1) * 32 : 0;
      const adjustedScore = game.matchScore + freshPrimaryBonus + freshTagBonus + sourceBonus - sourcePenalty - seriesPenalty - repeatedPrimaryPenalty - repeatedTagPenalty;

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = index;
      }
    });

    const [picked] = remaining.splice(bestIndex, 1);
    const pickedProfile = picked.signalProfile || buildGameSignalProfile(picked);
    const pickedBreakdown = picked.matchBreakdown || gameMatchBreakdown(picked, selectedGames, preferences);
    chosen.push(picked);

    if (pickedBreakdown.bestSourceMatchName) {
      sourceCounts.set(pickedBreakdown.bestSourceMatchName, (sourceCounts.get(pickedBreakdown.bestSourceMatchName) || 0) + 1);
    }

    if (pickedProfile.seriesKey) {
      seriesCounts.set(pickedProfile.seriesKey, (seriesCounts.get(pickedProfile.seriesKey) || 0) + 1);
    }

    pickedProfile.primaryGenres.forEach((genre) => {
      if (selectedPrimaryGenres.has(genre)) {
        primaryGenreCounts.set(genre, (primaryGenreCounts.get(genre) || 0) + 1);
      }
    });

    pickedProfile.signalTags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  }

  return chosen;
}

export async function fetchMatches(selectedGames, filters, preferences = {}) {
  const excludedIds = new Set([...selectedGames.map((game) => game.id), ...(preferences.rejectedGames || []).map((game) => game.id)]);
  const selectedProfiles = selectedGames.slice(0, 4).map(buildGameSignalProfile);
  const genreIds = getGenreIdsFromGames(selectedGames);
  const platformIds = getPlatformIdsFromGames(selectedGames);
  const tagSlugs = getImportantTagSlugs(selectedGames);
  const allKnownGenreIds = ['4', '3', '5', '2', '7', '51', '10', '14', '15', '1', '83'];
  const genreIdSet = new Set(genreIds);
  const crossGenreIds = allKnownGenreIds.filter((id) => !genreIdSet.has(id)).slice(0, 5).join(',');
  const averageSelectedRating = selectedGames.reduce((total, game) => total + game.rating, 0) / Math.max(selectedGames.length, 1);
  // Use a permissive floor so the same pool works for all three modes.
  const minRating = Math.max(2.5, Math.min(4.0, averageSelectedRating - 0.7));

  const baseFilters = {
    ...filters,
    search: '',
    category: '',
    minRating,
    ordering: 'queuecraft',
  };

  const exploratoryFilters = {
    ...baseFilters,
    minRating: Math.max(2.4, minRating - 0.4),
    ordering: 'queuecraft',
  };

  const candidatePromises = RAWG_KEY
    ? [
        // Core: genre + platform match
        fetchRawgGames({ ...baseFilters, rawGenres: genreIds.join(','), platform: platformIds.join(',') }, 40),
        fetchRawgGames({ ...baseFilters, rawGenres: genreIds.join(','), platform: '' }, 40),
        // Quality-sorted: surfaces high-rated games that aren't just the most popular
        fetchRawgGames({ ...exploratoryFilters, rawGenres: genreIds.join(','), ordering: '-rating' }, 36),
        // Page 2 of core query — expands past the obvious blockbusters
        fetchRawgGames({ ...baseFilters, rawGenres: genreIds.join(','), page: 2 }, 36),
        // Tag-based queries
        tagSlugs.length ? fetchRawgGames({ ...baseFilters, rawTags: tagSlugs.join(','), platform: platformIds.join(',') }, 40) : Promise.resolve([]),
        tagSlugs.length ? fetchRawgGames({ ...exploratoryFilters, rawTags: tagSlugs.join(','), platform: '' }, 36) : Promise.resolve([]),
        // Recent releases in the genre — good for hidden/wildcard variety
        tagSlugs.length ? fetchRawgGames({ ...exploratoryFilters, rawTags: tagSlugs.join(','), ordering: '-released', minRating: 2.8 }, 28) : Promise.resolve([]),
        // Cross-genre pool for wildcard mode — genres outside the user's profile
        crossGenreIds ? fetchRawgGames({ ...exploratoryFilters, rawGenres: crossGenreIds, ordering: '-rating' }, 32) : Promise.resolve([]),
        crossGenreIds ? fetchRawgGames({ ...exploratoryFilters, rawGenres: crossGenreIds, ordering: '-added' }, 28) : Promise.resolve([]),
        ...selectedProfiles.flatMap((profile) => {
          const profileRequests = [];

          if (profile.genreIds.length) {
            profileRequests.push(fetchRawgGames({ ...baseFilters, rawGenres: profile.genreIds.join(','), platform: profile.platformIds.join(',') }, 28));
            profileRequests.push(fetchRawgGames({ ...exploratoryFilters, rawGenres: profile.genreIds.join(',') }, 28));
          }

          if (profile.tagSlugs.length) {
            profileRequests.push(fetchRawgGames({ ...baseFilters, rawTags: profile.tagSlugs.join(','), platform: profile.platformIds.join(',') }, 28));
          }

          if (profile.genreIds.length && profile.tagSlugs.length) {
            profileRequests.push(
              fetchRawgGames(
                {
                  ...baseFilters,
                  rawGenres: profile.genreIds.join(','),
                  rawTags: profile.tagSlugs.join(','),
                  platform: profile.platformIds.join(','),
                },
                24,
              ),
            );
          }

          return profileRequests;
        }),
      ]
    : [Promise.resolve(localFilter(fallbackGames, baseFilters, excludedIds))];

  const candidateBatches = (await Promise.allSettled(candidatePromises))
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  const byId = new Map();
  candidateBatches.forEach((game) => {
    if (!excludedIds.has(game.id) && isAllowedGame(game) && passesExcludedSignals(game, preferences)) {
      byId.set(game.id, cleanGame(game));
    }
  });

  let candidates = [...byId.values()];

  if (!candidates.length) {
    candidates = localFilter(fallbackGames, { ...baseFilters, minRating: 0 }, excludedIds);
  }

  // Score with mode-neutral base affinity; attach per-fetch random wildcardOrder
  // so wildcard mode produces different results each run. Mode filtering is
  // deferred to the frontend so toggling modes re-sorts without re-fetching.
  const scoredCandidates = candidates
    .map((game) => {
      const signalProfile = buildGameSignalProfile(game);
      const matchBreakdown = gameMatchBreakdown(game, selectedGames, preferences);
      const wildcardOrder = Math.random();
      const gameWithOrder = { ...game, wildcardOrder };
      const matchScore = matchScoreForMode(gameWithOrder, matchBreakdown, preferences);

      return {
        ...gameWithOrder,
        signalProfile,
        matchBreakdown,
        baseMatchScore: matchBreakdown.baseScore,
        matchScore,
      };
    })
    .filter((game) => isMeaningfulMatch(game, selectedGames, preferences))
    .filter((game) => (game.rating || 0) >= 2.4)
    .sort((a, b) => b.matchScore - a.matchScore);

  return diversifyMatches(scoredCandidates, selectedGames, preferences, 54);
}
