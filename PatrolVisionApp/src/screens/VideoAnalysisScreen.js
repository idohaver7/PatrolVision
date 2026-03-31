import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
  PermissionsAndroid,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import Video from 'react-native-video';
import { createThumbnail } from 'react-native-create-thumbnail';
import { pick, types, isCancel } from '@react-native-documents/picker';
import Geolocation from 'react-native-geolocation-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { analyzeTrafficFrame } from '../services/api';
import styles from './VideoAnalysisScreen.styles';

const FRAMES_BATCH_SIZE = 4;
const FRAME_INTERVAL_MS = 166;
const SEEK_STEP = 10;
const SPEEDS = [0.5, 1, 1.5, 2];
const SCREEN_WIDTH = Dimensions.get('window').width;

const formatTime = (secs) => {
  const s = Math.floor(secs % 60);
  const m = Math.floor(secs / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── Scrubber ───────────────────────────────────────────────────────────────
const Scrubber = ({ progress, duration, onSeek }) => {
  const barWidth = SCREEN_WIDTH - 32;
  const [dragging, setDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setDragging(true);
        setDragProgress(Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth)));
      },
      onPanResponderMove: (e) =>
        setDragProgress(Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth))),
      onPanResponderRelease: (e) => {
        const p = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
        setDragging(false);
        onSeek(p * duration);
      },
    })
  ).current;

  const fill = dragging ? dragProgress : progress;
  return (
    <View style={styles.scrubberWrapper} {...panResponder.panHandlers}>
      <View style={styles.scrubberTrack}>
        <View style={[styles.scrubberFill, { width: `${fill * 100}%` }]} />
        <View style={[styles.scrubberThumb, { left: `${fill * 100}%` }]} />
      </View>
    </View>
  );
};

