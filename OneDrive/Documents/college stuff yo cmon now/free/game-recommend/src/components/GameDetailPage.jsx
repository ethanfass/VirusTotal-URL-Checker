import { useId, useRef } from 'react';
import { ArrowLeft, Calendar, ExternalLink, Film, Gamepad2, Image as ImageIcon, Plus, Sparkles, Star, Clock, Trophy } from 'lucide-react';
import { ScrollPanel } from './ScrollPanel.jsx';
import { useDialog } from '../hooks/useDialog.js';
import {
  countLabel,
  dateLabel,
  firstTrailer,
  fullLabelList,
  getDetailPlatformNames,
  getDeveloperNames,
  getDisplayTagNames,
  getGenreNames,
  getPlatformNames,
  getPublisherNames,
  getStorefrontNames,
  getStorefrontOrPlatformNames,
  handleImageError,
  imageFor,
  labelList,
  numberLabel,
  trailerSource,
} from '../lib/gameData.js';

function getSystemRequirementRows(detail) {
  return (detail?.platforms || [])
    .map((platformEntry) => {
      const requirements = platformEntry.requirements_en || platformEntry.requirements || {};
      return {
        platform: platformEntry.platform?.name || 'Platform',
        minimum: requirements.minimum || '',
        recommended: requirements.recommended || '',
      };
    })
    .filter((row) => row.minimum || row.recommended);
}

function cleanRequirementText(text) {
  return text.replace(/^\s*(Minimum|Recommended):\s*/i, '').trim();
}

function parseRequirementLines(text) {
  return cleanRequirementText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{2,40}):\s*(.+)$/);
      if (!match) {
        return { label: '', value: line };
      }

      return {
        label: match[1].trim(),
        value: match[2].trim(),
      };
    });
}

