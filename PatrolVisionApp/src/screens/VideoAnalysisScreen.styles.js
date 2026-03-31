import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── Idle picker area ──────────────────────────────────────────
  pickerArea: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(74,144,226,0.4)',
    borderStyle: 'dashed',
    borderRadius: 16,
    margin: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,144,226,0.06)',
    gap: 12,
  },
  pickerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  pickerSubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },

  // ── Video player ──────────────────────────────────────────────
  videoWrapper: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    justifyContent: 'center',
  },
  videoPlayer: {
    flex: 1,
    width: '100%',
  },

  // ANALYZING badge (top-left overlay)
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A90E2',
  },
  liveText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── Controls overlay ──────────────────────────────────────────
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 6,
  },

  // Time + speed + mute row
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  timeText: {
    color: '#FFF',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  speedBadge: {
    backgroundColor: 'rgba(74,144,226,0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 12,
  },
  speedText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Scrubber ──────────────────────────────────────────────────
  scrubberWrapper: {
    height: 28,
    justifyContent: 'center',
    marginBottom: 2,
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  scrubberFill: {
    height: 4,
    backgroundColor: '#4A90E2',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFF',
    marginLeft: -7,
    top: -5,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },

  // ── Transport buttons ─────────────────────────────────────────
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 4,
  },
  transportBtn: {
    padding: 6,
    opacity: 0.9,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(74,144,226,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Stats row (shown while analyzing) ────────────────────────
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(74,144,226,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(74,144,226,0.2)',
  },
  statBox: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: '#4A90E2',
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },

  // ── Violation summary list ────────────────────────────────────
  summaryList: {
    maxHeight: 100,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryListContent: {
    padding: 8,
    gap: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  violationCountBadge: {
    backgroundColor: '#E53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  violationCountText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  scanningText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    flex: 1,
  },
  violationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229,57,53,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.3)',
    padding: 10,
    gap: 8,
  },
  violationCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  violationCardInfo: {
    flex: 1,
  },
  violationCardType: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  violationCardMeta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  reportBtn: {
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reportBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  noViolationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noViolationsText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },

  // ── Done section ──────────────────────────────────────────────
  doneSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(76,175,80,0.2)',
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  frameSummary: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },

  // ── GPS row ───────────────────────────────────────────────────
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gpsText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },

  // ── Bottom action bar ─────────────────────────────────────────
  bottomActions: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0A1628',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 15,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
