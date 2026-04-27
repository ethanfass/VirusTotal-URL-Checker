import { memo } from 'react';
import { Check, Plus, Star, X } from 'lucide-react';
import { fullLabelList, getGenreNames, getPlatformNames, handleImageError, imageFor, releaseYearLabel } from '../lib/gameData.js';

export const CatalogGameCard = memo(function CatalogGameCard({ game, isRejected, isSelected, onAdd, onPreview, onToggleRejected }) {
  const genreNames = getGenreNames(game);
  const platformNames = getPlatformNames(game);
  const primaryPlatforms = platformNames.slice(0, 3);
  const hiddenPlatformCount = Math.max(platformNames.length - primaryPlatforms.length, 0);
  const releaseYear = releaseYearLabel(game.released);
  const platformLabel = primaryPlatforms.length ? primaryPlatforms.join(', ') : 'Platform TBD';
  const compactMeta = [releaseYear !== 'TBA' ? releaseYear : null, `${platformLabel}${hiddenPlatformCount ? ` +${hiddenPlatformCount}` : ''}`]
    .filter(Boolean)
    .join(' // ');

  return (
    <article className={`game-row${isRejected ? ' game-row-muted' : ''}`}>
      <button type="button" className="card-trigger game-row-trigger" onClick={() => onPreview(game)} aria-label={`Open ${game.name} preview`}>
        <div className="game-row-cover">
          <img src={imageFor(game)} alt="" onError={(event) => handleImageError(event, game)} />
        </div>
        <div className="game-row-main">
          <div className="game-row-head">
            <div>
              <p className="game-name">{game.name}</p>
              <p className="game-meta">{fullLabelList(genreNames, 'Genre unavailable')}</p>
            </div>
          </div>
          <p className="game-row-subline">{compactMeta || 'Open preview for more details'}</p>
        </div>
      </button>
      <div className="game-row-utility">
        <div className="game-score-badge" aria-label={`Rated ${game.rating.toFixed(1)} out of 5`}>
          <Star size={15} />
          <strong>{game.rating.toFixed(1)}</strong>
          <small>/5</small>
        </div>
        <div className="game-row-action" role="group" aria-label={`Actions for ${game.name}`}>
          <button
            type="button"
            className={isSelected ? 'icon-button selected-button' : 'icon-button add-button'}
            onClick={() => onAdd(game)}
            title={isSelected ? 'Remove from selected' : 'Add game'}
            aria-label={isSelected ? `Remove ${game.name} from selected games` : `Add ${game.name} to selected games`}
            aria-pressed={isSelected}
          >
            {isSelected ? <Check size={17} /> : <Plus size={17} />}
          </button>
          <button
            type="button"
            className={isRejected ? 'icon-button reject-button' : 'icon-button ignore-button'}
            onClick={() => onToggleRejected(game)}
            title={isRejected ? 'Remove from not interested' : 'Mark not interested'}
            aria-label={isRejected ? `Remove ${game.name} from not interested` : `Mark ${game.name} as not interested`}
            aria-pressed={isRejected}
          >
            <X size={16} />
          </button>
          <span className="sr-only">{isRejected ? 'Muted' : isSelected ? 'Queued' : 'Actions'}</span>
        </div>
      </div>
    </article>
  );
});
