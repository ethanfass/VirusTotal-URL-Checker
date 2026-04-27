import { useId, useRef } from 'react';
import { CircleHelp, Gamepad2, Search, Sparkles } from 'lucide-react';
import { useDialog } from '../hooks/useDialog.js';

export function HelpWindow({ onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const dialogRef = useDialog({ isOpen: true, onClose, initialFocusRef: closeButtonRef });

  return (
    <section className="help-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="help-window" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex="-1">
        <div className="window-titlebar">
          <span className="titlebar-icon" />
          <span id={titleId}>HELP.TXT</span>
          <div className="window-controls">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <button ref={closeButtonRef} type="button" className="window-close-button" onClick={onClose} aria-label="Close help" title="Close help" />
          </div>
        </div>

        <div className="help-panel">
          <div className="pane-titlebar">
            <span>NEXTGAME GUIDE</span>
            <span>Quick Help</span>
          </div>
          <div className="help-content">
            <p className="help-intro">Search the catalog, queue a few games, then click `Find matches` to get tailored recommendations.</p>

            <div className="help-grid">
              <section>
                <h2>
                  <Search size={16} />
                  1. Search
                </h2>
                <p>Use the top search bar to filter the catalog. Pressing Enter only updates search results.</p>
              </section>

              <section>
                <h2>
                  <Gamepad2 size={16} />
                  2. Queue Games
                </h2>
                <p>Add 3 to 6 games that actually represent the taste you want to match.</p>
              </section>

              <section>
                <h2>
                  <Sparkles size={16} />
                  3. Match
                </h2>
                <p>Click `Find matches` to run the NG algorithm. Open a result to see `WHY THIS MATCH` and score rank.</p>
              </section>
            </div>

            <div className="help-tips">
              <h2>
                <CircleHelp size={16} />
                Quick Tips
              </h2>
              <p>Specific picks give tighter results. Mixed genres widen the pool. Lower the rating floor if you want more niche games.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
