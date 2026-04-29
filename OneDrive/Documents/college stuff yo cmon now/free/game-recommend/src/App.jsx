import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Filter, Gamepad2, Grid2X2, House, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { fallbackGames } from './data/fallbackGames.js';
import { CatalogGameCard } from './components/CatalogGameCard.jsx';
import { GameDetailPage } from './components/GameDetailPage.jsx';
import { GamePreview } from './components/GamePreview.jsx';
import { HelpWindow } from './components/HelpWindow.jsx';
import { MatchCard } from './components/MatchCard.jsx';
import { ScrollPanel } from './components/ScrollPanel.jsx';
import { SelectedGameCard } from './components/SelectedGameCard.jsx';
import { WindowScrollBar } from './components/WindowScrollBar.jsx';
import {
  MATCH_COLUMNS,
  MATCH_PAGE_SIZE,
  categoryByValue,
  categoryOptions,
  cleanGame,
  countBy,
  countLabel,
  initialFilters,
  isAllowedGame,
  labelList,
  localFilter,
  getGenreNames,
  handleImageError,
  imageFor,
  platforms,
  sortOptions,
  topKeys,
  getPlatformNames,
  getSignalTagNames,
  getTagNames,
  normalizeMatchLabel,
  toTitleLabel,
} from './lib/gameData.js';
import { fetchMatches, gameMatchBreakdown, matchScoreForMode, passesMatchMode } from './lib/recommendations.js';
import { RAWG_KEY, fetchGameAdditions, fetchGameDetails, fetchGameMovies, fetchGameScreenshots, fetchGameSeries, fetchRawgGames } from './lib/rawg.js';

const NOT_INTERESTED_STORAGE_KEY = 'nextgame-not-interested-v1';
const MATCHED_GAMES_STORAGE_KEY = 'nextgame-matched-games-v1';
const MATCH_MODES = [
  { label: 'Safe picks', value: 'safe' },
  { label: 'Hidden gems', value: 'hidden' },
  { label: 'Wildcards', value: 'wildcard' },
];

function loadStoredGames(key) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(cleanGame)
      .filter(isAllowedGame)
      .filter((game, index, items) => items.findIndex((entry) => entry.id === game.id) === index);
  } catch {
    return [];
  }
}

function persistStoredGames(key, games) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(games));
}


function signalKey(signal) {
  return `${signal.type}:${signal.value}`;
}

function gameHasSignal(game, signal) {
  if (signal.type === 'genre') {
    return getGenreNames(game).map(normalizeMatchLabel).includes(signal.value);
  }

  if (signal.type === 'platform') {
    return getPlatformNames(game).map(normalizeMatchLabel).includes(signal.value);
  }

  return getTagNames(game).map(normalizeMatchLabel).includes(signal.value);
}

function gamePassesExcludedSignals(game, excludedSignals) {
  return !excludedSignals.some((signal) => gameHasSignal(game, signal));
}

function gameMatchesPlatforms(game, enabled, selectedPlatforms) {
  if (!enabled) {
    return true;
  }

  const wantedPlatforms = new Set(selectedPlatforms.map(normalizeMatchLabel));
  if (!wantedPlatforms.size) {
    return false;
  }

  return getPlatformNames(game).some((platform) => wantedPlatforms.has(normalizeMatchLabel(platform)));
}

