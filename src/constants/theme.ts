export const COLORS = {
  background: '#050707',
  surface: '#090B0B',
  surfaceLight: '#0D1010',
  glass: 'rgba(255, 255, 255, 0.05)', // Extremely subtle glass
  // Opaque lift for bars that sit over scrolling content (mini player, tab bar).
  // These must not be translucent: blur is unreliable on Android, so content
  // would otherwise read straight through them.
  surfaceRaised: '#121616',
  hairline: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.1)', // 1px borders
  
  text: {
    primary: '#F0F0F0',
    secondary: '#888888',
    muted: '#555555',
  },
  
  accent: {
    // Audia brand accent: cool aurora teal. Used for the active states that
    // used to be flat white -- the brand now shows through the whole UI.
    primary: '#3DD6C3',
    glow: 'rgba(61, 214, 195, 0.14)',
    green: '#3DD6C3', // legacy alias: the "green" accent is now Audia teal
    greenGlow: 'rgba(61, 214, 195, 0.14)',
    red: '#FF5A5A',
    redGlow: 'rgba(255, 90, 90, 0.15)',
  },
  
  player: {
    progressTrack: 'rgba(255, 255, 255, 0.2)',
    progressFill: '#FFFFFF',
  }
};

export const SIZES = {
  /**
   * Clearance a scrolling screen must leave at the bottom so the last row is
   * never trapped under the tab bar + mini player.
   */
  bottomInset: 150,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    pill: 999,
  }
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SHADOWS = {
  glass: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10, // For Android
  },
  ambient: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  }
};
