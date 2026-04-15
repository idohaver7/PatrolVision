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
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import Video from 'react-native-video';
import { createThumbnail } from 'react-native-create-thumbnail';
import { pick, types, isCancel } from '@react-native-documents/picker';
import Geolocation from 'react-native-geolocation-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import { analyzeTrafficFrame, warmupAnalysisServer, fetchViolationById } from '../services/api';
import { useAuth } from '../context/AuthContext';
import styles from './VideoAnalysisScreen.styles';

// ── Debug Config ───────────────────────────────────────────────────────────────
const DEBUG_SAVE_FRAMES = true; // Set to false to disable frame saving
// ExternalDirectoryPath = /storage/emulated/0/Android/data/com.patrolvisionapp/files/
// No permissions needed on any Android version — always writable by the app
const DEBUG_FRAMES_DIR = `${RNFS.ExternalDirectoryPath}/PatrolVision_Debug`;

const initDebugFolder = async () => {
  const exists = await RNFS.exists(DEBUG_FRAMES_DIR);
  if (exists) await RNFS.unlink(DEBUG_FRAMES_DIR);
  await RNFS.mkdir(DEBUG_FRAMES_DIR);
  console.log(`[DEBUG] Folder ready: ${DEBUG_FRAMES_DIR}`);
};

const FRAMES_BATCH_SIZE = 4;
const EXTRACTION_FPS = 4;
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

// ── Violation Card ────────────────────────────────────────
const ViolationCard = ({ violation, index, onViewDetails }) => (
  <View style={styles.violationCard}>
    <View style={styles.violationCardLeft}>
      <Icon name="warning" size={22} color="#FF6B35" />
      <View style={styles.violationCardInfo}>
        <Text style={styles.violationCardType}>{violation.type}</Text>
        <Text style={styles.violationCardMeta}>
          {formatTime(violation.videoTime)}
          {violation.plate ? `   ${violation.plate}` : ''}
        </Text>
      </View>
    </View>
    <TouchableOpacity style={styles.viewDetailsBtn} onPress={() => onViewDetails(violation, index)}>
      <Icon name="visibility" size={16} color="#FFF" />
      <Text style={styles.viewDetailsBtnText}>Details</Text>
    </TouchableOpacity>
  </View>
);

