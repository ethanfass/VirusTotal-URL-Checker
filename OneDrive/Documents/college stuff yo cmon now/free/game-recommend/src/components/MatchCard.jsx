import { memo } from 'react';
import { Plus, X } from 'lucide-react';
import { gameMatchScore } from '../lib/recommendations.js';
import { getGenreNames, getPlatformNames, handleImageError, imageFor, labelList } from '../lib/gameData.js';

export const MatchCard = memo(function MatchCard({ game, isRejected, isSavedMatch, onPreview, onToggleSavedMatch, onToggleRejected, selectedGames }) {
  const displayedMatchScore = game.matchScore ?? gameMatchScore(game, selectedGames);

  return (
    <article className="match-card">
      <button type="button" className="card-trigger match-card-trigger" onClick={() => onPreview(game)} aria-label={`Open ${game.name} preview`}>
        <img src={imageFor(game)} alt="" onError={(event) => handleImageError(event, game)} />
        <div className="match-card-body">
          <p className="panel-label">Match {displayedMatchScore}</p>
          <h2>{game.name}</h2>
          <p>{labelList(getGenreNames(game))}</p>
          <div className="match-meta">
            <span>{labelList(getPlatformNames(game), 'TBA')}</span>
            <span>{game.rating.toFixed(1)} / 5</span>
          </div>
        </div>
      </button>
      <div className="match-card-actions">
        <button
          type="button"
          className={isSavedMatch ? 'icon-button add-button' : 'icon-button'}
          onClick={() => onToggleSavedMatch(game)}
          title={isSavedMatch ? 'Remove from matched list' : 'Add to matched list'}
          aria-label={isSavedMatch ? `Remove ${game.name} from matched list` : `Add ${game.name} to matched list`}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          className={isRejected ? 'icon-button reject-button' : 'icon-button'}
          onClick={() => onToggleRejected(game)}
          title={isRejected ? 'Remove from not interested' : 'Mark not interested'}
          aria-label={isRejected ? `Remove ${game.name} from not interested` : `Mark ${game.name} as not interested`}
        >
          <X size={16} />
        </button>
      </div>
    </article>
  );
});
