import { useId, useMemo, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { ScrollPanel } from './ScrollPanel.jsx';
import { useDialog } from '../hooks/useDialog.js';
import { countLabel, getGenreNames, getPlatformNames, handleImageError, imageFor, labelList } from '../lib/gameData.js';
import { getPreviewMatchReasons } from '../lib/recommendations.js';

export function GamePreview({ detail, game, loading, onClose, onOpenPage, preferences, selectedGames }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const dialogRef = useDialog({ isOpen: true, onClose, initialFocusRef: closeButtonRef });
  const matchReasons = useMemo(() => getPreviewMatchReasons(game, selectedGames, preferences), [game, selectedGames, preferences]);
  const description = useMemo(
    () =>
      detail?.description_raw ||
      game.description_raw ||
      `${game.name} matches ${labelList(getGenreNames(game).map((genre) => genre.toLowerCase()), 'your selected styles')} on ${labelList(
        getPlatformNames(game),
        'known platforms',
      )}.`,
    [detail, game],
  );

  return (
    <section className="preview-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="game-preview" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex="-1">
        <div className="preview-titlebar">
          <span id={titleId}>{game.name}</span>
          <div className="preview-titlebar-actions">
            <span>{loading ? 'Loading...' : 'Quick preview'}</span>
            <button ref={closeButtonRef} type="button" className="preview-close-button" onClick={onClose} aria-label="Close preview" title="Close preview">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="preview-body">
          <img className="preview-image" src={imageFor(game)} alt="" onError={(event) => handleImageError(event, game)} />
          <div className="preview-copy">
            <div className="preview-summary">
              <span>{labelList(getGenreNames(game), 'Unknown genre')}</span>
              <span>{labelList(getPlatformNames(game), 'TBA')}</span>
              <span>{game.released ? new Date(game.released).getFullYear() : 'TBA'}</span>
              <span>{countLabel(game.ratings_count || game.added)} ratings</span>
              {game.metacritic ? <span>MC {game.metacritic}</span> : null}
            </div>
            <ScrollPanel className="preview-description" viewportClassName="preview-description-viewport" ariaLabel={`${game.name} preview description`}>
              <p>{description}</p>
            </ScrollPanel>
            {matchReasons.length > 0 && (
              <section className="preview-match-notes" aria-label={`Why ${game.name} matched`}>
                <p className="panel-label">Why you matched with this game</p>
                <ul>
                  {matchReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>
            )}
            <div className="preview-actions">
              <button type="button" className="preview-open-button" onClick={onOpenPage}>
                <ExternalLink size={16} />
                View entire game page
              </button>
            </div>
          </div>
        </div>
        <dl>
          <div>
            <dt>Rating</dt>
            <dd>{game.rating.toFixed(1)} / 5</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>{(game.added || game.ratings_count || 0).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Metacritic</dt>
            <dd>{game.metacritic || 'N/A'}</dd>
          </div>
          <div>
            <dt>Playtime</dt>
            <dd>{game.playtime || '?'}h</dd>
          </div>
          <div>
            <dt>Release</dt>
            <dd>{game.released ? new Date(game.released).getFullYear() : 'TBA'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