const VideoAnalysisScreen = ({ navigation,route }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const videoRef     = useRef(null);
  const videoFileRef = useRef(null);

  const [status, setStatus] = useState('idle'); 
  const [videoFile, setVideoFile] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0); 
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [isPaused, setIsPaused] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const isStoppedRef   = useRef(false);
  const preloadedFramesRef = useRef([]);
  const lastSentFrameIndexRef = useRef(-1);
  const abortControllerRef = useRef(null);
  const framesBatchRef = useRef([]);
  const isUploadingRef = useRef(false);
  const locationRef    = useRef(null);
  const currentTimeRef = useRef(0);
  const violationsRef  = useRef([]);
  const controlsTimer = useRef(null);
  const pausedForViolationRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    ).start();

    return () => clearTimeout(controlsTimer.current);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!isPaused) setControlsVisible(false);
    }, 3000);
  }, [isPaused]);
  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      setControlsVisible(false);
      clearTimeout(controlsTimer.current);
    } else {
      showControls();
    }
  }, [controlsVisible, showControls]);

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
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
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isStoppedRef.current = true;
      framesBatchRef.current = [];
      preloadedFramesRef.current = [];
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const pickVideo = async () => {
    try {
      const results = await pick({ type: [types.video], copyTo: 'cachesDirectory', allowMultiSelection: false });
      const result = results[0];
      const fileObj = { ...result, uri: result.fileCopyUri ?? result.uri };
      videoFileRef.current = fileObj;
      setVideoFile(fileObj);
      setStatus('ready');
      setIsPaused(true);
      setIsFinalizing(false);
      setCurrentTime(0);
      setViolations([]);
      violationsRef.current = [];
      preloadedFramesRef.current = [];
      abortControllerRef.current = new AbortController();
      framesBatchRef.current = [];
      isStoppedRef.current = false;
      isUploadingRef.current = false;
      setControlsVisible(true);
    } catch (err) {
      if (!isCancel(err)) console.log('Picker error:', err);
    }
  };

  // ── Pre-processing  ──────────────────────────
  const prepareFramesAheadOfTime = async () => {
    if (videoDuration <= 0) return;
    isStoppedRef.current = false;
    isUploadingRef.current = false;
    setStatus('preprocessing');
    setControlsVisible(false);
    abortControllerRef.current = new AbortController();
    await warmupAnalysisServer();
    const intervalMs = 1000 / EXTRACTION_FPS; 
    const totalMs = Math.floor(videoDuration * 1000);
    const expectedFramesCount = Math.floor(totalMs / intervalMs) + 1;
    const extractedFrames = [];

    if (DEBUG_SAVE_FRAMES) await initDebugFolder();

    for (let timeMs = 0; timeMs <= totalMs; timeMs += intervalMs) {
      try {
        const thumb = await createThumbnail({ url: videoFileRef.current.uri, timeStamp: timeMs,
          maxWidth: 1920,
          maxHeight: 1080,
          onlySyncedFrames: false });
        const framePath = thumb.path.startsWith('file://') ? thumb.path : 'file://' + thumb.path;
        extractedFrames.push(framePath);
        setLoadingProgress(Math.round((extractedFrames.length / expectedFramesCount) * 100));

        // ── Debug: copy immediately before createThumbnail overwrites the temp file ──
        if (DEBUG_SAVE_FRAMES) {
          const frameIndex = extractedFrames.length - 1;
          const batchNum = Math.floor(frameIndex / FRAMES_BATCH_SIZE);
          const numInBatch = frameIndex % FRAMES_BATCH_SIZE;
          const destPath = `${DEBUG_FRAMES_DIR}/frame${batchNum}_${numInBatch}.jpg`;
          await RNFS.copyFile(thumb.path.replace('file://', ''), destPath);
        }
      } catch (err) {
        extractedFrames.push(null);
      }
    }

    if (DEBUG_SAVE_FRAMES) {
      console.log(`[DEBUG] Saved ${extractedFrames.filter(Boolean).length} frames to: ${DEBUG_FRAMES_DIR}`);
    }

    preloadedFramesRef.current = extractedFrames;
    lastSentFrameIndexRef.current = -1;
    framesBatchRef.current = [];
    setStatus('analyzing');
    setIsPaused(false);
    showControls();
  };

  const togglePlayPause = () => { showControls(); setIsPaused(p => !p); };
  const seekBy = (delta) => {
    showControls();
    videoRef.current?.seek(Math.max(0, Math.min(videoDuration, currentTimeRef.current + delta)));
    framesBatchRef.current = [];
  };
  const seekToBeginning = () => { showControls(); videoRef.current?.seek(0); framesBatchRef.current = []; };
  const seekToEnd = () => { showControls(); videoRef.current?.seek(videoDuration); framesBatchRef.current = []; };
  const handleScrubberSeek = (time) => { videoRef.current?.seek(time); showControls(); framesBatchRef.current = []; };
  const cycleSpeed = () => { showControls(); setPlaybackRate(r => SPEEDS[(SPEEDS.indexOf(r) + 1) % SPEEDS.length]); };

  const startAnalysis = () => {
    if (preloadedFramesRef.current && preloadedFramesRef.current.length > 0) {
      console.log('Frames already preloaded, resuming analysis...');
      framesBatchRef.current = []; 
      setStatus('analyzing');
      setIsPaused(false);
      showControls();
    } else {
      
      prepareFramesAheadOfTime();
    }
  };

  const stopAnalysis = () => {
    isStoppedRef.current = true;
    setIsPaused(true);
    setStatus('done');
    setControlsVisible(true);
    framesBatchRef.current = [];
    setShowResults(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const resetScreen = () => {
    isStoppedRef.current = true;
    setIsPaused(true);
    setIsFinalizing(false);
    setStatus('idle');
    setVideoFile(null);
    setCurrentTime(0);
    setVideoDuration(0);
    setViolations([]);
    setShowResults(false);
    violationsRef.current = [];
    framesBatchRef.current = [];
    lastSentFrameIndexRef.current = -1;
    preloadedFramesRef.current = [];
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

  };

  const [showResults, setShowResults] = useState(false);

  const viewViolationDetails = async (violation) => {
    if (violation.serverId) {
      const result = await fetchViolationById(token, violation.serverId);
      if (result.success) {
        navigation.navigate('ViolationDetail', { violation: result.data });
        return;
      }
    }
    // Fallback if server fetch fails or no serverId
    const violationData = {
      _id: `local_${Date.now()}`,
      violationType: violation.type,
      licensePlate: violation.plate || 'Unknown',
      mediaUrl: violation.imageUri,
      address: violation.location ? `${violation.location.latitude.toFixed(4)}, ${violation.location.longitude.toFixed(4)}` : 'Unknown',
      location: violation.location ? {
        type: 'Point',
        coordinates: [violation.location.longitude, violation.location.latitude],
      } : null,
      status: 'Pending Review',
      timestamp: new Date().toISOString(),
    };
    navigation.navigate('ViolationDetail', { violation: violationData });
  };

  const sendBatchInBackground = useCallback(async (batch) => {
    isUploadingRef.current = true;
    try {
      const uris = batch.map(item => item.compressed);
      const result = await analyzeTrafficFrame(uris, abortControllerRef.current?.signal);
      if(!result.success&& result.error === "Request cancelled") {
        return;
      }
      if (result.success && result.data.violation) {
        const winningIndex = result.data.last_violation_frame ?? batch.length - 1;
        const newViolation = {
          type: result.data.type,
          plate: result.data.license_plate,
          imageUri: batch[winningIndex].original,
          location: locationRef.current ?? { latitude: 0, longitude: 0 },
          videoTime: currentTimeRef.current,
        };
        violationsRef.current = [...violationsRef.current, newViolation];
        setViolations([...violationsRef.current]);
        setIsPaused(true);
        pausedForViolationRef.current = true;
        framesBatchRef.current = [];
        setControlsVisible(true);
        navigation.navigate('NewViolation', {
          violationType: result.data.type,
          plate: result.data.license_plate,
          imageUri: newViolation.imageUri,
          location: newViolation.location,
          onReturnId: (serverId) => {
            
            //Get The violation ID from new violation screen
            if (serverId && violationsRef.current.length > 0) {
              const last = violationsRef.current[violationsRef.current.length - 1];
              last.serverId = serverId;
              setViolations([...violationsRef.current]);
            }
            
            // Resume the video and analysis after returning from the violation screen
            pausedForViolationRef.current = false;
            framesBatchRef.current = [];
            isUploadingRef.current = false;
            setIsPaused(false);
          }
        });
      }
    } catch (err) {
      console.log('Batch upload error:', err);
    } finally {
      isUploadingRef.current = false;
    }
  }, [navigation]);

  // ── Simulation Loop ─────────────────────────────────
  useEffect(() => {
    if (status !== 'analyzing') return;
    let isMounted = true;

    const simulationLoop = async () => {
      if (!isMounted) return;

      try {
        //--- insert frames to the batch based on current video time ---
        if (!isPaused && !isStoppedRef.current) {
          const currentFrameIndex = Math.floor(currentTimeRef.current * EXTRACTION_FPS);
          
          if (currentFrameIndex !== lastSentFrameIndexRef.current && currentFrameIndex < preloadedFramesRef.current.length) {
            const frameUri = preloadedFramesRef.current[currentFrameIndex];
            lastSentFrameIndexRef.current = currentFrameIndex;

            if (frameUri) {
              framesBatchRef.current.push({ original: frameUri, compressed: frameUri });
            }
          }
        }

        //--- send batch to the server based on conditions ---
        if (framesBatchRef.current.length >= FRAMES_BATCH_SIZE && !isUploadingRef.current) {
          const batchToSend = framesBatchRef.current.splice(0, FRAMES_BATCH_SIZE);
          sendBatchInBackground(batchToSend);
        }
        // The video is over but there are still frames that haven't been sent and we're not currently uploading - let's send them in the background before fully stopping
        else if ((isPaused || isStoppedRef.current) && framesBatchRef.current.length > 0 && !isUploadingRef.current){
          const batchToSend = framesBatchRef.current.splice(0, framesBatchRef.current.length);
          sendBatchInBackground(batchToSend);
        }
        
        // Stop the loop only if there isnt frames in the queue
        else if (isStoppedRef.current && framesBatchRef.current.length === 0 && !isUploadingRef.current) {
          setIsFinalizing(false); 
          setStatus('done');   
          setShowResults(true);   
          return;
        }

      } catch (err) {
        console.log('Simulation loop error:', err);
      }
      
      
      if (isMounted) setTimeout(simulationLoop, 50);
    };

    simulationLoop();
    return () => { isMounted = false; };
  }, [status, isPaused, sendBatchInBackground]);

  const progress = videoDuration > 0 ? currentTime / videoDuration : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0D2A4D" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Video Analysis</Text>
        <View style={{ width: 44 }} />
      </View>

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
            onProgress={({ currentTime: ct }) => {
              currentTimeRef.current = ct;
              setCurrentTime(ct);
            }}
            progressUpdateInterval={50}
            onEnd={() => {
              isStoppedRef.current = true;
              setIsPaused(true);
              setControlsVisible(true);
              //Check if there are still frames that haven't been sent or currently uploading - if so, show the finalizing screen until they're done before showing results
              if (framesBatchRef.current.length > 0 || isUploadingRef.current) {
                setIsFinalizing(true); // show finalizing screen
              } else {
                // No pending frames or uploads, we can show results immediately
                setStatus('done');
                setShowResults(true);
              }
            }}
            repeat={false}
          />
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 1 }]} />
          </TouchableWithoutFeedback>

          {status === 'preprocessing' && (
            <View style={[styles.controlsOverlay, { zIndex: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }]}>
              <ActivityIndicator size="large" color="#FF6B35" style={{ marginBottom: 16 }} />
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>Preparing High-Res Data Stream</Text>
              <Text style={{ color: '#CCC', fontSize: 14, marginTop: 8 }}>Extracting frames for AI analysis... {loadingProgress}%</Text>
            </View>
          )}

          {status === 'analyzing' && (
            <View style={[styles.liveBadge, { zIndex: 2 }]}>
              <Animated.View style={[styles.liveDot, { opacity: fadeAnim }]} />
              <Text style={styles.liveText}>ANALYZING</Text>
            </View>
          )}

          {controlsVisible && status !== 'preprocessing' && (
            <View style={[styles.controlsOverlay, { zIndex: 3 }]}>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(videoDuration)}</Text>
                <TouchableOpacity onPress={cycleSpeed} style={styles.speedBadge}>
                  <Text style={styles.speedText}>{playbackRate}x</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { showControls(); setIsMuted(m => !m); }}>
                  <Icon name={isMuted ? 'volume-off' : 'volume-up'} size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
              <Scrubber progress={progress} duration={videoDuration} onSeek={handleScrubberSeek} />
              <View style={styles.transportRow}>
                <TouchableOpacity onPress={seekToBeginning} style={styles.transportBtn}><Icon name="skip-previous" size={28} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity onPress={() => seekBy(-SEEK_STEP)} style={styles.transportBtn}><Icon name="replay-10" size={28} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}><Icon name={isPaused ? 'play-arrow' : 'pause'} size={36} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity onPress={() => seekBy(SEEK_STEP)} style={styles.transportBtn}><Icon name="forward-10" size={28} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity onPress={seekToEnd} style={styles.transportBtn}><Icon name="skip-next" size={28} color="#FFF" /></TouchableOpacity>
              </View>
            </View>
          )}
          {isFinalizing && (
            <View style={[styles.controlsOverlay, { zIndex: 5, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }]}>
              <ActivityIndicator size="large" color="#FF6B35" style={{ marginBottom: 16 }} />
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>Just a moment...</Text>
              <Text style={{ color: '#CCC', fontSize: 15, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>
               🧠The Video is over{'\n'}
                But we are still analyzing the last few seconds.
              </Text>
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

      {/* Results Modal — full screen overlay when analysis is done/stopped */}
      <Modal visible={showResults} animationType="slide" transparent>
        <View style={styles.resultsOverlay}>
          <View style={styles.resultsContainer}>
            {/* Results Header */}
            <View style={styles.resultsHeader}>
              <Icon
                name={violations.length > 0 ? 'report-problem' : 'verified'}
                size={32}
                color={violations.length > 0 ? '#FF6B35' : '#4CAF50'}
              />
              <Text style={styles.resultsTitle}>Analysis Complete</Text>
              <Text style={styles.resultsSubtitle}>
                {violations.length > 0
                  ? `${violations.length} violation${violations.length > 1 ? 's' : ''} detected`
                  : 'No violations were detected in this video'}
              </Text>
            </View>

            {/* Violations List */}
            <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsListContent} showsVerticalScrollIndicator={false}>
              {violations.length === 0 ? (
                <View style={styles.noViolationsBig}>
                  <Icon name="check-circle" size={48} color="#4CAF50" />
                  <Text style={styles.noViolationsBigText}>All clear! No traffic violations found.</Text>
                </View>
              ) : (
                violations.map((v, i) => (
                  <ViolationCard key={i} violation={v} index={i} onViewDetails={viewViolationDetails} />
                ))
              )}
            </ScrollView>

            {/* Results Actions */}
            <View style={styles.resultsActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => { setShowResults(false); resetScreen(); }}
                activeOpacity={0.8}
              >
                <Icon name="refresh" size={20} color="#FFF" />
                <Text style={styles.secondaryButtonText}>New Analysis</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.gpsRow}>
        <Icon name="gps-fixed" size={14} color={currentLocation ? '#4CAF50' : '#FFC107'} />
        <Text style={styles.gpsText}>{currentLocation ? 'GPS acquired' : 'Acquiring GPS...'}</Text>
      </View>

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
          <TouchableOpacity style={styles.stopButton} onPress={stopAnalysis} activeOpacity={0.8}>
            <Text style={styles.stopButtonText}>Stop Analysis</Text>
          </TouchableOpacity>
        )}
        {status === 'done' && !showResults && (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setShowResults(true)} activeOpacity={0.8}>
              <Icon name="assessment" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>View Results</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetScreen} activeOpacity={0.8}>
              <Icon name="refresh" size={20} color="#FFF" />
              <Text style={styles.secondaryButtonText}>New Analysis</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

export default VideoAnalysisScreen;