// ── Violation card in summary list ────────────────────────────────────────
const ViolationCard = ({ violation, index, onReport }) => (
  <View style={styles.violationCard}>
    <View style={styles.violationCardLeft}>
      <Icon name="warning" size={22} color="#FF6B35" />
      <View style={styles.violationCardInfo}>
        <Text style={styles.violationCardType}>{violation.type}</Text>
        <Text style={styles.violationCardMeta}>
          🕐 {formatTime(violation.videoTime)}
          {violation.plate ? `   🚘 ${violation.plate}` : ''}
        </Text>
      </View>
    </View>
    <TouchableOpacity style={styles.reportBtn} onPress={() => onReport(violation, index)}>
      <Text style={styles.reportBtnText}>Report</Text>
    </TouchableOpacity>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
const VideoAnalysisScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const videoRef     = useRef(null);
  const videoFileRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle | ready | analyzing | done
  const [videoFile, setVideoFile] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [violations, setViolations] = useState([]); // accumulated violations

  // Player state
  const [isPaused, setIsPaused] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Analysis refs
  const isStoppedRef   = useRef(false);
  const framesBatchRef = useRef([]);
  const isUploadingRef = useRef(false);
  const locationRef    = useRef(null);
  const frameCountRef  = useRef(0);
  const currentTimeRef = useRef(0);
  const violationsRef  = useRef([]); // mirror of violations for callbacks

  const controlsTimer = useRef(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!isPaused) setControlsVisible(false);
    }, 3000);
  }, [isPaused]);

  useEffect(() => () => clearTimeout(controlsTimer.current), []);

  // ── GPS ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      Geolocation.getCurrentPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCurrentLocation(loc);
          locationRef.current = loc;
        },
        (err) => console.log('GPS Error:', err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    };
    init();
  }, []);

  // ── Pick video ────────────────────────────────────────────────────────────
  const pickVideo = async () => {
    try {
      const results = await pick({ type: [types.video], copyTo: 'cachesDirectory', allowMultiSelection: false });
      const result = results[0];
      const uri = result.fileCopyUri ?? result.uri;
      const fileObj = { ...result, uri };
      videoFileRef.current = fileObj;
      setVideoFile(fileObj);
      setStatus('ready');
      setIsPaused(true);
      setCurrentTime(0);
      setViolations([]);
      violationsRef.current = [];
      frameCountRef.current = 0;
      setControlsVisible(true);
    } catch (err) {
      if (!isCancel(err)) console.log('Picker error:', err);
    }
  };

  // ── Player controls ───────────────────────────────────────────────────────
  const togglePlayPause = () => { showControls(); setIsPaused(p => !p); };
  const seekBy = (delta) => {
    showControls();
    videoRef.current?.seek(Math.max(0, Math.min(videoDuration, currentTimeRef.current + delta)));
  };
  const seekToBeginning = () => { showControls(); videoRef.current?.seek(0); };
  const seekToEnd       = () => { showControls(); videoRef.current?.seek(videoDuration); };
  const handleScrubberSeek = (time) => { videoRef.current?.seek(time); showControls(); };
  const cycleSpeed = () => {
    showControls();
    setPlaybackRate(r => SPEEDS[(SPEEDS.indexOf(r) + 1) % SPEEDS.length]);
  };

  // ── Batch upload — collects violations, video keeps playing ──────────────
  const sendBatchInBackground = useCallback(async (batch) => {
    isUploadingRef.current = true;
    try {
      const uris = batch.map(item => item.compressed);
      const result = await analyzeTrafficFrame(uris);
      if (result.success && result.data.violation) {
        setIsPaused(true);
        isStoppedRef.current = true;
        setStatus('ready');
        setControlsVisible(true);
        const winningIndex = result.data.last_violation_frame ?? batch.length - 1;
        const newViolation = {
          type: result.data.type,
          plate: result.data.license_plate,
          imageUri: batch[winningIndex].original,
          location: locationRef.current ?? { latitude: 0, longitude: 0 },
          videoTime: currentTimeRef.current,
        }
        violationsRef.current = [...violationsRef.current, newViolation];
        setViolations([...violationsRef.current]);
        navigation.navigate('NewViolation', {
          violationType: result.data.type,
          plate: result.data.license_plate,
          imageUri: newViolation.imageUri,
          location: newViolation.location,
        });
      }
    } catch (err) {
      console.log('Batch upload error:', err);
    } finally {
      isUploadingRef.current = false;
    }
  }, [navigation]);

  // ── Capture loop (identical cadence to LiveCameraScreen) ─────────────────
  useEffect(() => {
    if (status !== 'analyzing') return;
    let isMounted = true;

    const captureLoop = async () => {
      if (!isMounted || isStoppedRef.current) return;
      const startTime = Date.now();
      try {
        const currentMs = Math.floor(currentTimeRef.current * 1000);
        const thumb = await createThumbnail({ url: videoFileRef.current.uri, timeStamp: currentMs, maxWidth: 1280 });
        const frameUri = 'file://' + thumb.path;
        framesBatchRef.current.push({ original: frameUri, compressed: frameUri });
        frameCountRef.current += 1;

        if (framesBatchRef.current.length >= FRAMES_BATCH_SIZE && !isUploadingRef.current) {
          const batchToSend = [...framesBatchRef.current];
          framesBatchRef.current = [];
          sendBatchInBackground(batchToSend);
        } else if (framesBatchRef.current.length >= FRAMES_BATCH_SIZE) {
          framesBatchRef.current.shift();
        }
      } catch (err) {
        console.log('Capture error:', err);
      }
      const delay = Math.max(50, FRAME_INTERVAL_MS - (Date.now() - startTime));
      if (isMounted && !isStoppedRef.current) setTimeout(captureLoop, delay);
    };

    captureLoop();
    return () => { isMounted = false; };
  }, [status, sendBatchInBackground]);

  const onVideoProgress = useCallback(({ currentTime: ct }) => {
    currentTimeRef.current = ct;
    setCurrentTime(ct);
  }, []);

  // ── Video ended — show summary ────────────────────────────────────────────
  const onVideoEnd = useCallback(() => {
    isStoppedRef.current = true;
    setIsPaused(true);
    setStatus('done');
    setControlsVisible(true);
  }, []);

  // ── Analysis controls ─────────────────────────────────────────────────────
  const startAnalysis = () => {
    isStoppedRef.current = false;
    framesBatchRef.current = [];
    setStatus('analyzing');
    setIsPaused(false);
    showControls();
  };

  const stopAnalysis = () => {
    isStoppedRef.current = true;
    setIsPaused(true);
    setStatus('done');
    setControlsVisible(true);
    framesBatchRef.current = [];
  };

  const resetScreen = () => {
    isStoppedRef.current = true;
    setIsPaused(true);
    setStatus('idle');
    setVideoFile(null);
    setCurrentTime(0);
    setVideoDuration(0);
    setViolations([]);
    violationsRef.current = [];
    framesBatchRef.current = [];
    frameCountRef.current = 0;
  };

  const reportViolation = (violation) => {
    navigation.navigate('NewViolation', {
      violationType: violation.type,
      plate: violation.plate,
      imageUri: violation.imageUri,
      location: violation.location,
    });
  };

  const progress = videoDuration > 0 ? currentTime / videoDuration : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0D2A4D" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Video Analysis</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Video player */}
      {status !== 'idle' && videoFile ? (
        <View style={styles.videoWrapper}>
          <Video
            ref={videoRef}
            source={{ uri: videoFile.uri }}
            style={styles.videoPlayer}
            resizeMode="contain"
            paused={isPaused}
            rate={playbackRate}
            muted={isMuted}
            onLoad={({ duration }) => setVideoDuration(duration)}
            onProgress={onVideoProgress}
            onEnd={onVideoEnd}
            onError={(e) => console.log('Video error:', e)}
            repeat={false}
          />
          <TouchableWithoutFeedback onPress={showControls}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />
          </TouchableWithoutFeedback>

          {/* ANALYZING badge */}
          {status === 'analyzing' && (
            <View style={[styles.liveBadge, { zIndex: 2 }]}>
              <Animated.View style={[styles.liveDot, { opacity: fadeAnim }]} />
              <Text style={styles.liveText}>ANALYZING</Text>
            </View>
          )}

          {/* Violation count badge (top-right, shown once at least 1 found) */}
          {violations.length > 0 && (
            <View style={[styles.violationCountBadge, { zIndex: 2 }]}>
              <Icon name="warning" size={13} color="#FFF" />
              <Text style={styles.violationCountText}>{violations.length}</Text>
            </View>
          )}

          {/* Player controls overlay */}
          {controlsVisible && (
            <View style={[styles.controlsOverlay, { zIndex: 3 }]}>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </Text>
                <TouchableOpacity onPress={cycleSpeed} style={styles.speedBadge}>
                  <Text style={styles.speedText}>{playbackRate}x</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { showControls(); setIsMuted(m => !m); }}>
                  <Icon name={isMuted ? 'volume-off' : 'volume-up'} size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
              <Scrubber progress={progress} duration={videoDuration} onSeek={handleScrubberSeek} />
              <View style={styles.transportRow}>
                <TouchableOpacity onPress={seekToBeginning} style={styles.transportBtn}>
                  <Icon name="skip-previous" size={28} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => seekBy(-SEEK_STEP)} style={styles.transportBtn}>
                  <Icon name="replay-10" size={28} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
                  <Icon name={isPaused ? 'play-arrow' : 'pause'} size={36} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => seekBy(SEEK_STEP)} style={styles.transportBtn}>
                  <Icon name="forward-10" size={28} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={seekToEnd} style={styles.transportBtn}>
                  <Icon name="skip-next" size={28} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.pickerArea} onPress={pickVideo} activeOpacity={0.7}>
          <Icon name="video-library" size={64} color="rgba(255,255,255,0.35)" />
          <Text style={styles.pickerTitle}>Select Video File</Text>
          <Text style={styles.pickerSubtitle}>MP4 supported</Text>
        </TouchableOpacity>
      )}

      {/* Summary list — visible during analysis AND after done */}
      {(status === 'analyzing' || status === 'done') && (
        <ScrollView
          style={styles.summaryList}
          contentContainerStyle={styles.summaryListContent}
          showsVerticalScrollIndicator={false}
        >
          {violations.length === 0 ? (
            status === 'done' ? (
              <View style={styles.noViolationsRow}>
                <Icon name="check-circle" size={20} color="#4CAF50" />
                <Text style={styles.noViolationsText}>No violations detected</Text>
              </View>
            ) : (
              <Text style={styles.scanningText}>Scanning for violations…</Text>
            )
          ) : (
            <>
              <Text style={styles.summaryHeader}>
                {violations.length} violation{violations.length > 1 ? 's' : ''} found
              </Text>
              {violations.map((v, i) => (
                <ViolationCard key={i} violation={v} index={i} onReport={reportViolation} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* GPS */}
      <View style={styles.gpsRow}>
        <Icon name="gps-fixed" size={14} color={currentLocation ? '#4CAF50' : '#FFC107'} />
        <Text style={styles.gpsText}>
          {currentLocation ? 'GPS acquired' : 'Acquiring GPS…'}
        </Text>
      </View>

      {/* Bottom actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
        {status === 'idle' && (
          <TouchableOpacity style={styles.primaryButton} onPress={pickVideo} activeOpacity={0.8}>
            <Icon name="folder-open" size={20} color="#FFF" />
            <Text style={styles.primaryButtonText}>Choose Video</Text>
          </TouchableOpacity>
        )}
        {status === 'ready' && (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetScreen} activeOpacity={0.8}>
              <Icon name="close" size={20} color="#FFF" />
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={startAnalysis} activeOpacity={0.8}>
              <Icon name="radar" size={22} color="#FFF" />
              <Text style={styles.primaryButtonText}>Start Analysis</Text>
            </TouchableOpacity>
          </View>
        )}
        {status === 'analyzing' && (
          <TouchableOpacity style={styles.dangerButton} onPress={stopAnalysis} activeOpacity={0.8}>
            <Icon name="stop" size={22} color="#FFF" />
            <Text style={styles.dangerButtonText}>Stop Analysis</Text>
          </TouchableOpacity>
        )}
        {status === 'done' && (
          <TouchableOpacity style={styles.secondaryButton} onPress={resetScreen} activeOpacity={0.8}>
            <Icon name="refresh" size={20} color="#FFF" />
            <Text style={styles.secondaryButtonText}>Analyse Another Video</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default VideoAnalysisScreen;
