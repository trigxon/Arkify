import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { TrackActionsSheet } from './TrackActionsSheet';
import { Track } from '../../core/types';
import { usePlayer } from '../../hooks/usePlayer';

/**
 * The full Spotify-style track menu, pre-wired for any tab or stack screen:
 * queue control (Play next / Add to queue), Song radio, artist and album
 * jumps via a real search, like, playlists, share, download and the
 * destructive remove.
 *
 * NowPlaying keeps its own richer mount because it adds the sleep-timer entry
 * point; everywhere else mounts this host so the ••• on every row is the
 * complete menu rather than the reduced "add to playlist" sheet.
 */
export const TrackActionsHost: React.FC<{
  track: Track | null;
  onClose: () => void;
  /** Playlist the menu was opened from — enables "Remove from this playlist". */
  contextPlaylistId?: string;
}> = ({ track, onClose, contextPlaylistId }) => {
  const navigation = useNavigation();
  const { playNext, addToQueue, playRadio } = usePlayer();

  /** Artist/album jumps land on Search with the query pre-run. */
  const goToString = useCallback(
    (q: string) => {
      onClose();
      (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
        browseQuery: q,
      });
    },
    [navigation, onClose]
  );

  return (
    <TrackActionsSheet
      track={track}
      onClose={onClose}
      contextPlaylistId={contextPlaylistId}
      onPlayNext={playNext}
      onAddToQueue={addToQueue}
      onGoToRadio={(t) => void playRadio(t)}
      onGoToArtist={(t) => goToString(t.artist.name)}
      onViewAlbum={(t) => goToString([t.album, t.artist?.name].filter(Boolean).join(' '))}
    />
  );
};
