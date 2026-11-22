import React, { useState } from "react";
import type { AccessibilityProfile } from "@adaptui/shared-types";
import { AccessibleButton, AccessiblePage } from "@adaptui/accessible-ui";

export interface FavoriteItem {
  label: string;
  url: string;
  category: string;
  custom?: boolean;
}

export interface FavoritesPageProps {
  favorites: FavoriteItem[];
  currentUrl: string;
  currentTitle: string;
  profile: AccessibilityProfile;
  busy: boolean;
  onOpenFavorite: (url: string) => void;
  onBookmarkCurrent: () => void;
  onRemoveFavorite: (url: string) => void;
  onClose: () => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  favorites,
  currentUrl,
  currentTitle,
  profile,
  busy,
  onOpenFavorite,
  onBookmarkCurrent,
  onRemoveFavorite,
  onClose,
}) => {
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("cards");

  const alreadyBookmarked = favorites.some((f) => f.url === currentUrl);

  return (
    <AccessiblePage
      title="All Favorites"
      summary="Browse and open saved and demo websites in Card or Table view."
      profile={profile}
    >
      <div className="favorites-toolbar">
        <div className="shell-row" role="group" aria-label="Favorites view mode">
          <button
            type="button"
            className={`aui-button ${viewLayout === "cards" ? "aui-button-primary" : ""}`}
            aria-pressed={viewLayout === "cards"}
            onClick={() => setViewLayout("cards")}
          >
            Card View
          </button>
          <button
            type="button"
            className={`aui-button ${viewLayout === "table" ? "aui-button-primary" : ""}`}
            aria-pressed={viewLayout === "table"}
            onClick={() => setViewLayout("table")}
          >
            Table View
          </button>
        </div>

        <div className="shell-row">
          {currentUrl && !alreadyBookmarked && (
            <AccessibleButton
              label={`Bookmark "${currentTitle || currentUrl}"`}
              disabled={busy}
              onActivate={onBookmarkCurrent}
            />
          )}
          <AccessibleButton label="Back to Page" onActivate={onClose} />
        </div>
      </div>

      {viewLayout === "cards" ? (
        <section aria-label="Favorites card view" className="favorites-card-grid">
          {favorites.map((fav) => {
            const isCurrent = fav.url === currentUrl;
            return (
              <article
                key={fav.url}
                className={`favorites-card ${isCurrent ? "favorites-card-active" : ""}`}
              >
                <div className="favorites-card-header">
                  <h2 className="favorites-card-title">{fav.label}</h2>
                  <span className="shell-switch-pill">{fav.category}</span>
                </div>
                <p className="favorites-card-url">{fav.url}</p>
                <div className="favorites-card-actions">
                  <AccessibleButton
                    label={isCurrent ? "Open (Current)" : `Open ${fav.label}`}
                    variant="primary"
                    disabled={busy}
                    onActivate={() => onOpenFavorite(fav.url)}
                  />
                  {fav.custom && (
                    <AccessibleButton
                      label={`Remove ${fav.label}`}
                      variant="danger"
                      onActivate={() => onRemoveFavorite(fav.url)}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section aria-label="Favorites table view" className="aui-section">
          <div className="aui-table-wrap">
            <table className="aui-table">
              <caption>All Favorite Websites</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">URL</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {favorites.map((fav) => {
                  const isCurrent = fav.url === currentUrl;
                  return (
                    <tr key={fav.url}>
                      <td>
                        <strong>{fav.label}</strong>
                        {isCurrent && " (Current)"}
                      </td>
                      <td>{fav.category}</td>
                      <td className="favorites-table-url">{fav.url}</td>
                      <td>
                        <div className="shell-row">
                          <AccessibleButton
                            label={`Open ${fav.label}`}
                            variant="primary"
                            disabled={busy}
                            onActivate={() => onOpenFavorite(fav.url)}
                          />
                          {fav.custom && (
                            <AccessibleButton
                              label={`Remove ${fav.label}`}
                              variant="danger"
                              onActivate={() => onRemoveFavorite(fav.url)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AccessiblePage>
  );
};