function RequirementTier({ title, text }) {
  const rows = parseRequirementLines(text);

  if (!rows.length) {
    return null;
  }

  return (
    <section className="requirement-tier">
      <h3>{title}</h3>
      <dl className="requirement-spec-list">
        {rows.map((row, index) => (
          <div key={`${title}-${row.label || row.value}-${index}`}>
            {row.label ? <dt>{row.label}</dt> : <dt className="sr-only">{title} details</dt>}
            <dd className={row.label ? '' : 'requirement-spec-full'}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SystemRequirementsPanel({ rows }) {
  if (!rows.length) {
    return <div className="detail-empty">No system requirements returned from RAWG for this game.</div>;
  }

  return (
    <div className="requirements-box">
      <ScrollPanel className="requirement-selected" viewportClassName="requirement-selected-viewport" ariaLabel="System requirements">
        {rows.map((row) => (
          <article className="requirement-platform-card" key={row.platform}>
            <header className="requirement-platform-header">
              <h2>{row.platform}</h2>
              <span>{row.recommended ? 'Min + Rec' : 'Minimum'}</span>
            </header>
            <div className="requirement-tier-grid">
              {row.minimum && <RequirementTier title="Minimum" text={row.minimum} />}
              {row.recommended && <RequirementTier title="Recommended" text={row.recommended} />}
            </div>
          </article>
        ))}
      </ScrollPanel>
    </div>
  );
}

function RelatedGamesSection({ emptyText, games, onOpen, title }) {
  return (
    <section className="detail-panel">
      <div className="pane-titlebar">
        <span>{title}</span>
        <span>{games.length}</span>
      </div>
      {games.length ? (
        <div className="related-game-grid">
          {games.map((relatedGame) => (
            <button type="button" className="related-game-card" key={relatedGame.id} onClick={() => onOpen(relatedGame)}>
              <img src={imageFor(relatedGame)} alt="" onError={(event) => handleImageError(event, relatedGame)} />
              <span>{relatedGame.name}</span>
              <small>{fullLabelList(getStorefrontOrPlatformNames(relatedGame).slice(0, 3), 'No platform listed')}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="detail-empty">{emptyText}</div>
      )}
    </section>
  );
}

export function GameDetailPage({ detail, game, loading, media, related, onClose, onOpenRelated }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const dialogRef = useDialog({ isOpen: true, onClose, initialFocusRef: closeButtonRef });
  const screenshots = media?.screenshots || [];
  const movies = media?.movies || [];
  const additions = related?.additions || [];
  const series = related?.series || [];
  const trailer = firstTrailer(movies);
  const videoSource = trailerSource(trailer);
  const merged = { ...game, ...(detail || {}) };
  const genres = detail?.genres?.length ? getGenreNames(detail) : getGenreNames(game);
  const platformsList = getDetailPlatformNames(game, detail);
  const storefronts = getStorefrontNames(detail, game);
  const tags = detail?.tags?.length ? getDisplayTagNames(detail) : getDisplayTagNames(game);
  const developers = getDeveloperNames(detail);
  const publishers = getPublisherNames(detail);
  const requirementRows = getSystemRequirementRows(detail);
  const description =
    detail?.description_raw ||
    game.description_raw ||
    `${game.name} has ${labelList(genres.map((genre) => genre.toLowerCase()), 'catalog')} signals on ${labelList(platformsList, 'known platforms')}.`;
  const heroImage = trailer?.preview || detail?.background_image_additional || imageFor(merged);
  const rating = Number(merged.rating || 0);
  const statCards = [
    { label: 'Rating', value: rating ? `${rating.toFixed(1)} / 5` : 'N/A', icon: Star },
    { label: 'Ratings', value: countLabel(merged.ratings_count), icon: Trophy },
    { label: 'Added', value: countLabel(merged.added), icon: Plus },
    { label: 'Metacritic', value: merged.metacritic || 'N/A', icon: Sparkles },
    { label: 'Playtime', value: merged.playtime ? `${merged.playtime}h` : 'N/A', icon: Clock },
    { label: 'Released', value: dateLabel(merged.released), icon: Calendar },
    { label: 'Updated', value: dateLabel(detail?.updated, 'N/A'), icon: Calendar },
    { label: 'Achievements', value: countLabel(detail?.achievements_count), icon: Trophy },
    { label: 'Suggestions', value: countLabel(detail?.suggestions_count), icon: Sparkles },
    { label: 'Screenshots', value: countLabel(screenshots.length), icon: ImageIcon },
    { label: 'Trailers', value: countLabel(movies.length), icon: Film },
    { label: 'RAWG ID', value: merged.id || 'N/A', icon: Gamepad2 },
  ];
  const infoRows = [
    ['Genres', fullLabelList(genres)],
    ['Platforms', fullLabelList(storefronts, 'N/A')],
    ['Systems', fullLabelList(platformsList, 'TBA')],
    ['Developers', fullLabelList(developers, 'N/A')],
    ['Publishers', fullLabelList(publishers, 'N/A')],
    ['ESRB', detail?.esrb_rating?.name || 'N/A'],
    ['Slug', merged.slug || 'N/A'],
  ];
  const communityRows = [
    ['Reviews', numberLabel(detail?.reviews_count)],
    ['Reddit', numberLabel(detail?.reddit_count)],
    ['Twitch', numberLabel(detail?.twitch_count)],
    ['YouTube', numberLabel(detail?.youtube_count)],
  ].filter(([, value]) => value !== 'N/A');

  return (
    <section className="game-detail-page" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="game-detail-window" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex="-1">
        <div className="window-titlebar">
          <span className="titlebar-icon" />
          <span>{game.name}</span>
          <div className="window-controls">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <button ref={closeButtonRef} type="button" className="window-close-button" onClick={onClose} aria-label="Close details" title="Close details" />
          </div>
        </div>

        <button type="button" className="detail-back-button" onClick={onClose}>
          <ArrowLeft size={17} />
          Back
        </button>

        <div className="detail-hero">
          <div className="detail-media">
            {videoSource ? <video controls poster={heroImage} src={videoSource} /> : <img src={heroImage} alt="" onError={(event) => handleImageError(event, game)} />}
          </div>
          <div className="detail-hero-copy">
            <p className="panel-label">{loading ? 'Loading RAWG data' : 'RAWG detail page'}</p>
            <h1 id={titleId}>{game.name}</h1>
            <ScrollPanel className="detail-description" viewportClassName="detail-description-viewport" ariaLabel={`${game.name} description`}>
              <p>{description}</p>
            </ScrollPanel>
            <div className="detail-chip-row">
              {genres.slice(0, 5).map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </div>
            {detail?.website && (
              <a className="detail-link-button" href={detail.website} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Official game page
              </a>
            )}
          </div>
        </div>

        <div className="detail-stat-grid">
          {statCards.map(({ icon: Icon, label, value }) => (
            <div className="detail-stat-card" key={label}>
              <Icon size={17} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <section className="detail-panel">
          <div className="pane-titlebar">
            <span>SYS_REQ.TXT</span>
            <span>{requirementRows.length}</span>
          </div>
          <SystemRequirementsPanel rows={requirementRows} />
        </section>

        <div className="detail-content-grid">
          <section className="detail-panel">
            <div className="pane-titlebar">
              <span>API_FIELDS.DAT</span>
              <span>{loading ? 'Syncing' : 'Loaded'}</span>
            </div>
            <dl className="detail-info-list">
              {infoRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="detail-panel">
            <div className="pane-titlebar">
              <span>RATINGS.BIN</span>
              <span>{detail?.rating_top ? `Top ${detail.rating_top}` : 'RAWG'}</span>
            </div>
            {detail?.ratings?.length ? (
              <div className="rating-breakdown">
                {detail.ratings.map((ratingItem) => (
                  <div key={ratingItem.id || ratingItem.title}>
                    <span>{ratingItem.title}</span>
                    <meter min="0" max="100" value={ratingItem.percent || 0} />
                    <strong>{Math.round(ratingItem.percent || 0)}%</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="detail-empty">No rating breakdown in this API response.</div>
            )}
          </section>
        </div>

        {communityRows.length > 0 && (
          <section className="detail-panel">
            <div className="pane-titlebar">
              <span>COMMUNITY.STATS</span>
              <span>RAWG</span>
            </div>
            <dl className="detail-info-list community-list">
              {communityRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="detail-panel">
          <div className="pane-titlebar">
            <span>SCREENSHOTS.GAL</span>
            <span>{screenshots.length}</span>
          </div>
          {screenshots.length ? (
            <div className="screenshot-grid">
              {screenshots.map((screenshot) => (
                <img key={screenshot.id || screenshot.image} src={screenshot.image} alt="" />
              ))}
            </div>
          ) : (
            <div className="detail-empty">No screenshots returned from RAWG for this game.</div>
          )}
        </section>

        <section className="detail-panel">
          <div className="pane-titlebar">
            <span>TRAILERS.MOV</span>
            <span>{movies.length}</span>
          </div>
          {movies.length ? (
            <div className="trailer-list">
              {movies.map((movie) => (
                <article key={movie.id || movie.name}>
                  {trailerSource(movie) ? <video controls poster={movie.preview} src={trailerSource(movie)} /> : <img src={movie.preview} alt="" />}
                  <p>{movie.name || 'Trailer'}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="detail-empty">No trailers returned from RAWG for this game.</div>
          )}
        </section>

        <div className="detail-content-grid">
          <RelatedGamesSection title="DLC_ADDONS.GRP" games={additions} emptyText="No DLC or additions returned from RAWG for this game." onOpen={onOpenRelated} />
          <RelatedGamesSection title="SAME_SERIES.GRP" games={series} emptyText="No same-series games returned from RAWG for this game." onOpen={onOpenRelated} />
        </div>

        {tags.length > 0 && (
          <section className="detail-panel">
            <div className="pane-titlebar">
              <span>TAGS.LOG</span>
              <span>{tags.length}</span>
            </div>
            <div className="detail-chip-row detail-tags">
              {tags.slice(0, 28).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
