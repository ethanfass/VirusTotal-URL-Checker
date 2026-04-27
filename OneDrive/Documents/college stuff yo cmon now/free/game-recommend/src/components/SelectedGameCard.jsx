import { memo } from 'react';
import { X } from 'lucide-react';
import { getPlatformNames, handleImageError, imageFor, labelList } from '../lib/gameData.js';

export const SelectedGameCard = memo(function SelectedGameCard({ game, onPreview, onRemove }) {
  return (
    <article className="selected-game">
      <button type="button" className="card-trigger selected-game-trigger" onClick={() => onPreview(game)} aria-label={`Open ${game.name} preview`}>
        <img src={imageFor(game)} alt="" onError={(event) => handleImageError(event, game)} />
        <div className="selected-game-copy">
          <p className={`selected-game-title${game.name.length > 26 ? ' selected-game-title-compact' : game.name.length > 18 ? ' selected-game-title-tight' : ''}`}>
            {game.name}
          </p>
          <p className="selected-game-meta">{labelList(getPlatformNames(game), 'TBA')}</p>
        </div>
      </button>
      <div className="selected-game-actions">
        <button type="button" className="icon-button" onClick={() => onRemove(game.id)} title="Remove game" aria-label={`Remove ${game.name} from selected games`}>
          <X size={16} />
        </button>
      </div>
    </article>
  );
});
