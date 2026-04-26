import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const formatElapsed = (secs) => {
  if (secs == null) return '';
  const s = Math.floor(secs % 60);
  const m = Math.floor(secs / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatClock = (ts) => {
  if (ts == null) return '';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatMeta = (violation) => {
  if (violation.timestamp != null) return formatClock(violation.timestamp);
  if (violation.videoTime != null) return formatElapsed(violation.videoTime);
  return '';
};

const ViolationCard = ({ violation, index, onViewDetails }) => (
  <View style={styles.violationCard}>
    <View style={styles.violationCardLeft}>
      <Icon name="warning" size={22} color="#FF6B35" />
      <View style={styles.violationCardInfo}>
        <Text style={styles.violationCardType}>{violation.type}</Text>
        <Text style={styles.violationCardMeta}>
          {formatMeta(violation)}
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

const AnalysisResults = ({
  visible,
  violations = [],
  onClose,
  onViewDetails,
  title = 'Analysis Complete',
  emptyMessage = 'No violations were detected',
  closeLabel = 'New Analysis',
  closeIcon = 'refresh',
}) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Icon
            name={violations.length > 0 ? 'report-problem' : 'verified'}
            size={32}
            color={violations.length > 0 ? '#FF6B35' : '#4CAF50'}
          />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {violations.length > 0
              ? `${violations.length} violation${violations.length > 1 ? 's' : ''} detected`
              : emptyMessage}
          </Text>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {violations.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check-circle" size={48} color="#4CAF50" />
              <Text style={styles.emptyStateText}>All clear! No traffic violations found.</Text>
            </View>
          ) : (
            violations.map((v, i) => (
              <ViolationCard key={i} violation={v} index={i} onViewDetails={onViewDetails} />
            ))
          )}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Icon name={closeIcon} size={20} color="#FFF" />
            <Text style={styles.closeButtonText}>{closeLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.3)',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(74,144,226,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
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
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewDetailsBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
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
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnalysisResults;