function App() {
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [games, setGames] = useState(fallbackGames.map(cleanGame).filter(isAllowedGame));
  const [selectedGames, setSelectedGames] = useState([]);
  const [notInterestedGames, setNotInterestedGames] = useState(() => loadStoredGames(NOT_INTERESTED_STORAGE_KEY));
  const [savedMatchGames, setSavedMatchGames] = useState(() => loadStoredGames(MATCHED_GAMES_STORAGE_KEY));
  const [excludedSignals, setExcludedSignals] = useState([]);
  const [matchMode, setMatchMode] = useState('safe');
  const [matchPlatformFilterEnabled, setMatchPlatformFilterEnabled] = useState(false);
  const [matchPlatformSelections, setMatchPlatformSelections] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchOffset, setMatchOffset] = useState(0);
  const [matchDirection, setMatchDirection] = useState('next');
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState('');
  const [activePreviewGame, setActivePreviewGame] = useState(null);
  const [activeGamePage, setActiveGamePage] = useState(null);
  const [gameDetails, setGameDetails] = useState({});
  const [gameMedia, setGameMedia] = useState({});
  const [gameRelated, setGameRelated] = useState({});
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const selectedIds = useMemo(() => new Set(selectedGames.map((game) => game.id)), [selectedGames]);
  const notInterestedIds = useMemo(() => new Set(notInterestedGames.map((game) => game.id)), [notInterestedGames]);
  const savedMatchIds = useMemo(() => new Set(savedMatchGames.map((game) => game.id)), [savedMatchGames]);
  const rejectionContext = useMemo(
    () => ({
      rejectedGames: notInterestedGames,
      excludedSignals,
      matchMode,
    }),
    [excludedSignals, matchMode, notInterestedGames],
  );
  const catalogRequestId = useRef(0);

  useEffect(() => {
    persistStoredGames(NOT_INTERESTED_STORAGE_KEY, notInterestedGames);
  }, [notInterestedGames]);

  useEffect(() => {
    persistStoredGames(MATCHED_GAMES_STORAGE_KEY, savedMatchGames);
  }, [savedMatchGames]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const currentRequestId = ++catalogRequestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const nextGames = await fetchRawgGames(filters);
        if (catalogRequestId.current === currentRequestId) {
          setGames(nextGames);
        }
      } catch (fetchError) {
        if (catalogRequestId.current === currentRequestId) {
          setGames(localFilter(fallbackGames, filters));
          setError(`${fetchError.message} Showing demo catalog.`);
        }
      } finally {
        if (catalogRequestId.current === currentRequestId) {
          setLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (!activePreviewGame || Object.prototype.hasOwnProperty.call(gameDetails, activePreviewGame.id)) {
      return;
    }

    let ignore = false;
    setPreviewLoadingId(activePreviewGame.id);

    fetchGameDetails(activePreviewGame.id)
      .then((detail) => {
        if (!ignore) {
          setGameDetails((current) => ({ ...current, [activePreviewGame.id]: detail || null }));
        }
      })
      .finally(() => {
        if (!ignore) {
          setPreviewLoadingId(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activePreviewGame, gameDetails]);

  useEffect(() => {
    if (!activeGamePage || !RAWG_KEY) {
      return;
    }

    const gameId = activeGamePage.id;
    const hasCachedDetail = Object.prototype.hasOwnProperty.call(gameDetails, gameId);
    const hasCachedMedia = Object.prototype.hasOwnProperty.call(gameMedia, gameId);
    const hasCachedRelated = Object.prototype.hasOwnProperty.call(gameRelated, gameId);
    const cachedDetail = gameDetails[gameId];
    const cachedMedia = gameMedia[gameId];
    const cachedRelated = gameRelated[gameId];

    if (hasCachedDetail && hasCachedMedia && hasCachedRelated) {
      return;
    }

    let ignore = false;
    setDetailLoadingId(gameId);

    Promise.all([
      hasCachedDetail ? Promise.resolve(cachedDetail) : fetchGameDetails(gameId),
      hasCachedMedia ? Promise.resolve(cachedMedia.screenshots || []) : fetchGameScreenshots(gameId),
      hasCachedMedia ? Promise.resolve(cachedMedia.movies || []) : fetchGameMovies(gameId),
      hasCachedRelated ? Promise.resolve(cachedRelated.additions || []) : fetchGameAdditions(gameId),
      hasCachedRelated ? Promise.resolve(cachedRelated.series || []) : fetchGameSeries(gameId),
    ])
      .then(([detail, screenshots, movies, additions, series]) => {
        if (ignore) {
          return;
        }

        setGameDetails((current) => ({ ...current, [gameId]: detail || null }));
        setGameMedia((current) => ({
          ...current,
          [gameId]: {
            screenshots,
            movies,
          },
        }));
        setGameRelated((current) => ({
          ...current,
          [gameId]: {
            additions,
            series,
          },
        }));
      })
      .finally(() => {
        if (!ignore) {
          setDetailLoadingId(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeGamePage, gameDetails, gameMedia, gameRelated]);

  const selectedProfile = useMemo(() => {
    const genreLabels = topKeys(countBy(selectedGames.flatMap(getGenreNames)), 4);
    const platformLabels = topKeys(countBy(selectedGames.flatMap(getPlatformNames)), 4);
    const tagLabels = topKeys(countBy(selectedGames.flatMap(getSignalTagNames)), 6).map(toTitleLabel);
    const rating = selectedGames.reduce((total, game) => total + game.rating, 0) / Math.max(selectedGames.length, 1);

    return {
      genres: genreLabels,
      platforms: platformLabels,
      tags: tagLabels,
      rating,
    };
  }, [selectedGames]);

  const excludeOptions = useMemo(() => {
    const makeSignal = (type, label) => ({ type, label, value: normalizeMatchLabel(label) });
    const options = [
      ...selectedProfile.genres.map((label) => makeSignal('genre', label)),
      ...selectedProfile.platforms.map((label) => makeSignal('platform', label)),
      ...selectedProfile.tags.map((label) => makeSignal('tag', label)),
    ];
    const excludedKeys = new Set(excludedSignals.map(signalKey));

    return options.filter((option) => option.value && !excludedKeys.has(signalKey(option))).slice(0, 12);
  }, [excludedSignals, selectedProfile]);

  const catalogOverview = useMemo(() => {
    const leadingPlatforms = topKeys(countBy(games.flatMap(getPlatformNames)), 3);
    const visiblePlatforms = new Set(games.flatMap(getPlatformNames).filter(Boolean));

    return {
      leadingPlatforms,
      platformCount: visiblePlatforms.size,
    };
  }, [games]);

  const catalogReadout = useMemo(
    () => [
      filters.search.trim() ? 'Query search' : 'Full library',
      categoryByValue.get(filters.category)?.label || 'All genres',
      platforms.find((platform) => platform.value === filters.platform)?.label || 'All platforms',
      `${sortOptions.find((sortOption) => sortOption.value === filters.ordering)?.label || 'GN algorithm'} sort`,
      `${filters.minRating.toFixed(1)}+ rating`,
    ],
    [filters],
  );

  const selectedMatchPlatforms = useMemo(() => topKeys(countBy(selectedGames.flatMap(getPlatformNames)), 8), [selectedGames]);
  const filteredMatches = useMemo(
    () =>
      matches
        .map((game) => {
          const matchBreakdown = game.matchBreakdown || gameMatchBreakdown(game, selectedGames, rejectionContext);

          return {
            ...game,
            matchBreakdown,
            matchScore: matchScoreForMode(game, matchBreakdown, rejectionContext),
          };
        })
        .filter((game) => passesMatchMode(game, matchMode, game.matchBreakdown))
        .filter((game) => gamePassesExcludedSignals(game, excludedSignals))
        .filter((game) => gameMatchesPlatforms(game, matchPlatformFilterEnabled, matchPlatformSelections))
        .sort((a, b) => b.matchScore - a.matchScore),
    [excludedSignals, matchPlatformFilterEnabled, matchPlatformSelections, matches, rejectionContext, selectedGames],
  );
  const visibleMatches = showAllMatches ? filteredMatches : filteredMatches.slice(matchOffset, matchOffset + MATCH_PAGE_SIZE);
  const maxMatchOffset = Math.max(0, Math.ceil((filteredMatches.length - MATCH_PAGE_SIZE) / MATCH_COLUMNS) * MATCH_COLUMNS);

  useEffect(() => {
    setMatchOffset((current) => Math.min(current, maxMatchOffset));
  }, [maxMatchOffset]);

  useEffect(() => {
    setMatchPlatformSelections((current) => {
      const available = new Set(selectedMatchPlatforms);
      const next = current.filter((platform) => available.has(platform));

      if (!next.length && selectedMatchPlatforms.length) {
        return selectedMatchPlatforms;
      }

      return next;
    });
  }, [selectedMatchPlatforms]);

  const updateFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const handleSearch = useCallback(() => {
    updateFilter('search', searchInput);
  }, [searchInput, updateFilter]);

  const addExcludedSignal = useCallback((signal) => {
    setExcludedSignals((current) => {
      const key = signalKey(signal);
      if (current.some((entry) => signalKey(entry) === key)) {
        return current;
      }

      return [...current, signal];
    });
    setMatchOffset(0);
  }, []);

  const removeExcludedSignal = useCallback((signal) => {
    const key = signalKey(signal);
    setExcludedSignals((current) => current.filter((entry) => signalKey(entry) !== key));
    setMatchOffset(0);
  }, []);

  const toggleMatchPlatform = useCallback((platform) => {
    setMatchPlatformSelections((current) =>
      current.includes(platform) ? current.filter((entry) => entry !== platform) : [...current, platform],
    );
    setMatchOffset(0);
  }, []);

  const toggleNotInterested = useCallback((game) => {
    if (!isAllowedGame(game)) {
      return;
    }

    const nextGame = cleanGame(game);
    const isAlreadyIgnored = notInterestedIds.has(nextGame.id);

    setNotInterestedGames((current) =>
      isAlreadyIgnored
        ? current.filter((ignoredGame) => ignoredGame.id !== nextGame.id)
        : [nextGame, ...current.filter((ignoredGame) => ignoredGame.id !== nextGame.id)].slice(0, 30),
    );

    if (!isAlreadyIgnored) {
      setSelectedGames((current) => current.filter((selectedGame) => selectedGame.id !== nextGame.id));
      setSavedMatchGames((current) => current.filter((savedGame) => savedGame.id !== nextGame.id));
      setMatches((current) => current.filter((candidate) => candidate.id !== nextGame.id));
    }
  }, [notInterestedIds]);

  const toggleSavedMatchGame = useCallback((game) => {
    if (!isAllowedGame(game)) {
      return;
    }

    const nextGame = cleanGame(game);

    setNotInterestedGames((current) => current.filter((ignoredGame) => ignoredGame.id !== nextGame.id));
    setSavedMatchGames((current) => {
      if (current.some((savedGame) => savedGame.id === nextGame.id)) {
        return current.filter((savedGame) => savedGame.id !== nextGame.id);
      }

      return [nextGame, ...current].slice(0, 30);
    });
  }, []);

  const removeSavedMatchGame = useCallback((id) => {
    setSavedMatchGames((current) => current.filter((game) => game.id !== id));
  }, []);

  const clearSavedMatchGames = useCallback(() => {
    setSavedMatchGames([]);
  }, []);

  const exportSavedMatches = useCallback(() => {
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const lines = savedMatchGames.map((game, index) => {
      const genres = labelList(getGenreNames(game), '—');
      return `${String(index + 1).padStart(2, '0')}. ${game.name}\n    ${genres}  ·  ${game.rating.toFixed(1)} / 5`;
    });
    const content = `go_next — Saved Matches\nExported: ${date}\n${'─'.repeat(40)}\n\n${lines.join('\n\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'go_next_matches.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [savedMatchGames]);

  const addGame = useCallback((game) => {
    if (!isAllowedGame(game)) {
      return;
    }

    const nextGame = cleanGame(game);

    setNotInterestedGames((current) => current.filter((ignoredGame) => ignoredGame.id !== nextGame.id));
    setSelectedGames((current) => {
      if (current.some((selectedGame) => selectedGame.id === nextGame.id)) {
        return current.filter((selectedGame) => selectedGame.id !== nextGame.id);
      }

      return [nextGame, ...current].slice(0, 12);
    });
  }, []);

  const removeGame = useCallback((id) => {
    setSelectedGames((current) => current.filter((game) => game.id !== id));
  }, []);

  function slideMatches(delta) {
    setMatchDirection(delta > 0 ? 'next' : 'prev');
    setMatchOffset((current) => Math.min(Math.max(current + delta, 0), maxMatchOffset));
  }

  const openPreview = useCallback((game) => {
    setActiveGamePage(null);
    setActivePreviewGame(cleanGame(game));
  }, []);

  const closePreview = useCallback(() => {
    setActivePreviewGame(null);
  }, []);

  const openGamePage = useCallback((game) => {
    setActivePreviewGame(null);
    setActiveGamePage(cleanGame(game));
  }, []);

  async function handleSubmit() {
    if (!selectedGames.length) {
      setMatches([]);
      setError('Add at least one game before finding matches.');
      return;
    }

    setMatching(true);
    setError('');

    try {
      const nextMatches = await fetchMatches(selectedGames, filters, rejectionContext);
      setMatches(nextMatches);
      setMatchOffset(0);
      setShowAllMatches(false);
    } catch (fetchError) {
      const excludedIds = new Set([...selectedIds, ...notInterestedIds]);
      const fallbackMatches = localFilter(fallbackGames, { ...filters, search: '' }, excludedIds)
        .filter((game) => gamePassesExcludedSignals(game, excludedSignals))
        .slice(0, 30)
        .map((game) => {
          const matchBreakdown = gameMatchBreakdown(game, selectedGames, rejectionContext);

          return {
            ...game,
            matchBreakdown,
            baseMatchScore: matchBreakdown.baseScore,
            matchScore: matchScoreForMode(game, matchBreakdown, rejectionContext),
          };
        });

      setMatches(fallbackMatches);
      setMatchOffset(0);
      setShowAllMatches(false);
      setError(`${fetchError.message} Showing demo matches.`);
    } finally {
      setMatching(false);
    }
  }

  return (
    <main className="desktop-shell" id="app-top">
      <WindowScrollBar />
      <nav className="desktop-icons" aria-label="Desktop shortcuts">
        <a href="#app-top">
          <i className="desktop-icon desktop-icon-home">
            <House size={20} strokeWidth={2.6} />
          </i>
          Home
        </a>
        <a href="#search-panel">
          <i className="desktop-icon desktop-icon-search">
            <Search size={22} strokeWidth={3} />
          </i>
          Search
        </a>
        <a href="#matches">
          <i className="desktop-icon desktop-icon-list">
            <Gamepad2 size={18} strokeWidth={2.4} />
          </i>
          Results
        </a>
        <a href="#matched-list">
          <i className="desktop-icon desktop-icon-star">
            <Sparkles size={18} strokeWidth={2.4} />
          </i>
          Matches
        </a>
      </nav>

      <section className="app-window">
        <div className="window-titlebar">
          <span className="titlebar-icon" />
          <span>GO_NEXT.EXE</span>
          <div className="window-controls" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="toolbar" aria-label="App menu">
          <a className="toolbar-link toolbar-link-file" href="#app-top">
            File
          </a>
          <a className="toolbar-link toolbar-link-filter" href="#search-panel">
            Filter
          </a>
          <a className="toolbar-link toolbar-link-match" href="#matches">
            Match
          </a>
          <button type="button" className="toolbar-button toolbar-button-help" onClick={() => setShowHelp(true)}>
            Help
          </button>
        </div>

        <section className="hero-panel" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-kicker">GAME ANALYZER READY</p>
            <h1 id="hero-title">go_next</h1>
            <p className="hero-subheader">Pick games you love. Discover what to play next.</p>
            <div className="hero-infobar" aria-label="Main page overview">
              <span>Find games you like</span>
              <span>Build your queue</span>
              <span>Get smart matches</span>
            </div>
          </div>

          <div className="hero-actions" aria-label="Primary navigation">
            <a className="hero-link hero-link-search" href="#search-panel">
              <Search size={18} />
              Search
            </a>
            <a className="hero-link hero-link-games" href="#matches">
              <Gamepad2 size={18} />
              Results
            </a>
            <a className="hero-link hero-link-matches" href="#matched-list">
              <Sparkles size={18} />
              Matches
            </a>
          </div>
        </section>

        <form
          className="search-window"
          id="search-panel"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <div className="search-row">
            <label className="search-box" htmlFor="catalog-search">
              <span className="search-glyph" aria-hidden="true">
                <Search size={17} strokeWidth={3} />
              </span>
              <input id="catalog-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search games" />
            </label>

            <div className="search-actions">
              <button className="search-submit" type="submit">
                Search
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <label>
              Genre / Theme
              <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
                {categoryOptions.map((category) => (
                  <option key={category.value || category.label} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Platform
              <select value={filters.platform} onChange={(event) => updateFilter('platform', event.target.value)}>
                {platforms.map((platform) => (
                  <option key={platform.label} value={platform.value}>
                    {platform.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sort
              <select value={filters.ordering} onChange={(event) => updateFilter('ordering', event.target.value)}>
                {sortOptions.map((sortOption) => (
                  <option key={sortOption.value} value={sortOption.value}>
                    {sortOption.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rating-control">
              Rating {filters.minRating.toFixed(1)}+
              <input type="range" min="0" max="5" step="0.1" value={filters.minRating} onChange={(event) => updateFilter('minRating', Number(event.target.value))} />
            </label>
          </div>
        </form>

        {error && <div className="status-strip error-strip">{error}</div>}
        {!RAWG_KEY && <div className="status-strip">Demo catalog loaded. Add a RAWG key in `.env` for live search.</div>}

        <div className="workspace-grid">
          <section className="pane catalog-pane" id="games-panel">
            <div className="pane-titlebar">
              <span>CATALOG.DAT</span>
              <span>{loading ? 'Scanning...' : `${games.length} files`}</span>
            </div>

            <div className="catalog-overview">
              <div className="catalog-overview-stats" aria-label="Catalog overview">
                <div>
                  <span>Games shown</span>
                  <strong>{loading ? '...' : countLabel(games.length)}</strong>
                </div>
                <div>
                  <span>Platforms covered</span>
                  <strong>{loading ? '...' : countLabel(catalogOverview.platformCount)}</strong>
                </div>
                <div>
                  <span>Leading platforms</span>
                  <strong>{labelList(catalogOverview.leadingPlatforms, 'Mixed')}</strong>
                </div>
              </div>
            </div>

            <div className="catalog-readout">
              {catalogReadout.map((entry, index) => (
                <span key={`${entry}-${index}`}>{entry}</span>
              ))}
            </div>

            <ScrollPanel className="game-results" viewportClassName="game-results-viewport" ariaLabel="Catalog results">
              {games.map((game) => (
                <CatalogGameCard
                  key={game.id}
                  game={game}
                  isRejected={notInterestedIds.has(game.id)}
                  isSelected={selectedIds.has(game.id)}
                  onAdd={addGame}
                  onPreview={openPreview}
                  onToggleRejected={toggleNotInterested}
                />
              ))}
            </ScrollPanel>
          </section>

          <aside className="pane selected-pane" id="selected-panel">
            <div className="pane-titlebar">
              <span>SELECTED.LST</span>
              <span>{selectedGames.length}/12</span>
            </div>

            <ScrollPanel className="selected-list" viewportClassName="selected-list-viewport" ariaLabel="Selected games">
              {selectedGames.length ? (
                selectedGames.map((game) => <SelectedGameCard key={game.id} game={game} onPreview={openPreview} onRemove={removeGame} />)
              ) : (
                <div className="empty-panel">
                  <Filter size={26} />
                  <p>No games selected</p>
                </div>
              )}
            </ScrollPanel>

            <div className="profile-panel">
              <p className="panel-label">Taste profile</p>
              <dl>
                <div>
                  <dt>Genres</dt>
                  <dd>{labelList(selectedProfile.genres, 'None')}</dd>
                </div>
                <div>
                  <dt>Platforms</dt>
                  <dd>{labelList(selectedProfile.platforms, 'None')}</dd>
                </div>
                <div>
                  <dt>Avg rating</dt>
                  <dd>{selectedGames.length ? selectedProfile.rating.toFixed(1) : '0.0'}</dd>
                </div>
              </dl>
            </div>

            {notInterestedGames.length ? (
              <div className="queue-tools ignored-tools">
                <p className="panel-label">Recently ignored</p>
                {notInterestedGames.slice(0, 4).map((game) => (
                  <button type="button" className="ignored-game-button" key={game.id} onClick={() => toggleNotInterested(game)} title="Remove from ignored">
                    <span>{game.name}</span>
                    <span>Undo</span>
                  </button>
                ))}
              </div>
            ) : null}

            <button type="button" className="secondary-button" onClick={() => setSelectedGames([])} disabled={!selectedGames.length}>
              <Trash2 size={17} />
              Clear list
            </button>
          </aside>
        </div>
      </section>

      <section className="matches-window" id="matches">
        <div className="window-titlebar">
          <span className="titlebar-icon" />
          <span>MATCH_RESULTS.GRP</span>
          <div className="window-controls" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="match-controls" aria-label="Match controls">
          <button className="primary-button" type="button" onClick={handleSubmit} disabled={matching || selectedGames.length === 0}>
            <Sparkles size={18} />
            {matching ? 'Matching...' : 'Find matches'}
          </button>
          <div className="match-mode-control" role="group" aria-label="Match confidence">
            {MATCH_MODES.map((mode) => (
              <button
                type="button"
                key={mode.value}
                className={matchMode === mode.value ? 'active-pager-button' : ''}
                onClick={() => {
                  setMatchMode(mode.value);
                  setMatchOffset(0);
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="platform-match-filter">
            <label>
              <input
                type="checkbox"
                checked={matchPlatformFilterEnabled}
                onChange={(event) => {
                  setMatchPlatformFilterEnabled(event.target.checked);
                  setMatchOffset(0);
                }}
                disabled={!selectedMatchPlatforms.length}
              />
              Only show selected platforms
            </label>
            {matchPlatformFilterEnabled && selectedMatchPlatforms.length ? (
              <div className="platform-checklist">
                {selectedMatchPlatforms.map((platform) => (
                  <label key={platform}>
                    <input type="checkbox" checked={matchPlatformSelections.includes(platform)} onChange={() => toggleMatchPlatform(platform)} />
                    {platform}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="match-pager">
          <button type="button" onClick={() => slideMatches(-(MATCH_COLUMNS * 2))} disabled={showAllMatches || matchOffset === 0 || filteredMatches.length <= MATCH_PAGE_SIZE}>
            <ChevronUp size={17} />
            Page Up
          </button>
          <span>
            {showAllMatches
              ? `${filteredMatches.length} / ${filteredMatches.length}`
              : filteredMatches.length
                ? `${matchOffset + 1}-${Math.min(matchOffset + MATCH_PAGE_SIZE, filteredMatches.length)} / ${filteredMatches.length}`
                : '0 / 0'}
          </span>
          <button
            type="button"
            className={showAllMatches ? 'active-pager-button' : ''}
            onClick={() => {
              setShowAllMatches((current) => !current);
              setMatchOffset(0);
            }}
            disabled={!filteredMatches.length}
          >
            <Grid2X2 size={17} />
            {showAllMatches ? 'Paged view' : 'Show all'}
          </button>
          <button type="button" onClick={() => slideMatches(MATCH_COLUMNS * 2)} disabled={showAllMatches || matchOffset >= maxMatchOffset || filteredMatches.length <= MATCH_PAGE_SIZE}>
            Page Down
            <ChevronDown size={17} />
          </button>
        </div>

        <div id="match-results" className={`matches-grid ${showAllMatches ? 'matches-grid-all' : ''} match-slide-${matchDirection}`} key={`${showAllMatches ? 'all' : matchOffset}-${filteredMatches.length}`}>
          {visibleMatches.length ? (
            visibleMatches.map((game) => (
              <MatchCard
                key={game.id}
                game={game}
                isRejected={notInterestedIds.has(game.id)}
                isSavedMatch={savedMatchIds.has(game.id)}
                onPreview={openPreview}
                onToggleSavedMatch={toggleSavedMatchGame}
                onToggleRejected={toggleNotInterested}
                selectedGames={selectedGames}
              />
            ))
          ) : (
            <div className="empty-results">
              <Sparkles size={34} />
              <h2>Matches appear here</h2>
              <p>Add a few games, then generate a recommendation pass.</p>
            </div>
          )}
        </div>

        <section id="matched-list" className={`match-saved-panel ${savedMatchGames.length ? '' : 'match-saved-panel-empty'}`.trim()} aria-label="Saved matches list">
          <div className="pane-titlebar match-saved-titlebar">
            <span>MATCHED.LST</span>
            <span className="match-saved-count">{savedMatchGames.length}/30</span>
          </div>
          <ScrollPanel className="matched-list" viewportClassName="matched-list-viewport" ariaLabel="Saved matched games">
            {savedMatchGames.length ? (
              savedMatchGames.map((game, index) => (
                <div className="matched-game-row" key={game.id}>
                  <span className="matched-game-rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <button type="button" className="matched-game-open" onClick={() => openPreview(game)} title="Open game preview">
                    <img className="matched-game-thumb" src={imageFor(game)} alt="" onError={(event) => handleImageError(event, game)} />
                    <div className="matched-game-copy">
                      <span>{game.name}</span>
                      <small>{labelList(getGenreNames(game), '—')} &middot; {game.rating.toFixed(1)}</small>
                    </div>
                  </button>
                  <div className="matched-row-actions">
                    <button type="button" className="icon-button reject-button" onClick={() => removeSavedMatchGame(game.id)} title="Remove from saved matches" aria-label={`Remove ${game.name} from saved matches`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-panel">
                <p>Save matches with +</p>
              </div>
            )}
          </ScrollPanel>
          {savedMatchGames.length > 0 && (
            <div className="matched-actions">
              <button type="button" className="secondary-button matched-export-button" onClick={exportSavedMatches}>
                <Download size={17} />
                Export list
              </button>
              <button type="button" className="secondary-button matched-clear-button" onClick={clearSavedMatchGames}>
                <Trash2 size={17} />
                Clear
              </button>
            </div>
          )}
        </section>
      </section>

      {activePreviewGame && (
        <GamePreview
          game={activePreviewGame}
          detail={gameDetails[activePreviewGame.id]}
          loading={previewLoadingId === activePreviewGame.id}
          onClose={closePreview}
          onOpenPage={() => openGamePage(activePreviewGame)}
          preferences={rejectionContext}
          selectedGames={selectedGames}
        />
      )}

      {activeGamePage && (
        <GameDetailPage
          game={activeGamePage}
          detail={gameDetails[activeGamePage.id]}
          media={gameMedia[activeGamePage.id]}
          related={gameRelated[activeGamePage.id]}
          loading={detailLoadingId === activeGamePage.id}
          onClose={() => setActiveGamePage(null)}
          onOpenRelated={openGamePage}
        />
      )}

      {showHelp && <HelpWindow onClose={() => setShowHelp(false)} />}
    </main>
  );
}

export default App;

